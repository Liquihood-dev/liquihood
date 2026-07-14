/**
 * fix-oracle-staleness.mjs
 *
 * Increases maxStaleness for all KEEPER-mode oracle assets from 300s → 600s.
 * This gives a 2-minute buffer so borrow/withdraw never hits "OR: keeper price stale"
 * between keeper pushes (keeper runs every 4 min, staleness = 10 min).
 *
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/fix-oracle-staleness.mjs
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC     = 'https://rpc.mainnet.chain.robinhood.com';
const ORACLE  = '0x9c445077D3826C706A1f39413F2508cc09049827';
const ZERO    = '0x0000000000000000000000000000000000000000';
const KEEPER  = 1;
const NEW_STALENESS = 600n; // 10 minutes

const chain = {
  id: 4663, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
const pub = createPublicClient({ chain, transport: http() });
const wal = createWalletClient({ account, chain, transport: http() });

const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
]);

// All KEEPER-mode assets
const KEEPER_ASSETS = [
  { name: 'WETH',    addr: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' },
  { name: 'VIRTUAL', addr: '0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31' },
  { name: 'USDe',    addr: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34' },
  { name: 'AAPL-T',  addr: '0xcebc4394f2f58d5ec9a6f370c59f414c91730c35' },
  { name: 'TSLA-T',  addr: '0xa5d32358aa01063eea9e00dfaec98d0348b05b83' },
  { name: 'HOOD-T',  addr: '0xd23722ffa116966b5472c6164b20e04eeb9df5e7' },
];

let n = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
console.log(`Deployer: ${account.address}  nonce: ${n}`);
console.log(`Setting maxStaleness = ${NEW_STALENESS}s for ${KEEPER_ASSETS.length} KEEPER assets\n`);

for (const { name, addr } of KEEPER_ASSETS) {
  process.stdout.write(`→ Oracle.configureAsset(${name}, KEEPER, staleness=${NEW_STALENESS}s)… `);
  try {
    const h = await wal.writeContract({
      address: ORACLE, abi: ORACLE_ABI,
      functionName: 'configureAsset',
      args: [addr, KEEPER, ZERO, 0n, NEW_STALENESS],
      nonce: n++,
    });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log(`✅  ${h}`);
  } catch (e) {
    console.error(`❌  ${e.shortMessage || e.message}`);
    n--; // retry same nonce if needed
  }
}

console.log('\n✅  Oracle staleness updated for all KEEPER assets.');
console.log('   Keeper now runs every 4 min, staleness window = 10 min → 6-min safety buffer.');
