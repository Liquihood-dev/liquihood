/**
 * seed-weth-liquidity.mjs
 *
 * Wraps a small amount of ETH into WETH then seeds the WETH/USDG
 * liquidity pair on the Liquihood DEX. Reads dex.json and pairs.json.
 *
 * Run:  cd artifacts/api-server && node scripts/seed-weth-liquidity.mjs
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;
const WETH     = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const USDG     = '0x1FaD69eaf1f4E9d9470787f51D458A93464833F6';

const chain = {
  id: CHAIN_ID, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const WETH_ABI   = parseAbi(['function deposit() payable', 'function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)']);
const ERC20_ABI  = parseAbi(['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)']);
const ROUTER_ABI = parseAbi(['function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)']);

async function send(label, walletClient, publicClient, address, abi, functionName, args, value) {
  process.stdout.write(`⏳ ${label}...`);
  const hash = await walletClient.writeContract({ address, abi, functionName, args, ...(value ? { value } : {}) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(` ✅ block ${receipt.blockNumber} | ${hash.slice(0, 18)}...`);
  return receipt;
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const account      = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  const dex = JSON.parse(readFileSync(resolve(__dirname, '../../../contracts/deployments/dex.json'), 'utf8'));
  const ROUTER = dex.router;

  // Check current balances
  const [ethBal, wethBal, usdgBal] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({ address: WETH, abi: WETH_ABI, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: USDG, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
  ]);
  console.log('ETH:', (Number(ethBal) / 1e18).toFixed(6));
  console.log('WETH:', (Number(wethBal) / 1e18).toFixed(6));
  console.log('USDG:', (Number(usdgBal) / 1e18).toFixed(2));

  // Wrap ETH: keep 0.002 ETH for gas, wrap the rest (up to 0.003 ETH)
  const keepForGas = 2_000_000_000_000_000n; // 0.002 ETH
  let wrapAmount = ethBal > keepForGas + 500_000_000_000_000n
    ? (ethBal - keepForGas > 3_000_000_000_000_000n ? 3_000_000_000_000_000n : ethBal - keepForGas)
    : 0n;

  let totalWeth = wethBal;

  if (wrapAmount > 0n) {
    console.log(`\nWrapping ${(Number(wrapAmount) / 1e18).toFixed(6)} ETH → WETH`);
    await send('WETH.deposit', walletClient, publicClient, WETH, WETH_ABI, 'deposit', [], wrapAmount);
    totalWeth = wethBal + wrapAmount;
  } else if (wethBal === 0n) {
    console.log('⚠️  Not enough ETH to wrap and keep gas — skipping liquidity seeding');
    return;
  }

  // Seed liquidity: use all available WETH and proportional USDG
  // Price target: use actual WETH balance
  const wethForLp = totalWeth;
  // Assume WETH ≈ $2500; use a conservative 2000 USDG per WETH
  const usdgForLp = wethForLp * 2000n;  // integer mul (18-dec stays 18-dec since both are 18-dec)
  const usdgCapped = usdgForLp > usdgBal ? usdgBal : usdgForLp;

  console.log(`\nAdding liquidity: ${(Number(wethForLp)/1e18).toFixed(6)} WETH + ${(Number(usdgCapped)/1e18).toFixed(2)} USDG`);

  await send('approve WETH', walletClient, publicClient, WETH, WETH_ABI, 'approve', [ROUTER, wethForLp]);
  await send('approve USDG', walletClient, publicClient, USDG, ERC20_ABI, 'approve', [ROUTER, usdgCapped]);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  await send(
    'addLiquidity WETH/USDG',
    walletClient, publicClient,
    ROUTER, ROUTER_ABI, 'addLiquidity',
    [WETH, USDG, wethForLp, usdgCapped, 1n, 1n, account.address, deadline],
  );

  console.log('\n✅ WETH/USDG pair seeded with initial liquidity');
}

main().catch(e => { console.error('FAILED:', e.shortMessage ?? e.message ?? e); process.exit(1); });
