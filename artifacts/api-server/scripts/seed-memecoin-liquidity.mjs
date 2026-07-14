/**
 * seed-memecoin-liquidity.mjs
 *
 * Seeds initial liquidity into the CASHCAT/WETH and VIRTUAL/WETH pairs
 * on the Liquihood DEX. Since the deployer wallet has no CASHCAT or VIRTUAL,
 * this script first acquires small amounts via direct V2 pool swaps on the
 * external DEX already running on Robinhood Chain, then adds that liquidity
 * to our pairs.
 *
 * Strategy:
 *   1. Wrap ETH → WETH (WETH at the Robinhood Chain bridged address supports deposit())
 *   2. Buy CASHCAT via direct swap on external V2 pool (CASHCAT/WETH)
 *   3. Buy VIRTUAL via direct swap on external V2 pool (WETH/VIRTUAL)
 *   4. Approve + addLiquidity to our CASHCAT/WETH pair
 *   5. Approve + addLiquidity to our VIRTUAL/WETH pair
 *
 * Run from workspace root:
 *   cd artifacts/api-server && node scripts/seed-memecoin-liquidity.mjs
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const RPC_URL  = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;

// Token addresses
const WETH    = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const CASHCAT = '0x020bfC650A365f8BB26819deAAbF3E21291018b4';
const VIRTUAL = '0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31';

// External V2 pools on Robinhood Chain — found by scanning Transfer events.
// CASHCAT pool: token0=CASHCAT, token1=WETH
// VIRTUAL pool: token0=WETH,    token1=VIRTUAL
const CASHCAT_EXT_POOL = '0x0579fA41416101b66e202F66bF3B0de5101F5b9F';
const VIRTUAL_EXT_POOL = '0xd95e8e2Cd04c207625C6F23c974d365a5F3A91D3';

// Fraction of available ETH to reserve for gas (the rest gets wrapped)
const GAS_RESERVE_ETH  = 1_200_000_000_000_000n;  // 0.0012 ETH
// Fraction of wrapped WETH to use per acquisition (rest goes to LP)
const WETH_PER_BUY     = 2n;  // split WETH evenly: half buys, half seeds LP
// Minimum amounts we consider acceptable for a seed (1 CASHCAT, 0.1 VIRTUAL)
const MIN_CASHCAT      = 1_000_000_000_000_000_000n;  // 1 CASHCAT
const MIN_VIRTUAL      = 100_000_000_000_000_000n;    // 0.1 VIRTUAL

const chain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const WETH_ABI = parseAbi([
  'function deposit() payable',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const PAIR_ABI = parseAbi([
  'function getReserves() view returns (uint112 r0, uint112 r1, uint32 ts)',
  'function token0() view returns (address)',
  'function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data)',
]);

const ROUTER_ABI = parseAbi([
  'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
]);

const FACTORY_ABI = parseAbi([
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

async function sendTx(label, walletClient, publicClient, opts) {
  process.stdout.write(`⏳ ${label}...`);
  const hash    = await walletClient.writeContract(opts);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(` ✅ block ${receipt.blockNumber} | ${hash}`);
  return receipt;
}

/** UniswapV2 constant-product amountOut (with 0.3% fee). */
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator       = amountInWithFee * reserveOut;
  const denominator     = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const account      = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  console.log('Deployer:', account.address);

  // Load our DEX router + our pair addresses
  const dex   = JSON.parse(readFileSync(resolve(__dirname, '../../../contracts/deployments/dex.json'), 'utf8'));
  const pairs = JSON.parse(readFileSync(resolve(__dirname, '../../../contracts/deployments/pairs.json'), 'utf8'));
  const ROUTER         = dex.router;
  const OUR_FACTORY    = dex.factory;
  const OUR_CC_PAIR    = pairs.pairs['CASHCAT/WETH'];
  const OUR_VIRT_PAIR  = pairs.pairs['VIRTUAL/WETH'];

  console.log('Our Router:         ', ROUTER);
  console.log('Our CASHCAT/WETH:   ', OUR_CC_PAIR);
  console.log('Our VIRTUAL/WETH:   ', OUR_VIRT_PAIR);

  // ── Step 0: Check current state ──────────────────────────────────────────────

  const [ethBal, wethBal, cashcatBal, virtualBal] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({ address: WETH,    abi: WETH_ABI,  functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: CASHCAT, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: VIRTUAL, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
  ]);

  console.log('\n── Balances ──');
  console.log(`  ETH:     ${(Number(ethBal)    / 1e18).toFixed(6)}`);
  console.log(`  WETH:    ${(Number(wethBal)   / 1e18).toFixed(6)}`);
  console.log(`  CASHCAT: ${(Number(cashcatBal)/ 1e18).toFixed(4)}`);
  console.log(`  VIRTUAL: ${(Number(virtualBal)/ 1e18).toFixed(4)}`);

  // Check if our pairs already have liquidity
  const [ccPairReserves, virtPairReserves] = await Promise.all([
    publicClient.readContract({ address: OUR_CC_PAIR,   abi: PAIR_ABI, functionName: 'getReserves' }).catch(() => [0n, 0n, 0]),
    publicClient.readContract({ address: OUR_VIRT_PAIR, abi: PAIR_ABI, functionName: 'getReserves' }).catch(() => [0n, 0n, 0]),
  ]);

  const ccHasLiquidity   = ccPairReserves[0] > 0n || ccPairReserves[1] > 0n;
  const virtHasLiquidity = virtPairReserves[0] > 0n || virtPairReserves[1] > 0n;

  if (ccHasLiquidity && virtHasLiquidity) {
    console.log('\n✅ Both pairs already have liquidity. Nothing to do.');
    console.log(`  CASHCAT/WETH reserves: ${(Number(ccPairReserves[0])/1e18).toFixed(4)} / ${(Number(ccPairReserves[1])/1e18).toFixed(6)}`);
    console.log(`  VIRTUAL/WETH reserves: ${(Number(virtPairReserves[0])/1e18).toFixed(4)} / ${(Number(virtPairReserves[1])/1e18).toFixed(6)}`);
    return;
  }

  // ── Step 1: Wrap ETH → WETH ──────────────────────────────────────────────────

  let totalWeth = wethBal;

  if (ethBal > GAS_RESERVE_ETH + 1_000_000_000_000n) {
    const wrapAmount = ethBal - GAS_RESERVE_ETH;
    console.log(`\n── Wrapping ${(Number(wrapAmount)/1e18).toFixed(6)} ETH → WETH`);
    await sendTx('WETH.deposit', walletClient, publicClient, {
      address: WETH, abi: WETH_ABI, functionName: 'deposit', args: [], value: wrapAmount,
    });
    totalWeth = wethBal + wrapAmount;
    console.log(`  Total WETH after wrap: ${(Number(totalWeth)/1e18).toFixed(6)}`);
  } else if (totalWeth === 0n) {
    throw new Error(`Insufficient ETH (${(Number(ethBal)/1e18).toFixed(6)}) — need at least ${(Number(GAS_RESERVE_ETH)/1e18).toFixed(4)} for gas`);
  }

  // ── Step 2: Acquire CASHCAT via direct V2 pool swap ──────────────────────────
  // External CASHCAT V2 pool: token0=CASHCAT, token1=WETH

  let finalCashcatBal = cashcatBal;

  if (!ccHasLiquidity && cashcatBal < MIN_CASHCAT) {
    console.log('\n── Acquiring CASHCAT from external V2 pool');
    console.log(`  Pool: ${CASHCAT_EXT_POOL}`);

    const [ccExtR0, ccExtR1] = await publicClient.readContract({
      address: CASHCAT_EXT_POOL, abi: PAIR_ABI, functionName: 'getReserves',
    });
    console.log(`  Pool reserves: ${(Number(ccExtR0)/1e18).toFixed(4)} CASHCAT | ${(Number(ccExtR1)/1e18).toFixed(6)} WETH`);

    // Use half of total WETH for buying (leave other half for LP)
    const wethToBuy   = totalWeth / WETH_PER_BUY;
    // Protect against draining more than 95% of pool's CASHCAT reserve
    const maxCashcatOut = ccExtR0 * 95n / 100n;
    const rawCashcatOut = getAmountOut(wethToBuy, ccExtR1, ccExtR0);
    const cashcatOut    = rawCashcatOut > maxCashcatOut ? maxCashcatOut : rawCashcatOut;

    console.log(`  Spending: ${(Number(wethToBuy)/1e18).toFixed(6)} WETH`);
    console.log(`  Expected: ${(Number(cashcatOut)/1e18).toFixed(4)} CASHCAT`);

    if (cashcatOut === 0n) throw new Error('CASHCAT pool too empty — cannot acquire tokens');

    // Transfer WETH to the pool, then call swap
    await sendTx('WETH.transfer→CASHCAT pool', walletClient, publicClient, {
      address: WETH, abi: WETH_ABI, functionName: 'transfer',
      args: [CASHCAT_EXT_POOL, wethToBuy],
    });

    await sendTx('CASHCAT pool.swap', walletClient, publicClient, {
      address: CASHCAT_EXT_POOL, abi: PAIR_ABI, functionName: 'swap',
      // token0=CASHCAT → amount0Out, token1=WETH → amount1Out=0
      args: [cashcatOut, 0n, account.address, '0x'],
    });

    finalCashcatBal = await publicClient.readContract({
      address: CASHCAT, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    });
    console.log(`  ✅ CASHCAT balance now: ${(Number(finalCashcatBal)/1e18).toFixed(4)}`);
    totalWeth -= wethToBuy;
  } else {
    console.log(`\n── CASHCAT: using existing balance (${(Number(cashcatBal)/1e18).toFixed(4)})`);
  }

  // ── Step 3: Acquire VIRTUAL via direct V2 pool swap ──────────────────────────
  // External VIRTUAL V2 pool: token0=WETH, token1=VIRTUAL

  let finalVirtualBal = virtualBal;

  if (!virtHasLiquidity && virtualBal < MIN_VIRTUAL) {
    console.log('\n── Acquiring VIRTUAL from external V2 pool');
    console.log(`  Pool: ${VIRTUAL_EXT_POOL}`);

    const [virtExtR0, virtExtR1] = await publicClient.readContract({
      address: VIRTUAL_EXT_POOL, abi: PAIR_ABI, functionName: 'getReserves',
    });
    console.log(`  Pool reserves: ${(Number(virtExtR0)/1e18).toFixed(4)} WETH | ${(Number(virtExtR1)/1e18).toFixed(2)} VIRTUAL`);

    // Use half the remaining WETH for buying
    const wethToBuy   = totalWeth / WETH_PER_BUY;
    const virtualOut  = getAmountOut(wethToBuy, virtExtR0, virtExtR1);

    console.log(`  Spending: ${(Number(wethToBuy)/1e18).toFixed(6)} WETH`);
    console.log(`  Expected: ${(Number(virtualOut)/1e18).toFixed(4)} VIRTUAL`);

    if (virtualOut === 0n) throw new Error('VIRTUAL pool empty — cannot acquire tokens');

    await sendTx('WETH.transfer→VIRTUAL pool', walletClient, publicClient, {
      address: WETH, abi: WETH_ABI, functionName: 'transfer',
      args: [VIRTUAL_EXT_POOL, wethToBuy],
    });

    await sendTx('VIRTUAL pool.swap', walletClient, publicClient, {
      address: VIRTUAL_EXT_POOL, abi: PAIR_ABI, functionName: 'swap',
      // token0=WETH → amount0Out=0, token1=VIRTUAL → amount1Out
      args: [0n, virtualOut, account.address, '0x'],
    });

    finalVirtualBal = await publicClient.readContract({
      address: VIRTUAL, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    });
    console.log(`  ✅ VIRTUAL balance now: ${(Number(finalVirtualBal)/1e18).toFixed(4)}`);
    totalWeth -= wethToBuy;
  } else {
    console.log(`\n── VIRTUAL: using existing balance (${(Number(virtualBal)/1e18).toFixed(4)})`);
  }

  // ── Step 4: Refresh WETH balance and plan LP amounts ──────────────────────────

  const wethNow = await publicClient.readContract({
    address: WETH, abi: WETH_ABI, functionName: 'balanceOf', args: [account.address],
  });
  console.log(`\n── WETH for LP: ${(Number(wethNow)/1e18).toFixed(6)}`);

  if (wethNow === 0n) throw new Error('No WETH left for LP seeding');

  // Split remaining WETH between pairs (or use all for one if the other already has liquidity)
  let wethForCc   = !ccHasLiquidity   ? wethNow / 2n : 0n;
  let wethForVirt = !virtHasLiquidity ? wethNow - wethForCc : 0n;

  if (!ccHasLiquidity && !virtHasLiquidity) {
    wethForCc   = wethNow / 2n;
    wethForVirt = wethNow - wethForCc;
  } else if (!ccHasLiquidity) {
    wethForCc   = wethNow;
    wethForVirt = 0n;
  } else if (!virtHasLiquidity) {
    wethForVirt = wethNow;
    wethForCc   = 0n;
  }

  // ── Step 5: Add CASHCAT/WETH liquidity ───────────────────────────────────────

  if (!ccHasLiquidity) {
    console.log('\n── Adding CASHCAT/WETH liquidity to our DEX');

    if (finalCashcatBal < MIN_CASHCAT) {
      console.log('  ⚠️  Insufficient CASHCAT — skipping. Run script again after acquiring tokens.');
    } else {
      // Use all available CASHCAT and proportional WETH
      const cashcatForLp = finalCashcatBal;
      const wethForLp    = wethForCc < wethNow ? wethForCc : wethNow;

      console.log(`  CASHCAT: ${(Number(cashcatForLp)/1e18).toFixed(4)}`);
      console.log(`  WETH:    ${(Number(wethForLp)/1e18).toFixed(6)}`);

      await sendTx('approve CASHCAT→Router', walletClient, publicClient, {
        address: CASHCAT, abi: ERC20_ABI, functionName: 'approve', args: [ROUTER, cashcatForLp],
      });
      await sendTx('approve WETH→Router', walletClient, publicClient, {
        address: WETH, abi: WETH_ABI, functionName: 'approve', args: [ROUTER, wethForLp],
      });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      await sendTx('addLiquidity CASHCAT/WETH', walletClient, publicClient, {
        address: ROUTER, abi: ROUTER_ABI, functionName: 'addLiquidity',
        args: [CASHCAT, WETH, cashcatForLp, wethForLp, 1n, 1n, account.address, deadline],
      });

      const [r0, r1] = await publicClient.readContract({
        address: OUR_CC_PAIR, abi: PAIR_ABI, functionName: 'getReserves',
      });
      console.log(`  ✅ CASHCAT/WETH pair seeded: ${(Number(r0)/1e18).toFixed(4)} CASHCAT | ${(Number(r1)/1e18).toFixed(6)} WETH`);
    }
  } else {
    console.log('\n── CASHCAT/WETH pair already has liquidity — skipped');
  }

  // ── Step 6: Add VIRTUAL/WETH liquidity ───────────────────────────────────────

  if (!virtHasLiquidity) {
    console.log('\n── Adding VIRTUAL/WETH liquidity to our DEX');

    if (finalVirtualBal < MIN_VIRTUAL) {
      console.log('  ⚠️  Insufficient VIRTUAL — skipping. Run script again after acquiring tokens.');
    } else {
      const virtualForLp = finalVirtualBal;
      const wethForLp    = wethForVirt;

      console.log(`  VIRTUAL: ${(Number(virtualForLp)/1e18).toFixed(4)}`);
      console.log(`  WETH:    ${(Number(wethForLp)/1e18).toFixed(6)}`);

      await sendTx('approve VIRTUAL→Router', walletClient, publicClient, {
        address: VIRTUAL, abi: ERC20_ABI, functionName: 'approve', args: [ROUTER, virtualForLp],
      });

      // Re-approve WETH (may need more after previous step)
      const freshWeth = await publicClient.readContract({
        address: WETH, abi: WETH_ABI, functionName: 'balanceOf', args: [account.address],
      });
      const wethActual = freshWeth < wethForLp ? freshWeth : wethForLp;

      await sendTx('approve WETH→Router', walletClient, publicClient, {
        address: WETH, abi: WETH_ABI, functionName: 'approve', args: [ROUTER, wethActual],
      });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      await sendTx('addLiquidity VIRTUAL/WETH', walletClient, publicClient, {
        address: ROUTER, abi: ROUTER_ABI, functionName: 'addLiquidity',
        args: [VIRTUAL, WETH, virtualForLp, wethActual, 1n, 1n, account.address, deadline],
      });

      const [r0, r1] = await publicClient.readContract({
        address: OUR_CC_PAIR.toLowerCase() < VIRTUAL.toLowerCase() ? OUR_VIRT_PAIR : OUR_VIRT_PAIR,
        abi: PAIR_ABI, functionName: 'getReserves',
      });
      console.log(`  ✅ VIRTUAL/WETH pair seeded`);
    }
  } else {
    console.log('\n── VIRTUAL/WETH pair already has liquidity — skipped');
  }

  console.log('\n🎉 Liquidity seeding complete!');
  console.log('   CASHCAT/WETH pair:', OUR_CC_PAIR);
  console.log('   VIRTUAL/WETH pair:', OUR_VIRT_PAIR);
  console.log('\nThe liquidation bot can now swap seized CASHCAT and VIRTUAL → USDG.');
}

main().catch(e => {
  console.error('\nFAILED:', e.shortMessage ?? e.message ?? e);
  process.exit(1);
});
