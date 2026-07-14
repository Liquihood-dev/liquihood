/**
 * Create Isolated Market — Admin-only page
 *
 * Only the protocol owner (deployer wallet) can execute these on-chain calls.
 * Procedure: 5 sequential transactions that configure a new isolated market:
 *
 *  1. HealthFactorEngine.configureAsset  — risk params (LTV, LT, bonus)
 *  2. OracleRouter.configureAsset        — register as keeper-fed oracle
 *  3. OracleRouter.pushPrice             — push initial price
 *  4. LendingPool.addReserve             — add to lending pool
 *  5. IsolatedMarketController.configureIsolatedAsset — mark isolated + debt ceiling
 *  6. IsolatedMarketController.setAllowedBorrowAsset  — allow USDG to be borrowed
 */

import * as React from 'react'
import { useProtocol }       from '@/hooks/use-protocol'
import { CONTRACTS, ASSET_TOKEN_ADDRESS } from '@/lib/contracts'
import {
  LENDING_POOL_ABI,
  HEALTH_FACTOR_ENGINE_ABI,
  ORACLE_ROUTER_ABI,
  ISOLATED_MARKET_CONTROLLER_ABI,
  ERC20_ABI,
} from '@/lib/abis'
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  usePublicClient,
} from 'wagmi'
import { Button }        from '@/components/ui/button'
import { Input }         from '@/components/ui/input'
import { Label }         from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CircleCheck, Loader2, AlertTriangle, Lock, ArrowRight,
  ShieldCheck, TriangleAlert, Info, ExternalLink, Copy, Check, AlertCircle,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const RAY          = 10n ** 27n           // 1e27 = 100 % in ray units
const USD_8DEC     = 10n ** 8n            // 1e8  = $1.00 in oracle units
const IRM          = CONTRACTS.INTEREST_RATE_MODEL
const USDG_ADDRESS = ASSET_TOKEN_ADDRESS['usd-g']  // only stablecoin allowed as borrow asset in isolated mode

// ─── Types ────────────────────────────────────────────────────────────────────

type TxStatus = 'idle' | 'running' | 'done' | 'error'

interface TxStep {
  id:    number
  label: string
  desc:  string
  status: TxStatus
  txHash?: string
  errorMsg?: string
}

interface FormValues {
  tokenAddress: string
  initialPrice: string    // USD, e.g. "0.05"
  ltv:          string    // %, e.g. "25"
  liqThreshold: string    // %, e.g. "35"
  liqBonus:     string    // %, e.g. "12"
  debtCeiling:  string    // USD, e.g. "500000"
  isEquity:     boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function pct2ray(pct: string): bigint {
  const n = parseFloat(pct)
  if (isNaN(n) || n <= 0 || n > 100) return 0n
  // multiply by 1e25 to get ray (= pct/100 * 1e27)
  return BigInt(Math.round(n * 1e4)) * (RAY / 1_000_000n)
}

function usd2price8(usd: string): bigint {
  // e.g. "0.05" → 5_000_000n  (= $0.05 × 1e8)
  const n = parseFloat(usd)
  if (isNaN(n) || n <= 0) return 0n
  return BigInt(Math.round(n * 1e8))
}

function usd2ceiling8(usd: string): bigint {
  // e.g. "500000" → 50_000_000_000n  (= $500,000 × 1e8)
  const n = parseFloat(usd)
  if (isNaN(n) || n <= 0) return 0n
  return BigInt(Math.round(n)) * USD_8DEC
}

function formatUsd(s: string): string {
  const n = parseFloat(s)
  if (isNaN(n)) return s
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function shortenTx(hash: string): string {
  return hash.slice(0, 10) + '…' + hash.slice(-6)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateMarketPage() {
  const { walletAddress, connectWallet } = useProtocol()
  const publicClient     = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  // ── Read protocol owner from LendingPool ──────────────────────────────────
  const { data: ownerAddress } = useReadContract({
    address:      CONTRACTS.LENDING_POOL,
    abi:          LENDING_POOL_ABI,
    functionName: 'owner',
  })

  // ── Read IsolatedMarketController address from LendingPool ────────────────
  const { data: imcAddress } = useReadContract({
    address:      CONTRACTS.LENDING_POOL,
    abi:          LENDING_POOL_ABI,
    functionName: 'isolatedController',
  })

  // ── Check if connected wallet is an authorized keeper on OracleRouter ────────
  // CRITICAL: OracleRouter.pushPrice requires msg.sender to be an authorizedKeeper.
  // The deployer address is automatically whitelisted at deploy time (keeper whitelist).
  const { data: isAuthorizedKeeper } = useReadContract({
    address:      CONTRACTS.ORACLE_ROUTER,
    abi:          ORACLE_ROUTER_ABI,
    functionName: 'authorizedKeepers',
    args:         [walletAddress as `0x${string}`],
    query:        { enabled: !!walletAddress },
  })

  const isKeeperMatch = !!isAuthorizedKeeper

  const isOwner = !!(
    walletAddress &&
    ownerAddress &&
    walletAddress.toLowerCase() === (ownerAddress as string).toLowerCase()
  )

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = React.useState<FormValues>({
    tokenAddress: '',
    initialPrice: '',
    ltv:          '25',
    liqThreshold: '35',
    liqBonus:     '12',
    debtCeiling:  '500000',
    isEquity:     false,
  })

  const setField = (key: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: key === 'isEquity' ? e.target.checked : e.target.value }))

  // ── Token info fetch (when valid address is entered) ──────────────────────
  const validAddr = isValidAddress(form.tokenAddress)

  const { data: tokenData } = useReadContracts({
    contracts: [
      { address: form.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'name'   },
      { address: form.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' },
      { address: form.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' },
    ],
    query: { enabled: validAddr },
  })

  const tokenName    = tokenData?.[0]?.result as string | undefined
  const tokenSymbol  = tokenData?.[1]?.result as string | undefined
  const tokenDecimals= tokenData?.[2]?.result as number | undefined

  // ── Execution state ───────────────────────────────────────────────────────
  const [phase, setPhase]   = React.useState<'form' | 'running' | 'done'>('form')
  const [steps, setSteps]   = React.useState<TxStep[]>([])
  const [copied, setCopied] = React.useState(false)

  const updateStep = (id: number, patch: Partial<TxStep>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!validAddr)
      return 'Enter a valid ERC20 contract address.'
    if (!tokenName || !tokenSymbol)
      return 'Could not read token name/symbol. Check the contract address.'
    if (parseFloat(form.initialPrice) <= 0 || isNaN(parseFloat(form.initialPrice)))
      return 'Enter a valid initial price (USD).'
    if (parseFloat(form.ltv) <= 0 || parseFloat(form.ltv) >= 100)
      return 'LTV must be between 0 and 100.'
    if (parseFloat(form.liqThreshold) <= parseFloat(form.ltv))
      return 'Liquidation Threshold must be greater than LTV.'
    if (parseFloat(form.liqBonus) <= 0 || parseFloat(form.liqBonus) > 14.9)
      return 'Liquidation Bonus must be between 0% and 14.9% (HealthFactorEngine hard cap is 15%).'
    if (parseFloat(form.debtCeiling) < 1000)
      return 'Debt Ceiling must be at least $1,000.'
    if (!imcAddress)
      return 'IsolatedMarketController address not loaded yet. Try again in a moment.'
    // OracleRouter.pushPrice is onlyKeeper — connected wallet must be the keeper.
    if (walletAddress && isAuthorizedKeeper === false)
      return `Step 3 (pushPrice) requires your wallet to be an authorized keeper on OracleRouter. Connect the deployer wallet, or ask the owner to call addKeeper(yourWallet).`
    return null
  }

  const [formError, setFormError] = React.useState<string | null>(null)

  // ── Execute ───────────────────────────────────────────────────────────────
  async function handleCreate() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError(null)

    const sym = tokenSymbol!
    const name = tokenName!

    const initialSteps: TxStep[] = [
      {
        id: 1, label: 'Configure risk params',
        desc: `HealthFactorEngine.configureAsset: LTV ${form.ltv}%, Liq Threshold ${form.liqThreshold}%, Bonus ${form.liqBonus}%`,
        status: 'idle',
      },
      {
        id: 2, label: 'Configure oracle',
        desc: 'OracleRouter.configureAsset: KEEPER mode, 5-minute staleness window',
        status: 'idle',
      },
      {
        id: 3, label: 'Push initial price',
        desc: `OracleRouter.pushPrice: ${formatUsd(form.initialPrice)} per ${sym}`,
        status: 'idle',
      },
      {
        id: 4, label: 'Add reserve to pool',
        desc: `LendingPool.addReserve: mints lh${sym} (supply token) and d${sym} (debt token)`,
        status: 'idle',
      },
      {
        id: 5, label: 'Activate isolated mode',
        desc: `IsolatedMarketController.configureIsolatedAsset: debt ceiling ${formatUsd(form.debtCeiling)}`,
        status: 'idle',
      },
      {
        id: 6, label: 'Allow USDG borrowing',
        desc: `IsolatedMarketController.setAllowedBorrowAsset: only USDG can be borrowed against ${sym}`,
        status: 'idle',
      },
    ]

    setSteps(initialSteps)
    setPhase('running')

    const token   = form.tokenAddress as `0x${string}`
    const imc     = imcAddress as `0x${string}`

    const ltvRay   = pct2ray(form.ltv)
    const ltRay    = pct2ray(form.liqThreshold)
    const bonusRay = pct2ray(form.liqBonus)
    const price8   = usd2price8(form.initialPrice)
    const ceiling  = usd2ceiling8(form.debtCeiling)

    async function runStep(id: number, fn: () => Promise<string>) {
      updateStep(id, { status: 'running' })
      try {
        const hash = await fn()
        await publicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` })
        updateStep(id, { status: 'done', txHash: hash })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        updateStep(id, { status: 'error', errorMsg: msg.slice(0, 200) })
        throw e
      }
    }

    try {
      // Step 1 — HealthFactorEngine.configureAsset
      await runStep(1, async () => {
        return writeContractAsync({
          address:      CONTRACTS.HEALTH_FACTOR_ENGINE,
          abi:          HEALTH_FACTOR_ENGINE_ABI,
          functionName: 'configureAsset',
          args:         [token, ltvRay, ltRay, bonusRay],
        })
      })

      // Step 2 — OracleRouter.configureAsset (KEEPER = 1)
      await runStep(2, async () => {
        return writeContractAsync({
          address:      CONTRACTS.ORACLE_ROUTER,
          abi:          ORACLE_ROUTER_ABI,
          functionName: 'configureAsset',
          args:         [token, 1, '0x0000000000000000000000000000000000000000', 0n, 300n],
        })
      })

      // Step 3 — OracleRouter.pushPrice
      await runStep(3, async () => {
        return writeContractAsync({
          address:      CONTRACTS.ORACLE_ROUTER,
          abi:          ORACLE_ROUTER_ABI,
          functionName: 'pushPrice',
          args:         [token, price8],
        })
      })

      // Step 4 — LendingPool.addReserve
      await runStep(4, async () => {
        return writeContractAsync({
          address:      CONTRACTS.LENDING_POOL,
          abi:          LENDING_POOL_ABI,
          functionName: 'addReserve',
          args:         [
            token,
            IRM,
            form.isEquity,
            `Liquihood ${name}`,
            `lh${sym}`,
            `Liquihood Debt ${name}`,
            `d${sym}`,
          ],
        })
      })

      // Step 5 — IsolatedMarketController.configureIsolatedAsset
      await runStep(5, async () => {
        return writeContractAsync({
          address:      imc,
          abi:          ISOLATED_MARKET_CONTROLLER_ABI,
          functionName: 'configureIsolatedAsset',
          args:         [token, ceiling],
        })
      })

      // Step 6 — IsolatedMarketController.setAllowedBorrowAsset (USDG only)
      await runStep(6, async () => {
        return writeContractAsync({
          address:      imc,
          abi:          ISOLATED_MARKET_CONTROLLER_ABI,
          functionName: 'setAllowedBorrowAsset',
          args:         [token, USDG_ADDRESS, true],
        })
      })

      setPhase('done')
    } catch {
      // runStep already set the failing step to 'error'; leave phase as 'running'
      // so user can see progress up to the failure point.
    }
  }

  // ── Copy helpers ──────────────────────────────────────────────────────────
  function copyContracts() {
    const text = `  '${tokenSymbol?.toLowerCase() ?? 'token'}': '${form.tokenAddress}',`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // Not connected
  if (!walletAddress) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">Connect Wallet</h1>
        <p className="text-muted-foreground">
          Connect the protocol owner wallet to create isolated markets.
        </p>
        <Button onClick={connectWallet} size="lg">Connect Wallet</Button>
      </div>
    )
  }

  // Connected, but not owner
  if (ownerAddress && !isOwner) {
    return (
      <div className="max-w-lg mx-auto mt-20 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2.5">
              <TriangleAlert className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-semibold">Not the Protocol Owner</h1>
              <p className="text-sm text-muted-foreground">Your connected wallet cannot create markets.</p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span className="text-foreground">{(ownerAddress as string).slice(0,6)}…{(ownerAddress as string).slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connected</span>
              <span className="text-foreground">{walletAddress.slice(0,6)}…{walletAddress.slice(-4)}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Creating a new isolated market requires calling 6 <span className="font-mono text-foreground">onlyOwner</span> functions
            across 4 contracts. Switch to the deployer wallet to continue.
          </p>
        </div>

        {/* Architecture explanation — visible to everyone */}
        <ArchitectureCard />
      </div>
    )
  }

  // Success state
  if (phase === 'done') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Market Created On-Chain</h1>
              <p className="text-sm text-muted-foreground">
                {tokenName} ({tokenSymbol}) is now a live isolated market on Robinhood Chain.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 space-y-1 text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-2">Transaction Summary</p>
            {steps.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{s.label}</span>
                {s.txHash && (
                  <a
                    href={`https://explorer.robinhood.com/tx/${s.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {shortenTx(s.txHash)} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Next step: update contracts.ts */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Required: Update <code className="text-xs bg-muted px-1 py-0.5 rounded">contracts.ts</code>
          </h2>
          <p className="text-sm text-muted-foreground">
            The market is live on-chain, but the app's Markets page is driven by a static token list in{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">src/lib/contracts.ts</code>.
            Add the token address so the keeper includes it in price updates and the UI displays it.
          </p>
          <div className="relative">
            <pre className="bg-muted rounded-lg p-4 text-xs font-mono text-foreground overflow-x-auto">
{`// In ASSET_TOKEN_ADDRESS, add:
  '${tokenSymbol?.toLowerCase() ?? 'your-id'}': '${form.tokenAddress}',`}
            </pre>
            <button
              onClick={copyContracts}
              className="absolute top-2 right-2 p-1.5 rounded hover:bg-background transition-colors"
              title="Copy"
            >
              {copied
                ? <Check className="h-4 w-4 text-primary" />
                : <Copy className="h-4 w-4 text-muted-foreground" />
              }
            </button>
          </div>
          <p className="text-xs text-amber-400 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            The price keeper only pushes oracle prices for tokens listed in ASSET_TOKEN_ADDRESS.
            Until you add this address, the oracle price will become stale after 5 minutes.
          </p>
        </div>

        <Button variant="outline" onClick={() => { setPhase('form'); setSteps([]); setForm({ tokenAddress:'', initialPrice:'', ltv:'25', liqThreshold:'35', liqBonus:'12', debtCeiling:'500000', isEquity:false }) }}>
          Create Another Market
        </Button>
      </div>
    )
  }

  // Running state
  if (phase === 'running') {
    const hasError = steps.some(s => s.status === 'error')
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Creating Isolated Market</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Confirm each transaction in your wallet. Do not close this page.
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => {
            const prev = steps[i - 1]
            const blocked = prev && prev.status !== 'done'
            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 transition-all ${
                  step.status === 'done'    ? 'border-primary/30 bg-primary/5'
                  : step.status === 'error' ? 'border-red-500/30 bg-red-500/5'
                  : step.status === 'running' ? 'border-border bg-card shadow-sm'
                  : 'border-border/50 bg-card/50 opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {step.status === 'done' && <CircleCheck className="h-5 w-5 text-primary" />}
                    {step.status === 'running' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                    {step.status === 'error' && <AlertTriangle className="h-5 w-5 text-red-400" />}
                    {step.status === 'idle' && (
                      <span className="h-5 w-5 rounded-full border-2 border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {step.id}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{step.label}</p>
                      {step.txHash && (
                        <a
                          href={`https://explorer.robinhood.com/tx/${step.txHash}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                        >
                          {shortenTx(step.txHash)} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    {step.errorMsg && (
                      <p className="text-xs text-red-400 mt-1 bg-red-500/10 rounded p-2 font-mono break-all">
                        {step.errorMsg}
                      </p>
                    )}
                    {step.status === 'running' && (
                      <p className="text-xs text-primary mt-1 animate-pulse">
                        Waiting for wallet confirmation…
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {hasError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
            <p className="text-sm font-medium text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Transaction failed
            </p>
            <p className="text-xs text-muted-foreground">
              The steps before the error were committed on-chain. Fix the issue and re-run
              the remaining steps manually or via the setup script.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setPhase('form'); setSteps([]) }}>
              Back to form
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ─── Form (owner connected) ───────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-xs font-mono text-primary uppercase tracking-wider">Owner wallet connected</span>
        </div>
        <h1 className="text-2xl font-bold">Create Isolated Market</h1>
        <p className="text-muted-foreground text-sm mt-1">
          List any ERC-20 token as an isolated collateral market on Liquihood.
          6 on-chain transactions will be sent in sequence. Confirm each one in your wallet.
        </p>
      </div>

      {/* Architecture box */}
      <ArchitectureCard />

      {/* Keeper check warning — shown when wallet is loaded but not an authorized keeper */}
      {walletAddress && isAuthorizedKeeper === false && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-400">Not an authorized keeper: Step 3 will revert</p>
            <p className="text-xs text-muted-foreground">
              <code className="font-mono">OracleRouter.pushPrice</code> requires{' '}
              <code className="font-mono">msg.sender</code> to be an authorized keeper. Your wallet{' '}
              <code className="font-mono">{walletAddress?.slice(0,6)}…{walletAddress?.slice(-4)}</code>{' '}
              is not in the keeper whitelist.
            </p>
            <p className="text-xs text-muted-foreground">
              Switch to the deployer wallet (the same key used by the API-server price keeper),
              or ask the protocol owner to call{' '}
              <code className="font-mono">OracleRouter.addKeeper(yourWallet)</code>.
            </p>
          </div>
        </div>
      )}

      {/* Keeper OK indicator */}
      {walletAddress && isAuthorizedKeeper === true && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center gap-2 text-xs text-primary">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Wallet is an authorized keeper. All 6 steps will execute correctly.
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <h2 className="font-semibold text-base">Market Configuration</h2>

        {/* Token address */}
        <div className="space-y-1.5">
          <Label>Token Contract Address</Label>
          <Input
            placeholder="0x…"
            value={form.tokenAddress}
            onChange={setField('tokenAddress')}
            className="font-mono"
          />
          {validAddr && tokenName && (
            <p className="text-xs text-primary font-mono">
              ✓ {tokenName} ({tokenSymbol}) · {tokenDecimals} decimals
            </p>
          )}
          {validAddr && !tokenName && (
            <p className="text-xs text-amber-400">Reading token info…</p>
          )}
          <p className="text-xs text-muted-foreground">
            The ERC-20 token to list. It must already be deployed on Robinhood Chain (4663).
          </p>
        </div>

        {/* Initial price */}
        <div className="space-y-1.5">
          <FieldLabel label="Initial Price (USD)" tooltip="First price pushed to the oracle. The keeper will update it every 5 minutes after that. Use the current CoinGecko / market price." />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              placeholder="0.05"
              value={form.initialPrice}
              onChange={setField('initialPrice')}
              type="number"
              min="0"
              step="any"
              className="w-full sm:w-40"
            />
          </div>
        </div>

        <hr className="border-border" />

        {/* Risk params */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Risk Parameters
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel
                label="Max LTV (%)"
                tooltip="Maximum loan-to-value ratio. A user can borrow up to this fraction of their collateral value. Example: 25% → $100 of DOGE collateral → max borrow $25."
              />
              <Input value={form.ltv} onChange={setField('ltv')} type="number" min="1" max="99" step="0.5" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel
                label="Liq. Threshold (%)"
                tooltip="Health Factor drops below 1.0 when (collateral × this threshold) < total debt. Must be higher than LTV. Example: 35% → position liquidatable if debt > 35% of collateral value."
              />
              <Input value={form.liqThreshold} onChange={setField('liqThreshold')} type="number" min="1" max="99" step="0.5" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel
                label="Liq. Bonus (%)"
                tooltip="Extra collateral paid to liquidators as incentive. Higher = more attractive for bots, but more loss for borrowers. Example: 12% → liquidator receives $112 of DOGE for every $100 of debt repaid."
              />
              <Input value={form.liqBonus} onChange={setField('liqBonus')} type="number" min="1" max="14.9" step="0.5" />
            </div>
          </div>

          {/* Visual summary */}
          {parseFloat(form.ltv) > 0 && parseFloat(form.liqThreshold) > parseFloat(form.ltv) && (
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs font-mono text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
              <span>LTV <span className="text-foreground">{form.ltv}%</span></span>
              <span>→</span>
              <span>Liq threshold <span className="text-foreground">{form.liqThreshold}%</span></span>
              <span>→</span>
              <span>Liquidator bonus <span className="text-foreground">+{form.liqBonus}%</span></span>
              <span className="ml-auto text-amber-400">
                Safety buffer: {(parseFloat(form.liqThreshold) - parseFloat(form.ltv)).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* Debt ceiling */}
        <div className="space-y-1.5">
          <FieldLabel
            label="Debt Ceiling (USD)"
            tooltip="Maximum USD-value of stablecoins that can be borrowed against this isolated collateral across ALL users. Hard cap: the protocol rejects borrows that would breach it. Example: $500,000."
          />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              value={form.debtCeiling}
              onChange={setField('debtCeiling')}
              type="number"
              min="1000"
              step="1000"
              className="w-full sm:w-48"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Only USDG can be borrowed against isolated collateral (enforced on-chain by step 6).
          </p>
        </div>

        {/* Equity toggle */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="isEquity"
            checked={form.isEquity}
            onChange={setField('isEquity')}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <div>
            <label htmlFor="isEquity" className="text-sm font-medium cursor-pointer">
              Equity asset (NYSE/NASDAQ hours restriction)
            </label>
            <p className="text-xs text-muted-foreground">
              Enable for tokenised stocks (AAPL-T, TSLA-T, etc.). Supply and borrow are blocked outside market hours.
            </p>
          </div>
        </div>

        {/* Error */}
        {formError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {formError}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <Button onClick={handleCreate} className="w-full gap-2" size="lg">
            Create Isolated Market
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            6 wallet confirmations required · All calls go to Robinhood Chain (4663)
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function ArchitectureCard() {
  const steps = [
    {
      n: 1,
      contract: 'HealthFactorEngine',
      fn: 'configureAsset(token, ltv, liqThreshold, liqBonus)',
      purpose: 'Sets how much a user can borrow against this collateral and at what point they get liquidated.',
    },
    {
      n: 2,
      contract: 'OracleRouter',
      fn: 'configureAsset(token, KEEPER, 0x0, 0, 300s)',
      purpose: 'Registers the token to use keeper-fed prices. The API server pushes a fresh price every 5 minutes.',
    },
    {
      n: 3,
      contract: 'OracleRouter',
      fn: 'pushPrice(token, price × 1e8)',
      purpose: 'Pushes the initial USD price so the oracle is not stale at market open.',
    },
    {
      n: 4,
      contract: 'LendingPool',
      fn: 'addReserve(token, IRM, isEquity, lhName, lhSymbol, debtName, debtSymbol)',
      purpose: 'Deploys lhToken (supply receipt) and debtToken (debt tracker) and activates the reserve.',
    },
    {
      n: 5,
      contract: 'IsolatedMarketController',
      fn: 'configureIsolatedAsset(token, ceiling × 1e8)',
      purpose: 'Marks the asset as isolated and sets the max USD debt the entire protocol can hold against it.',
    },
    {
      n: 6,
      contract: 'IsolatedMarketController',
      fn: 'setAllowedBorrowAsset(token, USDG, true)',
      purpose: 'Only USDG can be borrowed against isolated collateral. Prevents contagion from volatile assets.',
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-sm font-semibold">What "isolated market" means and how creation works</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        An <strong className="text-foreground">isolated market</strong> lets high-risk tokens be used as collateral
        without contaminating the main pool. Borrowers who supply an isolated asset can only borrow USDG,
        and the total protocol-wide debt against that asset is capped by a hard USD ceiling.
        This limits bad debt exposure: even if the asset price collapses to zero, maximum loss is bounded by the ceiling.
      </p>

      <p className="text-sm text-muted-foreground">
        Creating a market requires <strong className="text-foreground">6 owner-only transactions</strong> across 4 contracts:
      </p>

      <div className="space-y-2">
        {steps.map(s => (
          <div key={s.n} className="flex gap-3 text-xs">
            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 mt-0.5">
              {s.n}
            </span>
            <div>
              <span className="font-semibold text-foreground">{s.contract}</span>
              <span className="font-mono text-muted-foreground ml-1.5">.{s.fn}</span>
              <p className="text-muted-foreground mt-0.5">{s.purpose}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400 flex items-start gap-2">
        <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          All 6 functions are <code className="font-mono">onlyOwner</code>. Regular users cannot create markets.
          This is a governance action. The contract owner is the wallet that deployed the protocol.
        </span>
      </div>
    </div>
  )
}
