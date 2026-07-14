/**
 * add-virtual.mjs
 * Configures Virtuals Protocol (VIRTUAL) on Liquihood protocol.
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/add-virtual.mjs
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL      = 'https://rpc.mainnet.chain.robinhood.com';
const VIRTUAL_ADDR = '0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31';
const HFE_ADDR     = '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA';
const ORACLE_ADDR  = '0x9c445077D3826C706A1f39413F2508cc09049827';
const LENDING_POOL = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const IRM_ADDR     = '0x419D74beFA27CE808C9c863533193847F25EFb6F';
const ZERO_ADDR    = '0x0000000000000000000000000000000000000000';
const RAY          = 10n ** 27n;

const chain = {
  id: 4663, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account, chain, transport: http() });

let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
console.log(`Deployer: ${account.address}  nonce: ${nonce}`);

async function send(label, address, abi, functionName, args) {
  process.stdout.write(`→ ${label}… `);
  const hash = await walletClient.writeContract({ address, abi, functionName, args, nonce: nonce++ });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅  ${hash}`);
}

// Fetch live VIRTUAL price
let price = 1.5;
try {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=virtual-protocol&vs_currencies=usd');
  const d = await r.json();
  if (d['virtual-protocol']?.usd) { price = d['virtual-protocol'].usd; }
} catch {}
console.log(`VIRTUAL price: $${price}`);

const HFE_ABI = parseAbi([
  'function configureAsset(address asset, uint256 ltv, uint256 lt, uint256 bonus)',
]);
const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
  'function pushPrice(address asset, uint256 price)',
]);
const POOL_ABI = parseAbi([
  'function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)',
]);

// LTV 45%, LT 55%, bonus 10%
await send('HFE.configureAsset(VIRTUAL)', HFE_ADDR, HFE_ABI, 'configureAsset',
  [VIRTUAL_ADDR, 45n * RAY / 100n, 55n * RAY / 100n, 10n * RAY / 100n]);

// KEEPER mode = 1, feed = zero address, fixedPrice = 0, staleness = 300s
await send('Oracle.configureAsset(VIRTUAL, KEEPER)', ORACLE_ADDR, ORACLE_ABI, 'configureAsset',
  [VIRTUAL_ADDR, 1, ZERO_ADDR, 0n, 300n]);

// Push initial price (8 decimals)
const price8 = BigInt(Math.round(price * 1e8));
await send(`Oracle.pushPrice(VIRTUAL, $${price})`, ORACLE_ADDR, ORACLE_ABI, 'pushPrice',
  [VIRTUAL_ADDR, price8]);

// Add reserve (not equity)
await send('LendingPool.addReserve(VIRTUAL)', LENDING_POOL, POOL_ABI, 'addReserve',
  [VIRTUAL_ADDR, IRM_ADDR, false, 'Liquihood VIRTUAL', 'lhVIRTUAL', 'Liquihood Debt VIRTUAL', 'dVIRTUAL']);

console.log('\n✅ VIRTUAL configured on-chain');
