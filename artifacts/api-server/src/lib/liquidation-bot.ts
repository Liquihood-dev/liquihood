/**
 * liquidation-bot.ts
 *
 * Background liquidation bot for the Liquihood protocol.
 *
 * Lifecycle:
 *   1. Every SCAN_INTERVAL_MS (30s): discover all active borrowers via on-chain
 *      Borrow events (cached, incremental).
 *   2. For each borrower: call LendingPool.getHealthFactor(). If HF < 1e27 →
 *      position is undercollateralised, execute liquidation.
 *   3. Liquidation: repay the borrower's largest debt asset (up to 50% close
 *      factor, capped at bot's balance), seize their largest collateral.
 *   4. Post-liquidation swap: swap the seized collateral → USDG via the
 *      Liquihood DEX (UniswapV2Router02) so the bot is self-sustaining.
 *
 * Required environment variables:
 *   - DEPLOYER_PRIVATE_KEY  — the bot's signing key (same as price keeper)
 *
 * Optional — bot skips gracefully if DEX not yet deployed:
 *   - dex.json / pairs.json in contracts/deployments/
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Chain ────────────────────────────────────────────────────────────────────

const RPC_URL  = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;

const robinhoodChain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

// ─── Protocol addresses ───────────────────────────────────────────────────────

const LENDING_POOL = '0xcf689f3eFAbCE22A0f29FE0D47A5fd5d6e7e7291' as `0x${string}`;
const USDG_ADDR    = '0x1FaD69eaf1f4E9d9470787f51D458A93464833F6' as `0x${string}`;
const WETH_ADDR    = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as `0x${string}`;
const CASHCAT_ADDR = '0x020bfC650A365f8BB26819deAAbF3E21291018b4' as `0x${string}`;
const VIRTUAL_ADDR = '0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31' as `0x${string}`;

const SCAN_INTERVAL_MS = 30_000; // 30 seconds

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const LP_ABI = parseAbi([
  'function getHealthFactor(address _user) view returns (uint256)',
  'function getReserveList() view returns (address[])',
  'function getUserDebt(address _user, address _asset) view returns (uint256)',
  'function getUserCollateral(address _user, address _asset) view returns (uint256)',
  'function liquidate(address _borrower, address _debtAsset, address _collateralAsset, uint256 _debtAmountToRepay)',
  'event Borrow(address indexed user, address indexed asset, uint256 amount)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

const ROUTER_ABI = parseAbi([
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
]);

// ─── Deployment loaders ───────────────────────────────────────────────────────

interface DexDeployment {
  factory: string;
  router: string;
}

interface PairsDeployment {
  pairs: Record<string, string>;
}

interface FlashLiquidatorDeployment {
  address: string;
}

function loadDexAddresses(): DexDeployment | null {
  const p = resolve(__dirname, '../../../contracts/deployments/dex.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as DexDeployment;
  } catch {
    return null;
  }
}

function loadPairs(): PairsDeployment | null {
  const p = resolve(__dirname, '../../../contracts/deployments/pairs.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as PairsDeployment;
  } catch {
    return null;
  }
}

function loadFlashLiquidator(): FlashLiquidatorDeployment | null {
  const p = resolve(__dirname, '../../../contracts/deployments/flash-liquidator.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as FlashLiquidatorDeployment;
  } catch {
    return null;
  }
}

// ─── Swap paths (collateral → USDG) ──────────────────────────────────────────
// Single-hop for WETH, two-hop via WETH for CASHCAT and VIRTUAL.
// Stock tokens (AAPL, AMZN, etc.) have no DEX pair yet — bot holds them.

function getSwapPath(collateral: `0x${string}`): `0x${string}`[] | null {
  const lc = collateral.toLowerCase();
  if (lc === WETH_ADDR.toLowerCase())    return [WETH_ADDR,    USDG_ADDR];
  if (lc === CASHCAT_ADDR.toLowerCase()) return [CASHCAT_ADDR, WETH_ADDR, USDG_ADDR];
  if (lc === VIRTUAL_ADDR.toLowerCase()) return [VIRTUAL_ADDR, WETH_ADDR, USDG_ADDR];
  if (lc === USDG_ADDR.toLowerCase())    return null; // already USDG
  return null; // no path known — hold token
}

// ─── Flash Liquidator ABI + path selection ────────────────────────────────────

// FlashLiquidator.flashLiquidate accepts a FlashParams tuple (one struct arg)
// to keep the Solidity function body under the EVM's 16-slot stack limit.
const FLASH_LIQUIDATOR_ABI = parseAbi([
  'function flashLiquidate((address borrower, address debtAsset, address collateralAsset, uint256 debtAmount, address flashPair, address repayToken, address[] swapPath) p)',
]);

/**
 * Returns the flash pair address, repayToken, and swap path needed for a
 * flash-loan liquidation.
 *
 * Key design: we flash-borrow debtAsset (USDG) from the WETH/USDG pair and
 * REPAY IN WETH (the other token in the pair). This avoids all reentrancy
 * issues — the WETH/USDG pair is locked during the callback, but we never
 * call back into it because:
 *   - WETH collateral → repay WETH directly, no swap needed
 *   - CASHCAT collateral → swap CASHCAT→WETH via CASHCAT/WETH pair (not locked)
 *   - VIRTUAL collateral → swap VIRTUAL→WETH via VIRTUAL/WETH pair (not locked)
 *
 * swapPath is collateral → ... → repayToken (WETH), or [] when collateral IS WETH.
 */
function getFlashPath(
  collateral: `0x${string}`,
  debtAsset:  `0x${string}`,
  pairAddresses: Record<string, string>,
): { pair: `0x${string}`; repayToken: `0x${string}`; swapPath: `0x${string}`[] } | null {
  // Only USDG debt supported; WETH/USDG pair is the flash source
  if (debtAsset.toLowerCase() !== USDG_ADDR.toLowerCase()) return null;

  const wethUsdgPair = pairAddresses['WETH/USDG'] as `0x${string}` | undefined;
  if (!wethUsdgPair) return null;

  const lc = collateral.toLowerCase();

  // WETH collateral: repay directly with WETH, no swap (collateral IS repayToken)
  if (lc === WETH_ADDR.toLowerCase()) {
    return { pair: wethUsdgPair, repayToken: WETH_ADDR, swapPath: [] };
  }

  // CASHCAT: swap CASHCAT→WETH via CASHCAT/WETH pair (not locked), repay with WETH
  if (lc === CASHCAT_ADDR.toLowerCase()) {
    return { pair: wethUsdgPair, repayToken: WETH_ADDR, swapPath: [CASHCAT_ADDR, WETH_ADDR] };
  }

  // VIRTUAL: swap VIRTUAL→WETH via VIRTUAL/WETH pair (not locked), repay with WETH
  if (lc === VIRTUAL_ADDR.toLowerCase()) {
    return { pair: wethUsdgPair, repayToken: WETH_ADDR, swapPath: [VIRTUAL_ADDR, WETH_ADDR] };
  }

  return null;
}

// ─── Borrow event definition (explicit — never index into ABI arrays) ─────────

const BORROW_EVENT = parseAbiItem(
  'event Borrow(address indexed user, address indexed asset, uint256 amount)'
);

// LendingPool v2 was deployed 2026-07-14; start scanning from just before that.
// Avoids genesis-range queries (block 0 → current) which can time out on RPCs.
const LENDING_POOL_DEPLOY_BLOCK = 9_400_000n;

// Maximum blocks to scan per cycle — keeps individual getLogs calls cheap.
const MAX_BLOCKS_PER_SCAN = 2_000n;

// ─── Borrower cache ───────────────────────────────────────────────────────────

const knownBorrowers = new Set<`0x${string}`>();
let lastScannedBlock = 0n; // 0 = "use LENDING_POOL_DEPLOY_BLOCK on first run"

async function refreshBorrowers(
  publicClient: ReturnType<typeof createPublicClient>,
): Promise<void> {
  try {
    const latest = await publicClient.getBlockNumber();

    // On the first call, start from the deployment block rather than genesis.
    const fromBlock = lastScannedBlock > 0n
      ? lastScannedBlock + 1n
      : LENDING_POOL_DEPLOY_BLOCK;

    // Cap the range so a single getLogs call never covers more than MAX_BLOCKS_PER_SCAN.
    const toBlock = fromBlock + MAX_BLOCKS_PER_SCAN < latest
      ? fromBlock + MAX_BLOCKS_PER_SCAN
      : latest;

    if (fromBlock > latest) return; // nothing new to scan

    const logs = await publicClient.getLogs({
      address: LENDING_POOL,
      event:   BORROW_EVENT,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const user = (log as any).args?.user as `0x${string}` | undefined;
      if (user) knownBorrowers.add(user.toLowerCase() as `0x${string}`);
    }

    lastScannedBlock = toBlock;
    logger.debug(
      { from: fromBlock.toString(), to: toBlock.toString(), newBorrowers: logs.length, total: knownBorrowers.size },
      'liq-bot: borrower scan complete',
    );
  } catch (e: any) {
    logger.warn({ err: e?.message ?? String(e) }, 'liq-bot: failed to scan Borrow events');
  }
}

// ─── Core liquidation logic ───────────────────────────────────────────────────

async function attemptLiquidation(
  borrower: `0x${string}`,
  botAddress: `0x${string}`,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  dex: DexDeployment | null,
  flashLiquidator: FlashLiquidatorDeployment | null,
  pairs: PairsDeployment | null,
): Promise<void> {
  // 1. Re-confirm HF is still < 1 (prices might have changed)
  const hf = await publicClient.readContract({
    address: LENDING_POOL,
    abi: LP_ABI,
    functionName: 'getHealthFactor',
    args: [borrower],
  }) as bigint;

  if (hf >= BigInt('1000000000000000000000000000')) {
    // HF recovered — no longer liquidatable
    return;
  }

  logger.info({ borrower, hf: hf.toString() }, 'liq-bot: position liquidatable — finding best positions');

  // 2. Get all reserves to scan positions
  const reserves = await publicClient.readContract({
    address: LENDING_POOL,
    abi: LP_ABI,
    functionName: 'getReserveList',
  }) as `0x${string}`[];

  // 3. Find largest debt and collateral positions
  let bestDebtAsset: `0x${string}` | null = null;
  let bestDebtAmount = 0n;
  let bestCollateralAsset: `0x${string}` | null = null;
  let bestCollateralAmount = 0n;

  for (const asset of reserves) {
    const [debt, col] = await Promise.all([
      publicClient.readContract({ address: LENDING_POOL, abi: LP_ABI, functionName: 'getUserDebt',       args: [borrower, asset] }) as Promise<bigint>,
      publicClient.readContract({ address: LENDING_POOL, abi: LP_ABI, functionName: 'getUserCollateral', args: [borrower, asset] }) as Promise<bigint>,
    ]);

    if (debt > bestDebtAmount)      { bestDebtAmount = debt; bestDebtAsset = asset; }
    if (col  > bestCollateralAmount) { bestCollateralAmount = col;  bestCollateralAsset = asset; }
  }

  if (!bestDebtAsset || !bestCollateralAsset || bestDebtAmount === 0n) {
    logger.info({ borrower }, 'liq-bot: no valid debt/collateral found — skipping');
    return;
  }

  // 4. Calculate repay amount: min(50% of debt, bot's balance of debtAsset)
  const maxByCloseFactor = (bestDebtAmount * 5n) / 10n;
  const botDebtBalance = await publicClient.readContract({
    address: bestDebtAsset,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [botAddress],
  }) as bigint;

  const directRepayAmount = maxByCloseFactor < botDebtBalance ? maxByCloseFactor : botDebtBalance;

  // 4a. If bot has insufficient direct balance, try flash liquidation first.
  if (directRepayAmount < maxByCloseFactor && flashLiquidator && pairs) {
    const flashPath = getFlashPath(bestCollateralAsset, bestDebtAsset, pairs.pairs);
    if (flashPath) {
      logger.info({
        borrower,
        debtAsset:       bestDebtAsset,
        collateralAsset: bestCollateralAsset,
        debtAmount:      formatUnits(maxByCloseFactor, 18),
        flashPair:       flashPath.pair,
        repayToken:      flashPath.repayToken,
      }, 'liq-bot: insufficient balance — attempting flash liquidation');

      try {
        const flashTx = await (walletClient as any).writeContract({
          address:      flashLiquidator.address as `0x${string}`,
          abi:          FLASH_LIQUIDATOR_ABI,
          functionName: 'flashLiquidate',
          // Pass as a tuple struct matching FlashParams in the contract
          args:         [{
            borrower,
            debtAsset:       bestDebtAsset,
            collateralAsset: bestCollateralAsset,
            debtAmount:      maxByCloseFactor,
            flashPair:       flashPath.pair,
            repayToken:      flashPath.repayToken,
            swapPath:        flashPath.swapPath,
          }],
        });
        const flashReceipt = await publicClient.waitForTransactionReceipt({ hash: flashTx as `0x${string}` });
        logger.info({
          borrower,
          txHash:      flashTx,
          blockNumber: flashReceipt.blockNumber.toString(),
        }, 'liq-bot: flash liquidation successful');
        return; // done — flash tx covered the full close factor
      } catch (e: any) {
        logger.warn({
          borrower,
          err: e?.shortMessage ?? e?.message ?? String(e),
        }, 'liq-bot: flash liquidation failed — falling back to direct liquidation');
        // Fall through to direct liquidation with whatever balance we have
      }
    }
  }

  const repayAmount = directRepayAmount;

  if (repayAmount === 0n) {
    logger.warn({ borrower, debtAsset: bestDebtAsset }, 'liq-bot: bot has zero balance of debt asset — cannot liquidate');
    return;
  }

  // 5. Approve debt asset to LendingPool
  const allowance = await publicClient.readContract({
    address: bestDebtAsset,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [botAddress, LENDING_POOL],
  }) as bigint;

  if (allowance < repayAmount) {
    logger.info({ debtAsset: bestDebtAsset }, 'liq-bot: approving debt asset');
    const approveTx = await (walletClient as any).writeContract({
      address: bestDebtAsset,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LENDING_POOL, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // 6. Execute liquidation
  logger.info({
    borrower,
    debtAsset: bestDebtAsset,
    collateralAsset: bestCollateralAsset,
    repayAmount: formatUnits(repayAmount, 18),
  }, 'liq-bot: executing liquidation');

  let liqTx: `0x${string}`;
  try {
    liqTx = await (walletClient as any).writeContract({
      address: LENDING_POOL,
      abi: LP_ABI,
      functionName: 'liquidate',
      args: [borrower, bestDebtAsset, bestCollateralAsset, repayAmount],
    });
  } catch (e: any) {
    logger.error({ borrower, err: e?.shortMessage ?? e?.message ?? String(e) }, 'liq-bot: liquidation tx failed');
    return;
  }

  const liqReceipt = await publicClient.waitForTransactionReceipt({ hash: liqTx });
  logger.info({ borrower, txHash: liqTx, blockNumber: liqReceipt.blockNumber.toString() }, 'liq-bot: liquidation successful');

  // 7. Post-liquidation: swap seized collateral → USDG via DEX (if available)
  if (!dex?.router) {
    logger.info({ collateral: bestCollateralAsset }, 'liq-bot: no DEX router — holding seized collateral');
    return;
  }

  const swapPath = getSwapPath(bestCollateralAsset);
  if (!swapPath) {
    logger.info({ collateral: bestCollateralAsset }, 'liq-bot: no swap path for collateral — holding token');
    return;
  }

  // Check how much collateral we received
  const seizedBalance = await publicClient.readContract({
    address: bestCollateralAsset,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [botAddress],
  }) as bigint;

  if (seizedBalance === 0n) return;

  // Check expected USDG output (slippage: accept min 90%)
  let amountOutMin = 0n;
  try {
    const amounts = await publicClient.readContract({
      address: dex.router as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [seizedBalance, swapPath],
    }) as bigint[];
    amountOutMin = (amounts[amounts.length - 1] * 90n) / 100n; // 10% slippage
  } catch {
    // Pool might have no liquidity — proceed with amountOutMin=0 (accept any output)
    amountOutMin = 0n;
  }

  // Approve collateral to Router
  const colAllowance = await publicClient.readContract({
    address: bestCollateralAsset,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [botAddress, dex.router as `0x${string}`],
  }) as bigint;

  if (colAllowance < seizedBalance) {
    const appTx = await (walletClient as any).writeContract({
      address: bestCollateralAsset,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [dex.router as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
    await publicClient.waitForTransactionReceipt({ hash: appTx });
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

  try {
    const swapTx = await (walletClient as any).writeContract({
      address: dex.router as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [seizedBalance, amountOutMin, swapPath, botAddress, deadline],
    });
    const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
    logger.info({
      collateral: bestCollateralAsset,
      amountIn: formatUnits(seizedBalance, 18),
      txHash: swapTx,
      blockNumber: swapReceipt.blockNumber.toString(),
    }, 'liq-bot: swapped collateral → USDG');
  } catch (e: any) {
    logger.warn({ err: e?.shortMessage ?? e?.message ?? String(e) }, 'liq-bot: swap failed — holding collateral');
  }
}

// ─── Main scan loop ───────────────────────────────────────────────────────────

async function runLiquidationScan(
  botKey: `0x${string}`,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  dex: DexDeployment | null,
  flashLiquidator: FlashLiquidatorDeployment | null,
  pairs: PairsDeployment | null,
): Promise<void> {
  const botAddress = privateKeyToAccount(botKey).address;

  // Refresh borrower list incrementally
  await refreshBorrowers(publicClient);

  if (knownBorrowers.size === 0) {
    logger.debug('liq-bot: no known borrowers yet');
    return;
  }

  logger.debug({ count: knownBorrowers.size }, 'liq-bot: scanning borrowers');

  // Check health factors in parallel (batched)
  const borrowerList = [...knownBorrowers];
  const hfResults = await Promise.allSettled(
    borrowerList.map(borrower =>
      publicClient.readContract({
        address: LENDING_POOL,
        abi: LP_ABI,
        functionName: 'getHealthFactor',
        args: [borrower as `0x${string}`],
      })
    )
  );

  const RAY = BigInt('1000000000000000000000000000'); // 1e27

  for (let i = 0; i < borrowerList.length; i++) {
    const result = hfResults[i];
    if (result.status !== 'fulfilled') continue;

    const hf = result.value as bigint;
    if (hf >= RAY) continue; // healthy

    logger.info({ borrower: borrowerList[i], hf: hf.toString() }, 'liq-bot: unhealthy position detected');

    await attemptLiquidation(
      borrowerList[i] as `0x${string}`,
      botAddress,
      publicClient,
      walletClient,
      dex,
      flashLiquidator,
      pairs,
    ).catch((e: any) => {
      logger.error({ borrower: borrowerList[i], err: e?.message ?? String(e) }, 'liq-bot: unexpected error during liquidation');
    });
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

let botStarted = false;

export function startLiquidationBot(): void {
  if (botStarted) return;
  botStarted = true;

  const pk = process.env['DEPLOYER_PRIVATE_KEY'];
  if (!pk) {
    logger.warn('liq-bot: DEPLOYER_PRIVATE_KEY not set — liquidation bot disabled');
    return;
  }

  const botKey         = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
  const dex            = loadDexAddresses();
  const pairs          = loadPairs();
  const flashLiquidator = loadFlashLiquidator();

  if (dex) {
    logger.info({ factory: dex.factory, router: dex.router }, 'liq-bot: DEX loaded');
  } else {
    logger.warn('liq-bot: dex.json not found — post-liquidation swap step will be skipped');
  }

  if (flashLiquidator) {
    logger.info({ address: flashLiquidator.address }, 'liq-bot: FlashLiquidator loaded — capital-free liquidations enabled');
  } else {
    logger.warn('liq-bot: flash-liquidator.json not found — falling back to direct liquidation only');
  }

  const account      = privateKeyToAccount(botKey);
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });

  logger.info({ address: account.address, intervalSec: SCAN_INTERVAL_MS / 1000 }, 'liq-bot: liquidation bot started');

  // Delay first scan 60 s to let the keeper warm up first
  setTimeout(async () => {
    await runLiquidationScan(botKey, publicClient, walletClient, dex, flashLiquidator, pairs).catch((e: any) => {
      logger.error({ err: e?.message ?? String(e) }, 'liq-bot: scan error (initial)');
    });
    setInterval(async () => {
      await runLiquidationScan(botKey, publicClient, walletClient, dex, flashLiquidator, pairs).catch((e: any) => {
        logger.error({ err: e?.message ?? String(e) }, 'liq-bot: scan error');
      });
    }, SCAN_INTERVAL_MS);
  }, 60_000);
}
