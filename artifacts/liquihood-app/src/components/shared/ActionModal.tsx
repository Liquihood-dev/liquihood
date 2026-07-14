import React, { useState, useCallback } from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatUsd, formatToken, formatPercent, getTimeToNextOpen } from '@/lib/utils';
import { MarketState, calculateRates } from '@/lib/protocol';
import { useWalletTokenBalance } from '@/hooks/use-on-chain-data';
import { PROTOCOL_CONFIGURED } from '@/lib/contracts';
import { ArrowRight, AlertTriangle, Info, CheckCircle, Loader2, ChevronLeft, ArrowDownToLine, ArrowUpFromLine, Banknote, CornerUpLeft, ExternalLink } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: MarketState;
  actionType: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay';
}

type ModalStep = 'input' | 'review' | 'confirming' | 'success';

export function ActionModal({ isOpen, onClose, asset, actionType }: ActionModalProps) {
  const { positions, simulateHf, executeTransaction, isMarketOpen, marketOverride, walletAddress, connectWallet, assets } = useProtocol();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ModalStep>('input');
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();

  // Real on-chain wallet balance for this asset
  const { balance: onChainBalance, isLoading: isBalanceLoading } = useWalletTokenBalance(asset.id, walletAddress as `0x${string}` | undefined);

  const position   = positions.find(p => p.assetId === asset.id);
  const supplied   = position?.supplied ?? 0;
  const borrowed   = position?.borrowed ?? 0;
  const numAmount  = parseFloat(amount) || 0;

  // Wallet balance: real if protocol configured, 50k simulation otherwise
  const walletBalance = PROTOCOL_CONFIGURED
    ? (onChainBalance ?? 0)
    : 50_000;

  React.useEffect(() => {
    if (isOpen) { setAmount(''); setStep('input'); setTxHash(undefined); }
  }, [isOpen]);

  const { borrowApr, supplyApy } = calculateRates(asset.totalSupplied, asset.totalBorrowed);

  const currentHf = simulateHf(asset.id, 0,         actionType, asset.isolated);
  const newHf     = simulateHf(asset.id, numAmount,  actionType, asset.isolated);

  const isClosedEquityBorrow = actionType === 'Borrow' && asset.isEquity && !isMarketOpen;
  const hfFloor = (actionType === 'Withdraw' && asset.isEquity && !isMarketOpen) ? 1.30 : 1.02;
  // HF = 0 means no collateral at all — treat as unsafe (block submission)
  const isUnsafe  = numAmount > 0 && newHf < hfFloor;
  const isAtRisk  = numAmount > 0 && newHf < 1.30 && !isUnsafe;

  // Borrow-specific guards
  const hasCollateral = positions.some(p => p.supplied > 0 && p.useAsCollateral);
  const noCollateralBorrow = actionType === 'Borrow' && !hasCollateral && numAmount > 0;
  const nearCap   = (asset.totalBorrowed / asset.supplyCap) > 0.95;

  const maxAvailable = useCallback((): number => {
    if (actionType === 'Supply')   return walletBalance;
    if (actionType === 'Withdraw') return supplied;
    if (actionType === 'Repay')    return borrowed;
    if (actionType === 'Borrow') {
      const collateralValueUsd = positions
        .filter(p => p.supplied > 0 && p.useAsCollateral)
        .reduce((s, p) => {
          const a = assets.find(x => x.id === p.assetId);
          return a ? s + p.supplied * a.priceUsd * a.ltv : s;
        }, 0);
      const hi = asset.priceUsd > 0
        ? Math.max(collateralValueUsd / asset.priceUsd, 1)
        : 1_000_000;
      let lo = 0, best = 0;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const hf  = simulateHf(asset.id, mid, 'Borrow', asset.isolated);
        if (hf >= 1.02) { best = mid; lo = mid; }
      }
      return Math.floor(best * 100) / 100;
    }
    return 0;
  }, [actionType, supplied, borrowed, walletBalance, simulateHf, asset, positions, assets]);

  const handleMax = () => setAmount(maxAvailable().toFixed(4));
  const handlePct = (pct: number) => setAmount((borrowed * pct).toFixed(4));

  // For Supply: if balance is still loading from chain (null), don't block the user —
  // the contract itself will reject if they genuinely lack funds.
  const supplyBalanceOk = actionType !== 'Supply'
    || isBalanceLoading
    || onChainBalance == null
    || numAmount <= walletBalance;

  const canSubmit =
    numAmount > 0 &&
    !isUnsafe &&
    !isClosedEquityBorrow &&
    supplyBalanceOk &&
    (actionType !== 'Withdraw' || numAmount <= supplied) &&
    (actionType !== 'Repay'    || numAmount <= borrowed);

  const handleConfirm = async () => {
    if (isPending) return;
    if (step === 'input') { setStep('review'); return; }
    setIsPending(true);
    setStep('confirming');
    try {
      await executeTransaction({ type: actionType, assetId: asset.id, amount: numAmount });
      setStep('success');
      setTimeout(() => { setIsPending(false); onClose(); }, 2400);
    } catch {
      // Error toasted inside executeTransaction; return to input
      setStep('input');
      setIsPending(false);
    }
  };

  const getHfColor = (hf: number) => {
    if (hf > 99)   return 'text-muted-foreground';
    if (hf >= 2)   return 'text-primary';
    if (hf >= 1.3) return 'text-primary/70';
    if (hf > 1.0)  return 'text-yellow-400';
    return 'text-destructive';
  };

  const rateLabel = actionType === 'Supply' || actionType === 'Withdraw'
    ? `${formatPercent(supplyApy)} APY`
    : `${formatPercent(borrowApr)} APR`;

  const walletLabel = `Wallet: ${onChainBalance == null ? '…' : formatToken(walletBalance)}`;

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">{actionType} {asset.symbol}</DialogTitle>
          <DialogDescription>
            {asset.isolated && (
              <span className="text-yellow-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" /> Isolated Market. Losses are contained and never affect the Main Market.
              </span>
            )}
            {actionType === 'Repay' && (
              <span className="text-primary/70 text-xs mt-1 block">
                Repay is always available, even when markets are paused.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 text-primary" />
            <div>
              <p className="font-semibold text-lg">{actionType} Confirmed</p>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {formatToken(numAmount)} {asset.symbol} on Robinhood Chain
              </p>
            </div>
            {newHf < 999 && (
              <p className="text-sm font-mono">
                New HF: <span className={getHfColor(newHf)}>{newHf.toFixed(2)}</span>
              </p>
            )}
          </div>
        )}

        {/* ── Confirming ── */}
        {step === 'confirming' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div>
              <p className="text-muted-foreground font-mono text-sm">Confirming on Robinhood Chain…</p>
              {(actionType === 'Supply' || actionType === 'Repay') && (
                <p className="text-xs text-muted-foreground/70 mt-2">
                  You may need to approve two transactions in MetaMask
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Review ── */}
        {step === 'review' && (
          <div className="space-y-5 py-4">
            <div className="text-center space-y-1 py-3">
              <p className="text-muted-foreground text-sm">You are about to {actionType.toLowerCase()}</p>
              <div className="text-3xl font-mono font-medium">{formatToken(numAmount)} {asset.symbol}</div>
              <p className="text-muted-foreground font-mono">{formatUsd(numAmount * asset.priceUsd)}</p>
            </div>

            <div className="bg-background rounded-lg p-4 border border-border space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-mono text-primary">{rateLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New Health Factor</span>
                <span className={`font-mono ${getHfColor(newHf)}`}>{newHf > 99 ? '∞' : newHf.toFixed(2)}</span>
              </div>
              {(actionType === 'Supply' || actionType === 'Repay') && PROTOCOL_CONFIGURED && (
                <div className="flex justify-between text-sm border-t border-border/50 pt-2.5">
                  <span className="text-muted-foreground">Steps</span>
                  <span className="font-mono text-muted-foreground text-xs">Approve → {actionType}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-border/50 pt-2.5">
                <span className="text-muted-foreground">Protocol Fee</span>
                <span className="font-mono text-primary">Free</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setStep('input')}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button className="flex-1 h-11 gap-1.5" onClick={handleConfirm}>
                {actionType === 'Supply'   && <ArrowDownToLine className="h-4 w-4" />}
                {actionType === 'Withdraw' && <ArrowUpFromLine className="h-4 w-4" />}
                {actionType === 'Borrow'   && <Banknote className="h-4 w-4" />}
                {actionType === 'Repay'    && <CornerUpLeft className="h-4 w-4" />}
                Confirm {actionType}
              </Button>
            </div>
          </div>
        )}

        {/* ── Input ── */}
        {step === 'input' && (
          <div className="space-y-5 py-4">
            {isClosedEquityBorrow && (
              <div className="bg-muted p-4 rounded-lg border border-border flex gap-3 items-start">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Borrowing paused</p>
                  <p className="text-muted-foreground mt-1">
                    New borrows against Stock Token collateral are unavailable while the underlying market is closed.
                    Next open in <span className="font-mono text-foreground">{getTimeToNextOpen(marketOverride)}</span>.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono text-muted-foreground text-xs">
                  {actionType === 'Withdraw' && `Deposited: ${formatToken(supplied)}`}
                  {actionType === 'Repay'    && `Owed: ${formatToken(borrowed)}`}
                  {actionType === 'Supply'   && walletLabel}
                  {actionType === 'Borrow'   && `Available: ${formatToken(maxAvailable())}`}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pr-20 font-mono text-lg h-12"
                  disabled={isClosedEquityBorrow}
                />
                {numAmount > 0 && (
                  <span className="absolute left-3 top-[3.1rem] text-xs font-mono text-muted-foreground">
                    ≈ {formatUsd(numAmount * asset.priceUsd)}
                  </span>
                )}
                <Button
                  variant="ghost" size="sm"
                  className="absolute right-2 top-2 h-8 text-primary hover:bg-primary/10"
                  onClick={handleMax}
                  disabled={isClosedEquityBorrow}
                >
                  MAX
                </Button>
              </div>

              {actionType === 'Repay' && (
                <div className="flex gap-2 mt-1">
                  {[0.25, 0.50, 1].map(pct => (
                    <Button key={pct} variant="outline" size="sm" className="flex-1 text-xs"
                      onClick={() => handlePct(pct)}>
                      {pct === 1 ? '100%' : `${pct * 100}%`}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-background rounded-lg p-4 border border-border space-y-2.5">
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Health Factor</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={getHfColor(currentHf)}>{currentHf > 99 ? '∞' : currentHf.toFixed(2)}</span>
                  {numAmount > 0 && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className={getHfColor(newHf)}>{newHf > 99 ? '∞' : newHf.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-mono text-primary">{rateLabel}</span>
              </div>
              {asset.totalBorrowed / asset.supplyCap > 0.80 && (
                <div className="flex justify-between text-sm border-t border-border/50 pt-2.5">
                  <span className="text-muted-foreground">Cap Usage</span>
                  <span className="font-mono text-yellow-400">
                    {formatPercent(asset.totalBorrowed / asset.supplyCap)}
                  </span>
                </div>
              )}
            </div>

            {nearCap && (
              <div className="bg-yellow-400/10 text-yellow-400 p-3 rounded border border-yellow-400/20 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This market is near its cap. Your transaction may be limited.
              </div>
            )}
            {isAtRisk && !isUnsafe && (
              <div className="bg-yellow-400/10 text-yellow-400 p-3 rounded border border-yellow-400/20 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                This position will be at elevated liquidation risk.
              </div>
            )}
            {isUnsafe && noCollateralBorrow && (
              <div className="bg-destructive/10 text-destructive p-3 rounded border border-destructive/20 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>No collateral. Supply an asset first (e.g. WETH on the Earn page), then return here to borrow against it.</span>
              </div>
            )}
            {isUnsafe && !noCollateralBorrow && (
              <div className="bg-destructive/10 text-destructive p-3 rounded border border-destructive/20 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                Not allowed. Resulting Health Factor must be ≥ {hfFloor}.
              </div>
            )}

            <Button
              className="w-full h-11 text-base gap-2"
              disabled={!canSubmit}
              onClick={handleConfirm}
            >
              {actionType === 'Supply'   && <ArrowDownToLine className="h-4 w-4" />}
              {actionType === 'Withdraw' && <ArrowUpFromLine className="h-4 w-4" />}
              {actionType === 'Borrow'   && <Banknote className="h-4 w-4" />}
              {actionType === 'Repay'    && <CornerUpLeft className="h-4 w-4" />}
              Review {actionType}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
