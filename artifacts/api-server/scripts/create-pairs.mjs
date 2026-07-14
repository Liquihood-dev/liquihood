/**
 * create-pairs.mjs
 *
 * Creates UniswapV2 pairs and seeds initial liquidity on Robinhood Chain.
 * Reads DEX addresses from contracts/deployments/dex.json.
 * Saves pair addresses to contracts/deployments/pairs.json.
 *
 * Pairs created:
 *   1. WETH / USDG   — main stable pair, enables WETH → USDG swaps
 *   2. CASHCAT / WETH — memecoin pair, enables CASHCAT → WETH → USDG 2-hop
 *   3. VIRTUAL / WETH — DeFi token pair, enables VIRTUAL → WETH → USDG 2-hop
 *
 * Run from the workspace root:
 *   cd artifacts/api-server && node scripts/create-pairs.mjs
 *
 * Requires: DEPLOYER_PRIVATE_KEY env var and contracts/deployments/dex.json
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const RPC_URL  = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;

// Token addresses
const USDG    = '0x1FaD69eaf1f4E9d9470787f51D458A93464833F6';
const WETH    = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const CASHCAT = '0x020bfC650A365f8BB26819deAAbF3E21291018b4';
const VIRTUAL = '0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31';

// Initial liquidity amounts (small seed to establish price)
// Prices: WETH ≈ $2500, CASHCAT ≈ $0.18, VIRTUAL ≈ $2.00
const LIQUIDITY = {
  'WETH/USDG': {
    tokenA: WETH,    amountA: 4_000_000_000_000_000n,      // 0.004 WETH (~$10)
    tokenB: USDG,    amountB: 10_000_000_000_000_000_000n, // 10 USDG
  },
  'CASHCAT/WETH': {
    tokenA: CASHCAT, amountA: 100_000_000_000_000_000_000n, // 100 CASHCAT (~$18)
    tokenB: WETH,    amountB: 7_000_000_000_000_000n,       // 0.007 WETH (~$17.5)
  },
  'VIRTUAL/WETH': {
    tokenA: VIRTUAL, amountA: 5_000_000_000_000_000_000n,   // 5 VIRTUAL (~$10)
    tokenB: WETH,    amountB: 4_000_000_000_000_000n,       // 0.004 WETH (~$10)
  },
};

const chain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const FACTORY_ABI = parseAbi([
  'function createPair(address tokenA, address tokenB) returns (address pair)',
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
]);

const ROUTER_ABI = parseAbi([
  'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

async function send(label, walletClient, publicClient, address, abi, functionName, args) {
  process.stdout.write(`⏳ ${label}...`);
  const hash    = await walletClient.writeContract({ address, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(` ✅ block ${receipt.blockNumber} | ${hash}`);
  return receipt;
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const account      = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  console.log('Deployer:', account.address);

  // Load DEX addresses
  const dexPath = resolve(__dirname, '../../../contracts/deployments/dex.json');
  const dex     = JSON.parse(readFileSync(dexPath, 'utf8'));
  const { factory: FACTORY, router: ROUTER } = dex;
  console.log('Factory:', FACTORY);
  console.log('Router: ', ROUTER);

  const pairs = {};

  for (const [pairName, liq] of Object.entries(LIQUIDITY)) {
    console.log(`\n── ${pairName} ─────────────────────────────────────────────`);

    // Check balances
    const [balA, balB] = await Promise.all([
      publicClient.readContract({ address: liq.tokenA, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
      publicClient.readContract({ address: liq.tokenB, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
    ]);
    console.log(`  Balance A: ${balA.toString()} (need ${liq.amountA.toString()})`);
    console.log(`  Balance B: ${balB.toString()} (need ${liq.amountB.toString()})`);

    if (balA < liq.amountA || balB < liq.amountB) {
      console.log(`  ⚠️  Insufficient balance for ${pairName} — checking if pair already exists`);

      // Check if pair was already created previously
      const existingPair = await publicClient.readContract({
        address: FACTORY,
        abi:     FACTORY_ABI,
        functionName: 'getPair',
        args:    [liq.tokenA, liq.tokenB],
      });
      if (existingPair !== '0x0000000000000000000000000000000000000000') {
        console.log(`  Pair already exists: ${existingPair}`);
        pairs[pairName] = existingPair;
      } else {
        // Create pair without liquidity (so the address is registered)
        await send(`createPair ${pairName}`, walletClient, publicClient, FACTORY, FACTORY_ABI, 'createPair', [liq.tokenA, liq.tokenB]);
        const pairAddr = await publicClient.readContract({
          address: FACTORY,
          abi:     FACTORY_ABI,
          functionName: 'getPair',
          args:    [liq.tokenA, liq.tokenB],
        });
        pairs[pairName] = pairAddr;
        console.log(`  ⚠️  Pair created at ${pairAddr} but has no liquidity (add manually)`);
      }
      continue;
    }

    // Create pair (no-op if already exists)
    const existingPair = await publicClient.readContract({
      address: FACTORY,
      abi:     FACTORY_ABI,
      functionName: 'getPair',
      args:    [liq.tokenA, liq.tokenB],
    });

    if (existingPair === '0x0000000000000000000000000000000000000000') {
      await send(`createPair ${pairName}`, walletClient, publicClient, FACTORY, FACTORY_ABI, 'createPair', [liq.tokenA, liq.tokenB]);
    } else {
      console.log(`  Pair already exists at ${existingPair}`);
    }

    // Approve tokens to Router
    await send(`approve tokenA`, walletClient, publicClient, liq.tokenA, ERC20_ABI, 'approve', [ROUTER, liq.amountA * 2n]);
    await send(`approve tokenB`, walletClient, publicClient, liq.tokenB, ERC20_ABI, 'approve', [ROUTER, liq.amountB * 2n]);

    // Add liquidity
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    await send(
      `addLiquidity ${pairName}`,
      walletClient, publicClient,
      ROUTER, ROUTER_ABI, 'addLiquidity',
      [liq.tokenA, liq.tokenB, liq.amountA, liq.amountB, 1n, 1n, account.address, deadline],
    );

    // Read final pair address
    const pairAddr = await publicClient.readContract({
      address: FACTORY,
      abi:     FACTORY_ABI,
      functionName: 'getPair',
      args:    [liq.tokenA, liq.tokenB],
    });
    pairs[pairName] = pairAddr;
    console.log(`  ✅ Pair: ${pairAddr}`);
  }

  // Save to pairs.json
  const deploymentsDir = resolve(__dirname, '../../../contracts/deployments');
  mkdirSync(deploymentsDir, { recursive: true });

  const pairsData = {
    network:    'Robinhood Chain',
    chainId:    CHAIN_ID,
    createdAt:  new Date().toISOString().slice(0, 10),
    factory:    FACTORY,
    router:     ROUTER,
    pairs,
  };

  writeFileSync(
    resolve(deploymentsDir, 'pairs.json'),
    JSON.stringify(pairsData, null, 2) + '\n',
  );

  console.log('\n🎉 Pairs created and saved to contracts/deployments/pairs.json');
  console.log(JSON.stringify(pairsData, null, 2));
}

main().catch(e => {
  console.error('FAILED:', e.shortMessage ?? e.message ?? e);
  process.exit(1);
});
