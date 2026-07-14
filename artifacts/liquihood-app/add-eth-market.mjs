/**
 * add-eth-market.mjs
 *
 * Deploys a new LiquihoodToken ERC-20 for ETH (Ethereum on Robinhood Chain),
 * configures it in the protocol (HFE, OracleRouter, LendingPool), seeds
 * initial liquidity, and auto-updates contracts.ts + tokens.json.
 *
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/add-eth-market.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import {
  createWalletClient, createPublicClient, http,
  parseAbi, parseUnits, encodeDeployData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const WORKSPACE  = resolve(__dirname, '../..');
const CONTRACTS_SRC = join(WORKSPACE, 'contracts/src/LiquihoodToken.sol');
const COMPILE_DIR   = '/tmp/liquihood-compile';

// ── Chain ─────────────────────────────────────────────────────────────────────
const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
};

// ── Existing protocol contracts ───────────────────────────────────────────────
const LENDING_POOL         = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const ORACLE_ROUTER        = '0x9c445077D3826C706A1f39413F2508cc09049827';
const HEALTH_FACTOR_ENGINE = '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA';
const INTEREST_RATE_MODEL  = '0x419D74beFA27CE808C9c863533193847F25EFb6F';

// ── New ETH asset params ──────────────────────────────────────────────────────
const RAY = 10n ** 27n;

const ETH_ASSET = {
  id:       'eth',
  name:     'Ethereum',
  symbol:   'ETH',
  decimals: 18,
  isEquity: false,
  isolated: false,
  // Oracle: KEEPER mode, initial price $1,795 (matches current WETH keeper price)
  keeperPrice: 1795_00_000_000n, // $1,795.00 × 1e8
  // Risk: slightly tighter than WETH to keep pools distinct
  ltv:   80n * RAY / 100n,  // 80%
  lt:    85n * RAY / 100n,  // 85%
  bonus:  5n * RAY / 100n,  // 5%
  initialMint: parseUnits('100', 18), // seed 100 ETH into pool
};

// ── Minimal ABIs ──────────────────────────────────────────────────────────────
const LIQUIHOOD_TOKEN_ABI = parseAbi([
  'constructor(string name, string symbol, address owner)',
  'function mint(address to, uint256 amount)',
]);

const ERC20_ABI = parseAbi([
  'function approve(address,uint256) returns (bool)',
]);

const LENDING_POOL_ABI = parseAbi([
  'function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)',
  'function supply(address asset, uint256 amount)',
]);

const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
  'function pushPrice(address asset, uint256 price)',
]);

const HFE_ABI = parseAbi([
  'function configureAsset(address asset, uint256 ltv, uint256 lt, uint256 bonus)',
]);

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('❌  DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  console.log(`\n🔑  Deployer: ${account.address}`);
  console.log(`🔗  Chain:    Robinhood Chain (4663)\n`);

  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });

  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  console.log(`📊  Current nonce: ${nonce}\n`);

  async function sendTx(txParams) {
    const hash = await walletClient.sendTransaction({ ...txParams, nonce: nonce++ });
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async function writeTx(params) {
    const hash = await walletClient.writeContract({ ...params, nonce: nonce++ });
    return publicClient.waitForTransactionReceipt({ hash });
  }

  // ── Step 1: Compile LiquihoodToken.sol ────────────────────────────────────
  console.log('📦  Compiling LiquihoodToken.sol…');
  mkdirSync(COMPILE_DIR, { recursive: true });

  const SOLC_PATHS = [
    '/nix/store/4gjpis683v38zg27h6r5k0877f56pcph-solc-0.8.21/bin/solc',
    '/nix/store/1zvbfcrpb0jvp237idgn56gvg6indxhz-solc-0.8.13/bin/solc',
  ];
  let SOLC = '';
  for (const p of SOLC_PATHS) { if (existsSync(p)) { SOLC = p; break; } }
  if (!SOLC) { console.error('❌  No solc binary found'); process.exit(1); }

  execSync(
    `"${SOLC}" "${CONTRACTS_SRC}" --bin --optimize --overwrite --output-dir "${COMPILE_DIR}"`,
    { stdio: ['ignore', 'pipe', 'pipe'], cwd: WORKSPACE }
  );

  const binFile = join(COMPILE_DIR, 'LiquihoodToken.bin');
  const bytecode = '0x' + readFileSync(binFile, 'utf8').trim();
  console.log(`✅  Compiled (${(bytecode.length - 2) / 2} bytes)\n`);

  // ── Step 2: Deploy ERC-20 token ───────────────────────────────────────────
  console.log(`🚀  Deploying ETH token…`);
  const deployData = encodeDeployData({
    abi: LIQUIHOOD_TOKEN_ABI,
    bytecode,
    args: [ETH_ASSET.name, ETH_ASSET.symbol, account.address],
  });
  const deployReceipt = await sendTx({ data: deployData, gas: 3_000_000n });
  const tokenAddress = deployReceipt.contractAddress;
  console.log(`✅  ETH token deployed: ${tokenAddress}\n`);

  // ── Step 3: Mint initial supply to deployer ───────────────────────────────
  console.log(`💰  Minting ${ETH_ASSET.initialMint / 10n**18n} ETH to deployer…`);
  await writeTx({
    address: tokenAddress,
    abi: LIQUIHOOD_TOKEN_ABI,
    functionName: 'mint',
    args: [account.address, ETH_ASSET.initialMint],
  });
  console.log(`✅  Minted\n`);

  // ── Step 4: Configure HealthFactorEngine ─────────────────────────────────
  console.log(`⚙️   Configuring HealthFactorEngine (LTV 80%, LT 85%, bonus 5%)…`);
  await writeTx({
    address: HEALTH_FACTOR_ENGINE,
    abi: HFE_ABI,
    functionName: 'configureAsset',
    args: [tokenAddress, ETH_ASSET.ltv, ETH_ASSET.lt, ETH_ASSET.bonus],
  });
  console.log(`✅  HFE configured\n`);

  // ── Step 5: Configure OracleRouter (KEEPER) ───────────────────────────────
  const KEEPER      = 1;
  const STALENESS   = 300n; // 5 minutes
  const ZERO_ADDR   = '0x0000000000000000000000000000000000000000';

  console.log(`📡  Configuring OracleRouter (KEEPER mode)…`);
  await writeTx({
    address: ORACLE_ROUTER,
    abi: ORACLE_ABI,
    functionName: 'configureAsset',
    args: [tokenAddress, KEEPER, ZERO_ADDR, 0n, STALENESS],
  });
  console.log(`✅  Oracle configured`);

  console.log(`📡  Pushing initial price $${Number(ETH_ASSET.keeperPrice) / 1e8}…`);
  await writeTx({
    address: ORACLE_ROUTER,
    abi: ORACLE_ABI,
    functionName: 'pushPrice',
    args: [tokenAddress, ETH_ASSET.keeperPrice],
  });
  console.log(`✅  Initial price pushed\n`);

  // ── Step 6: Add reserve to LendingPool ───────────────────────────────────
  console.log(`🏦  Adding ETH reserve to LendingPool…`);
  await writeTx({
    address: LENDING_POOL,
    abi: LENDING_POOL_ABI,
    functionName: 'addReserve',
    args: [
      tokenAddress,
      INTEREST_RATE_MODEL,
      false,                      // isEquity
      'Liquihood Ethereum',       // lhName
      'lhETH',                    // lhSymbol
      'Liquihood Debt Ethereum',  // debtName
      'dETH',                     // debtSymbol
    ],
  });
  console.log(`✅  Reserve added\n`);

  // ── Step 7: Seed pool liquidity ───────────────────────────────────────────
  console.log(`💧  Seeding pool with ${Number(ETH_ASSET.initialMint) / 1e18} ETH…`);
  await writeTx({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [LENDING_POOL, ETH_ASSET.initialMint],
  });
  await writeTx({
    address: LENDING_POOL,
    abi: LENDING_POOL_ABI,
    functionName: 'supply',
    args: [tokenAddress, ETH_ASSET.initialMint],
  });
  console.log(`✅  Pool seeded\n`);

  // ── Step 8: Update tokens.json ────────────────────────────────────────────
  const deploymentsDir = join(WORKSPACE, 'contracts/deployments');
  mkdirSync(deploymentsDir, { recursive: true });
  const tokensPath = join(deploymentsDir, 'tokens.json');
  let tokens = {};
  if (existsSync(tokensPath)) {
    tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
  }
  tokens['eth'] = tokenAddress;
  writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  console.log(`📄  tokens.json updated`);

  // ── Step 9: Update contracts.ts ───────────────────────────────────────────
  const contractsTs = join(__dirname, 'src/lib/contracts.ts');
  let contractsContent = readFileSync(contractsTs, 'utf8');

  // Add 'eth' entry after 'weth'
  contractsContent = contractsContent.replace(
    `  'weth': '0x1625619cc04b012aed8522e079d942801977e360',`,
    `  'weth': '0x1625619cc04b012aed8522e079d942801977e360',\n  'eth':  '${tokenAddress}',`
  );

  // Update PROTOCOL_CONFIGURED count from 7 to 8
  contractsContent = contractsContent.replace(
    'Object.keys(ASSET_TOKEN_ADDRESS).length === 7',
    'Object.keys(ASSET_TOKEN_ADDRESS).length === 8'
  );

  writeFileSync(contractsTs, contractsContent);
  console.log(`✅  contracts.ts updated with ETH address: ${tokenAddress}`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅  ETH MARKET DEPLOYED AND CONFIGURED');
  console.log('═'.repeat(60));
  console.log(`\n   Token address: ${tokenAddress}`);
  console.log(`   LTV: 80%  |  LT: 85%  |  Bonus: 5%`);
  console.log(`   Initial price: $1,795 (keeper will update every 5 min)`);
  console.log(`   Pool seeded: 100 ETH (~$179,500)\n`);
}

main().catch(e => {
  console.error('\n❌  Fatal error:', e?.shortMessage || e?.message || e);
  process.exit(1);
});
