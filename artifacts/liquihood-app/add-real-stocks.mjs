/**
 * add-real-stocks.mjs
 *
 * Registers 5 real tokenized stock reserves from robinscan.io on Liquihood protocol.
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/add-real-stocks.mjs
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC         = 'https://rpc.mainnet.chain.robinhood.com';
const HFE_ADDR    = '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA';
const ORACLE_ADDR = '0x9c445077D3826C706A1f39413F2508cc09049827';
const LP_ADDR     = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const IRM_ADDR    = '0x419D74beFA27CE808C9c863533193847F25EFb6F';
const ZERO        = '0x0000000000000000000000000000000000000000';
const RAY         = 10n ** 27n;

const chain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
const pub = createPublicClient({ chain, transport: http() });
const wal = createWalletClient({ account, chain, transport: http() });

const HFE_ABI = parseAbi([
  'function configureAsset(address asset, uint256 ltv, uint256 lt, uint256 bonus)',
]);
const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
  'function pushPrice(address asset, uint256 price)',
]);
const LP_ABI = parseAbi([
  'function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)',
]);

let n = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
console.log(`Deployer: ${account.address}  nonce: ${n}\n`);

async function send(label, addr, abi, fn, args) {
  process.stdout.write(`  → ${label}… `);
  const h = await wal.writeContract({ address: addr, abi, functionName: fn, args, nonce: n++ });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`✅  ${h}`);
}

// 5 real tokenized stocks from robinscan.io (Chain ID 4663)
const STOCKS = [
  {
    id:      'AAPL',
    name:    'Apple',
    addr:    '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    ltv:     65n,  // 65%
    lt:      75n,  // 75%
    bonus:    7n,  //  7%
    price:   215_00_000_000n, // $215.00 (8 decimals)
  },
  {
    id:      'AMZN',
    name:    'Amazon',
    addr:    '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
    ltv:     55n,
    lt:      67n,
    bonus:    8n,
    price:   245_00_000_000n, // $245.00
  },
  {
    id:      'NVDA',
    name:    'NVIDIA',
    addr:    '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    ltv:     50n,
    lt:      62n,
    bonus:    9n,
    price:   204_00_000_000n, // $204.00
  },
  {
    id:      'TSLA',
    name:    'Tesla',
    addr:    '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
    ltv:     40n,
    lt:      52n,
    bonus:   10n,
    price:   393_00_000_000n, // $393.00
  },
  {
    id:      'MSTR',
    name:    'Strategy Inc',
    addr:    '0xec262a75e413fAfD0dF80480274532C79D42da09',
    ltv:     35n,
    lt:      47n,
    bonus:   12n,
    price:    92_00_000_000n, // $92.00
  },
];

for (const s of STOCKS) {
  console.log(`\n── ${s.id} (${s.name}) ──`);

  // 1. HFE risk params
  await send(
    `HFE.configureAsset(${s.id})`,
    HFE_ADDR, HFE_ABI, 'configureAsset',
    [s.addr, s.ltv * RAY / 100n, s.lt * RAY / 100n, s.bonus * RAY / 100n],
  );

  // 2. Oracle: KEEPER mode (source=1), 600s staleness (same as other assets)
  await send(
    `Oracle.configureAsset(${s.id}, KEEPER, 600s)`,
    ORACLE_ADDR, ORACLE_ABI, 'configureAsset',
    [s.addr, 1, ZERO, 0n, 600n],
  );

  // 3. Push initial price so oracle is not stale on first query
  await send(
    `Oracle.pushPrice(${s.id}, $${Number(s.price) / 1e8})`,
    ORACLE_ADDR, ORACLE_ABI, 'pushPrice',
    [s.addr, s.price],
  );

  // 4. Add reserve (isEquity = true)
  await send(
    `LendingPool.addReserve(${s.id})`,
    LP_ADDR, LP_ABI, 'addReserve',
    [s.addr, IRM_ADDR, true,
     `Liquihood ${s.id}`, `lh${s.id}`,
     `Liquihood Debt ${s.id}`, `d${s.id}`],
  );
}

console.log('\n✅  All 5 real stock markets registered on Liquihood protocol.');
console.log('   The keeper will push live prices on the next cycle (within 4 min).');
