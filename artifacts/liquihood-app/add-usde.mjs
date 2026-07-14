/**
 * add-usde.mjs — configure Ethena USDe on Liquihood protocol.
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/add-usde.mjs
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC        = 'https://rpc.mainnet.chain.robinhood.com';
const USDE_ADDR  = '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34';
const HFE_ADDR   = '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA';
const ORACLE_ADDR = '0x9c445077D3826C706A1f39413F2508cc09049827';
const LP_ADDR    = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const IRM_ADDR   = '0x419D74beFA27CE808C9c863533193847F25EFb6F';
const ZERO       = '0x0000000000000000000000000000000000000000';
const RAY        = 10n ** 27n;

const chain = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name:'Ether',symbol:'ETH',decimals:18 }, rpcUrls: { default: { http: [RPC] } } };
const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
const pub = createPublicClient({ chain, transport: http() });
const wal = createWalletClient({ account, chain, transport: http() });

const HFE_ABI    = parseAbi(['function configureAsset(address asset, uint256 ltv, uint256 lt, uint256 bonus)']);
const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
  'function pushPrice(address asset, uint256 price)',
]);
const LP_ABI = parseAbi(['function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)']);

let n = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
console.log(`Deployer: ${account.address}  nonce: ${n}\n`);

async function send(label, addr, abi, fn, args) {
  process.stdout.write(`→ ${label}… `);
  const h = await wal.writeContract({ address: addr, abi, functionName: fn, args, nonce: n++ });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`✅  ${h}`);
}

// LTV 85%, LT 90%, bonus 4% (stablecoin params)
await send('HFE.configureAsset(USDe)', HFE_ADDR, HFE_ABI, 'configureAsset',
  [USDE_ADDR, 85n * RAY / 100n, 90n * RAY / 100n, 4n * RAY / 100n]);

// KEEPER mode (price stays near $1 but track it), 6-min staleness
await send('Oracle.configureAsset(USDe, KEEPER)', ORACLE_ADDR, ORACLE_ABI, 'configureAsset',
  [USDE_ADDR, 1, ZERO, 0n, 300n]);

// Push initial price $1.00
await send('Oracle.pushPrice(USDe, $1.00)', ORACLE_ADDR, ORACLE_ABI, 'pushPrice',
  [USDE_ADDR, 1_00_000_000n]);

// Add reserve
await send('LendingPool.addReserve(USDe)', LP_ADDR, LP_ABI, 'addReserve',
  [USDE_ADDR, IRM_ADDR, false, 'Liquihood USDe', 'lhUSDe', 'Liquihood Debt USDe', 'dUSDe']);

console.log('\n✅ USDe configured on Liquihood protocol');
