/**
 * withdraw-seed.mjs
 * Strategy:
 *  - For AAPL-T/TSLA-T/HOOD-T/old-WETH/custom-ETH: pushPriceBatch (KEEPER, recently pushed)
 *  - For DOGE/MEME-1: reconfigure as FIXED (bypasses deviation check, resets timestamp)
 *  - For USDG: reconfigure FIXED (refresh lastUpdated)
 *  - Then withdraw all 8 positions
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const LP  = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const OR  = '0x9c445077D3826C706A1f39413F2508cc09049827';

const chain = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name:'Ether',symbol:'ETH',decimals:18 }, rpcUrls: { default: { http: [RPC] } } };
const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
const pub = createPublicClient({ chain, transport: http() });
const wal = createWalletClient({ account, chain, transport: http() });

const O_ABI = parseAbi([
  'function pushPriceBatch(address[] assets, uint256[] prices)',
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
]);
const P_ABI = parseAbi([
  'function getUserCollateral(address user, address asset) view returns (uint256)',
  'function withdraw(address asset, uint256 amount)',
]);

const ZERO = '0x0000000000000000000000000000000000000000';
const ONE_YEAR = 365n * 24n * 3600n;
const FIXED = 2;

let n = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
console.log(`Deployer: ${account.address}  nonce: ${n}\n`);

async function send(label, addr, abi, fn, args) {
  process.stdout.write(`→ ${label}… `);
  const h = await wal.writeContract({ address: addr, abi, functionName: fn, args, nonce: n++ });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`✅  ${h}`);
}

// 1. pushPriceBatch for 5 recently-pushed KEEPER assets (small deviation)
await send('pushPriceBatch(5 KEEPER assets)', OR, O_ABI, 'pushPriceBatch', [
  ['0x1625619cc04b012aed8522e079d942801977e360',
   '0xe75454ef6858d469bf499f456bc35732fab629db',
   '0xcebc4394f2f58d5ec9a6f370c59f414c91730c35',
   '0xa5d32358aa01063eea9e00dfaec98d0348b05b83',
   '0xd23722ffa116966b5472c6164b20e04eeb9df5e7'],
  [177700000000n, 177700000000n, 31800000000n, 39800000000n, 11100000000n],
]);

// 2. Re-configure USDG, DOGE, MEME-1 as FIXED (bypasses deviation, resets lastUpdated)
await send('configureAsset USDG FIXED $1.00',  OR, O_ABI, 'configureAsset', ['0x1fad69eaf1f4e9d9470787f51d458a93464833f6', FIXED, ZERO,   1_00_000_000n,  ONE_YEAR]);
await send('configureAsset DOGE FIXED $0.165', OR, O_ABI, 'configureAsset', ['0x9f2b1ba1e5e1b07050b621090cb4e51df2ff77f9', FIXED, ZERO,  16_500_000n,   ONE_YEAR]);
await send('configureAsset MEME-1 FIXED $0.01',OR, O_ABI, 'configureAsset', ['0xb554cbf2a8f1ec54a58a8facf081648a10e66c04', FIXED, ZERO,   1_000_000n,   ONE_YEAR]);

// 3. Withdraw all 8 positions
const ALL = [
  { addr: '0x1fad69eaf1f4e9d9470787f51d458a93464833f6', label: 'USDG'       },
  { addr: '0x1625619cc04b012aed8522e079d942801977e360', label: 'old-WETH'   },
  { addr: '0xe75454ef6858d469bf499f456bc35732fab629db', label: 'custom-ETH' },
  { addr: '0xcebc4394f2f58d5ec9a6f370c59f414c91730c35', label: 'AAPL-T'     },
  { addr: '0xa5d32358aa01063eea9e00dfaec98d0348b05b83', label: 'TSLA-T'     },
  { addr: '0xd23722ffa116966b5472c6164b20e04eeb9df5e7', label: 'HOOD-T'     },
  { addr: '0x9f2b1ba1e5e1b07050b621090cb4e51df2ff77f9', label: 'DOGE'       },
  { addr: '0xb554cbf2a8f1ec54a58a8facf081648a10e66c04', label: 'MEME-1'     },
];

console.log('');
for (const t of ALL) {
  const bal = await pub.readContract({ address: LP, abi: P_ABI, functionName: 'getUserCollateral', args: [account.address, t.addr] });
  if (bal === 0n) { console.log(`${t.label}: 0 — skip`); continue; }
  process.stdout.write(`→ Withdraw ${t.label} (${bal})… `);
  try {
    const h = await wal.writeContract({ address: LP, abi: P_ABI, functionName: 'withdraw', args: [t.addr, bal], nonce: n++ });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log(`✅  ${h}`);
  } catch (e) { console.log(`❌  ${e?.shortMessage || e?.message}`); }
}
console.log('\n✅ Done.');
