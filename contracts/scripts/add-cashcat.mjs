/**
 * add-cashcat.mjs
 * Registers CASHCAT (Cash Cat) on the Liquihood lending protocol on-chain.
 *
 * Steps:
 *   1. OracleRouter.configureAsset  — mark as keeper-fed oracle
 *   2. OracleRouter.pushPrice       — seed initial price ($0.178)
 *   3. LendingPool.addReserve       — create lhCASHCAT / dCASHCAT tokens
 *   4. IsolatedMarketController.configureIsolatedAsset — set debt ceiling
 *   5. IsolatedMarketController.setAllowedBorrowAsset  — allow borrowing USDG
 *
 * Run: node contracts/scripts/add-cashcat.mjs
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;

const CASHCAT      = '0x020bfC650A365f8BB26819deAAbF3E21291018b4';
const LENDING_POOL = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const ORACLE_ROUTER= '0x9c445077D3826C706A1f39413F2508cc09049827';
const IRM          = '0x419D74beFA27CE808C9c863533193847F25EFb6F';
const USDG         = '0x1fad69eaf1f4e9d9470787f51d458a93464833f6';
const ZERO_ADDR    = '0x0000000000000000000000000000000000000000';

// $0.178 in 8-decimal oracle format
const INITIAL_PRICE_8 = 17_800_000n;

// Isolated debt ceiling: 100,000 USDG (18 decimals)
const DEBT_CEILING = 100_000n * 10n ** 18n;

const chain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 oracleType, address aggregator, uint256 heartbeat, uint256 staleness)',
  'function pushPrice(address asset, uint256 price)',
]);

const LENDING_ABI = parseAbi([
  'function addReserve(address _asset, address _irm, bool _isEquity, string _lhName, string _lhSymbol, string _debtName, string _debtSymbol)',
  'function isolatedController() view returns (address)',
]);

const IMC_ABI = parseAbi([
  'function configureIsolatedAsset(address asset, uint256 debtCeiling)',
  'function setAllowedBorrowAsset(address asset, address borrowAsset, bool allowed)',
]);

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  const privateKey = (pk.startsWith('0x') ? pk : `0x${pk}`);
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  console.log('Deployer:', account.address);
  console.log('Token:   ', CASHCAT);
  console.log('');

  // Get IMC address
  const imc = await publicClient.readContract({
    address: LENDING_POOL, abi: LENDING_ABI, functionName: 'isolatedController',
  });
  console.log('IsolatedMarketController:', imc);
  console.log('');

  async function send(label, address, abi, functionName, args) {
    console.log(`⏳ ${label}...`);
    const hash = await walletClient.writeContract({ address, abi, functionName, args });
    console.log(`   tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ confirmed (block ${receipt.blockNumber})`);
    return receipt;
  }

  // Step 1 — configure oracle (KEEPER type = 1)
  await send(
    'OracleRouter.configureAsset',
    ORACLE_ROUTER, ORACLE_ABI, 'configureAsset',
    [CASHCAT, 1, ZERO_ADDR, 0n, 300n],
  );

  // Step 2 — push initial price
  await send(
    `OracleRouter.pushPrice ($${Number(INITIAL_PRICE_8) / 1e8})`,
    ORACLE_ROUTER, ORACLE_ABI, 'pushPrice',
    [CASHCAT, INITIAL_PRICE_8],
  );

  // Step 3 — add reserve to LendingPool
  await send(
    'LendingPool.addReserve',
    LENDING_POOL, LENDING_ABI, 'addReserve',
    [CASHCAT, IRM, false, 'Liquihood Cash Cat', 'lhCASHCAT', 'Liquihood Debt Cash Cat', 'dCASHCAT'],
  );

  // Step 4 — configure isolated asset with debt ceiling
  await send(
    `IMC.configureIsolatedAsset (ceiling: 100,000 USDG)`,
    imc, IMC_ABI, 'configureIsolatedAsset',
    [CASHCAT, DEBT_CEILING],
  );

  // Step 5 — allow USDG as borrow asset for CASHCAT collateral
  await send(
    'IMC.setAllowedBorrowAsset (USDG)',
    imc, IMC_ABI, 'setAllowedBorrowAsset',
    [CASHCAT, USDG, true],
  );

  console.log('');
  console.log('🎉 CASHCAT registered successfully on Liquihood!');
}

main().catch(e => { console.error('FAILED:', e.shortMessage ?? e.message); process.exit(1); });
