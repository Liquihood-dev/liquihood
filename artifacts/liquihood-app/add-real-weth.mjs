/**
 * add-real-weth.mjs
 *
 * Configures the Liquihood LendingPool to accept the REAL Robinhood Chain WETH
 * (0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73) instead of the custom
 * LiquihoodToken that was deployed during initial setup.
 *
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/add-real-weth.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(__dirname, '../..');

const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
};

// Protocol contracts
const LENDING_POOL         = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const ORACLE_ROUTER        = '0x9c445077D3826C706A1f39413F2508cc09049827';
const HEALTH_FACTOR_ENGINE = '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA';
const INTEREST_RATE_MODEL  = '0x419D74beFA27CE808C9c863533193847F25EFb6F';

// Real Robinhood Chain WETH (confirmed: decimals=18, totalSupply=21k)
const REAL_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';

const RAY = 10n ** 27n;

const LENDING_POOL_ABI = parseAbi([
  'function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)',
]);

const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
]);

const HFE_ABI = parseAbi([
  'function configureAsset(address asset, uint256 ltv, uint256 lt, uint256 bonus)',
]);

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('❌  DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  console.log(`\n🔑  Deployer: ${account.address}`);
  console.log(`🔗  Chain:    Robinhood Chain (4663)`);
  console.log(`🎯  Real WETH: ${REAL_WETH}\n`);

  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });

  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  console.log(`📊  Current nonce: ${nonce}\n`);

  async function writeTx(params, label) {
    process.stdout.write(`   ${label}…`);
    const hash = await walletClient.writeContract({ ...params, nonce: nonce++ });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(` ✅  tx: ${hash}`);
    return receipt;
  }

  // 1. Configure HealthFactorEngine: same params as old WETH (LTV 75%, LT 80%, bonus 5%)
  console.log('⚙️   Configuring HealthFactorEngine for real WETH…');
  await writeTx({
    address: HEALTH_FACTOR_ENGINE,
    abi: HFE_ABI,
    functionName: 'configureAsset',
    args: [REAL_WETH, 75n * RAY / 100n, 80n * RAY / 100n, 5n * RAY / 100n],
  }, 'HFE.configureAsset(WETH)');

  // 2. Configure OracleRouter: KEEPER mode, 5-min staleness
  console.log('\n📡  Configuring OracleRouter for real WETH (KEEPER mode)…');
  const KEEPER   = 1;
  const ZERO     = '0x0000000000000000000000000000000000000000';
  const STALENESS = 300n; // 5 min
  await writeTx({
    address: ORACLE_ROUTER,
    abi: ORACLE_ABI,
    functionName: 'configureAsset',
    args: [REAL_WETH, KEEPER, ZERO, 0n, STALENESS],
  }, 'Oracle.configureAsset(WETH)');

  // 3. Add reserve to LendingPool
  console.log('\n🏦  Adding real WETH reserve to LendingPool…');
  await writeTx({
    address: LENDING_POOL,
    abi: LENDING_POOL_ABI,
    functionName: 'addReserve',
    args: [REAL_WETH, INTEREST_RATE_MODEL, false, 'Liquihood WETH', 'lhWETH', 'Liquihood Debt WETH', 'dWETH'],
  }, 'LendingPool.addReserve(WETH)');

  // 4. Push initial price ($1,767 — keeper will update every 5 min)
  console.log('\n📡  Pushing initial WETH price via Oracle…');
  const ORACLE_PUSH_ABI = parseAbi(['function pushPrice(address asset, uint256 price)']);
  const initialPrice = 1767_00_000_000n; // $1,767.00 × 1e8
  await writeTx({
    address: ORACLE_ROUTER,
    abi: ORACLE_PUSH_ABI,
    functionName: 'pushPrice',
    args: [REAL_WETH, initialPrice],
  }, 'Oracle.pushPrice(WETH, $1767)');

  // 5. Update contracts.ts
  console.log('\n📝  Updating contracts.ts…');
  const contractsTs = join(__dirname, 'src/lib/contracts.ts');
  let content = readFileSync(contractsTs, 'utf8');

  // Replace old weth address with real weth address
  const oldLine = `  'weth': '0x1625619cc04b012aed8522e079d942801977e360',`;
  const newLine = `  'weth': '${REAL_WETH}', // Real Robinhood Chain WETH (decimals=18)`;
  if (!content.includes(oldLine)) {
    console.warn('   ⚠️  Old WETH line not found — updating manually');
    content = content.replace(/'weth': '0x[0-9a-fA-F]+'/, `'weth': '${REAL_WETH}'`);
  } else {
    content = content.replace(oldLine, newLine);
  }
  writeFileSync(contractsTs, content);
  console.log(`   ✅  contracts.ts updated — 'weth' now points to ${REAL_WETH}`);

  console.log('\n' + '═'.repeat(65));
  console.log('✅  REAL WETH MARKET CONFIGURED');
  console.log('═'.repeat(65));
  console.log(`   Token:    ${REAL_WETH}`);
  console.log(`   LTV: 75%  |  LT: 80%  |  Liquidation bonus: 5%`);
  console.log(`   Oracle:   KEEPER mode (5-min staleness)`);
  console.log(`   IMPORTANT: restart the API server so keeper pushes prices`);
  console.log(`              for the new address\n`);
}

main().catch(e => {
  console.error('\n❌  Fatal:', e?.shortMessage || e?.message || e);
  process.exit(1);
});
