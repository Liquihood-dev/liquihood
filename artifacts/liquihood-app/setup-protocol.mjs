/**
 * setup-protocol.mjs
 *
 * Deploys LiquihoodToken (real ERC-20, no faucet) for each protocol asset
 * and configures the Liquihood protocol on Robinhood Chain.
 *
 * Run from artifacts/liquihood-app/:
 *   DEPLOYER_PRIVATE_KEY=0x... node setup-protocol.mjs
 *
 * Or from workspace root:
 *   DEPLOYER_PRIVATE_KEY=0x... node artifacts/liquihood-app/setup-protocol.mjs
 *
 * After success, contracts.ts is auto-updated with the new on-chain addresses.
 */

import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, encodeFunctionData, encodeDeployData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(__dirname, '../..');
const CONTRACTS_SRC = join(WORKSPACE, 'contracts/src/LiquihoodToken.sol');
const COMPILE_DIR = '/tmp/liquihood-compile';

// ── Chain config ──────────────────────────────────────────────────────────────

const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
};

// ── Deployed contract addresses ───────────────────────────────────────────────

const LENDING_POOL          = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const ORACLE_ROUTER         = '0x9c445077D3826C706A1f39413F2508cc09049827';
const HEALTH_FACTOR_ENGINE  = '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA';
const INTEREST_RATE_MODEL   = '0x419D74beFA27CE808C9c863533193847F25EFb6F';

// ── Asset definitions ─────────────────────────────────────────────────────────

const RAY = 10n ** 27n;

const ASSETS = [
  {
    id: 'usd-g',   name: 'USD Global',          symbol: 'USDG',   decimals: 18,
    isEquity: false, isolated: false,
    oracle: 'FIXED', fixedPrice: 1_00_000_000n,  // $1.00 × 1e8
    ltv: 86n * RAY / 100n, lt: 91n * RAY / 100n, bonus: 4n * RAY / 100n,
    initialMint:  parseUnits('500000', 18),       // seed pool liquidity
  },
  {
    id: 'weth',    name: 'Wrapped Ethereum',     symbol: 'WETH',   decimals: 18,
    isEquity: false, isolated: false,
    oracle: 'KEEPER', keeperPrice: 2500_00_000_000n, // $2,500.00 × 1e8
    ltv: 75n * RAY / 100n, lt: 80n * RAY / 100n, bonus: 5n * RAY / 100n,
    initialMint:  parseUnits('200', 18),
  },
  {
    id: 'aapl-t',  name: 'Apple Tokenized',      symbol: 'AAPL-T', decimals: 18,
    isEquity: true, isolated: false,
    oracle: 'KEEPER', keeperPrice: 200_00_000_000n, // $200.00 × 1e8
    ltv: 60n * RAY / 100n, lt: 70n * RAY / 100n, bonus: 7n * RAY / 100n,
    initialMint:  parseUnits('5000', 18),
  },
  {
    id: 'tsla-t',  name: 'Tesla Tokenized',       symbol: 'TSLA-T', decimals: 18,
    isEquity: true, isolated: false,
    oracle: 'KEEPER', keeperPrice: 300_00_000_000n, // $300.00 × 1e8
    ltv: 38n * RAY / 100n, lt: 48n * RAY / 100n, bonus: 10n * RAY / 100n,
    initialMint:  parseUnits('5000', 18),
  },
  {
    id: 'hood-t',  name: 'Robinhood Tokenized',   symbol: 'HOOD-T', decimals: 18,
    isEquity: true, isolated: false,
    oracle: 'KEEPER', keeperPrice: 50_00_000_000n,  // $50.00 × 1e8
    ltv: 42n * RAY / 100n, lt: 52n * RAY / 100n, bonus: 10n * RAY / 100n,
    initialMint:  parseUnits('10000', 18),
  },
  {
    id: 'doge',    name: 'Dogecoin',              symbol: 'DOGE',   decimals: 18,
    isEquity: false, isolated: true,
    oracle: 'KEEPER', keeperPrice: 10_000_000n,    // $0.10 × 1e8
    ltv: 25n * RAY / 100n, lt: 35n * RAY / 100n, bonus: 12n * RAY / 100n,
    initialMint:  parseUnits('5000000', 18),
  },
  {
    id: 'meme-1',  name: 'PepeDog',               symbol: 'MEME-1', decimals: 18,
    isEquity: false, isolated: true,
    oracle: 'KEEPER', keeperPrice: 50_000_000n,    // $0.50 × 1e8
    ltv: 22n * RAY / 100n, lt: 32n * RAY / 100n, bonus: 15n * RAY / 100n,
    initialMint:  parseUnits('500000', 18),
  },
];

// ── ABIs (minimal) ────────────────────────────────────────────────────────────

const ERC20_ABI = parseAbi([
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
]);

const LIQUIHOOD_TOKEN_ABI = parseAbi([
  'constructor(string name, string symbol, address owner)',
  'function mint(address to, uint256 amount)',
]);

const LENDING_POOL_ABI = parseAbi([
  'function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)',
  'function supply(address asset, uint256 amount)',
]);

const ORACLE_ABI = parseAbi([
  'function configureAsset(address asset, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)',
  'function pushPrice(address asset, uint256 price)',
  'function pushPriceBatch(address[] assets, uint256[] prices)',
]);

const HFE_ABI = parseAbi([
  'function configureAsset(address asset, uint256 ltv, uint256 lt, uint256 bonus)',
]);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error('❌  DEPLOYER_PRIVATE_KEY environment variable not set.');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  console.log(`\n🔑  Deployer: ${account.address}`);
  console.log(`🔗  Chain:    Robinhood Chain (4663)\n`);

  const walletClient = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(),
  });

  // Always read the pending nonce to handle partially-completed previous runs
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  console.log(`📊  Current nonce: ${nonce}\n`);

  /** Send a transaction and wait for receipt, incrementing nonce manually. */
  async function sendTx(txParams) {
    const hash = await walletClient.sendTransaction({ ...txParams, nonce: nonce++ });
    return publicClient.waitForTransactionReceipt({ hash });
  }

  /** Write a contract function and wait for receipt. */
  async function writeTx(params) {
    const hash = await walletClient.writeContract({ ...params, nonce: nonce++ });
    return publicClient.waitForTransactionReceipt({ hash });
  }

  // ── Step 1: Compile MockERC20.sol ─────────────────────────────────────────

  console.log('📦  Compiling LiquihoodToken.sol…');
  mkdirSync(COMPILE_DIR, { recursive: true });

  // Find solc binary in nix store (prefer newer version)
  const SOLC_PATHS = [
    '/nix/store/4gjpis683v38zg27h6r5k0877f56pcph-solc-0.8.21/bin/solc',
    '/nix/store/1zvbfcrpb0jvp237idgn56gvg6indxhz-solc-0.8.13/bin/solc',
  ];
  let SOLC = '';
  for (const p of SOLC_PATHS) {
    if (existsSync(p)) { SOLC = p; break; }
  }
  if (!SOLC) {
    console.error('❌  No solc binary found in nix store. Searched:', SOLC_PATHS);
    process.exit(1);
  }
  console.log(`   Using solc: ${SOLC}`);

  try {
    execSync(
      `"${SOLC}" "${CONTRACTS_SRC}" --bin --optimize --overwrite --output-dir "${COMPILE_DIR}"`,
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: WORKSPACE }
    );
  } catch (e) {
    console.error('❌  Compilation failed:', e.stderr?.toString() || e.message);
    process.exit(1);
  }

  // solc outputs <ContractName>.bin (not solcjs-style paths)
  const binFile = join(COMPILE_DIR, 'LiquihoodToken.bin');
  if (!existsSync(binFile)) {
    const available = execSync(`ls "${COMPILE_DIR}"`).toString().trim();
    console.error('❌  Expected .bin file not found:', binFile);
    console.error('Available files:', available);
    process.exit(1);
  }

  const bytecode = ('0x' + readFileSync(binFile, 'utf8').trim());
  console.log(`✅  Bytecode size: ${(bytecode.length - 2) / 2} bytes\n`);

  // ── Step 2: Deploy LiquihoodToken for each asset ──────────────────────────

  const deployedTokens = {};

  for (const asset of ASSETS) {
    process.stdout.write(`🚀  Deploying ${asset.symbol}…`);

    // Encode constructor: (string name, string symbol, address owner)
    const deployData = encodeDeployData({
      abi: LIQUIHOOD_TOKEN_ABI,
      bytecode,
      args: [asset.name, asset.symbol, account.address],
    });

    const receipt = await sendTx({ data: deployData, gas: 3_000_000n });
    const tokenAddress = receipt.contractAddress;
    deployedTokens[asset.id] = tokenAddress;

    console.log(` ✅  ${tokenAddress}`);

    // Mint initial liquidity to deployer (for seeding pool)
    await writeTx({
      address: tokenAddress,
      abi: LIQUIHOOD_TOKEN_ABI,
      functionName: 'mint',
      args: [account.address, asset.initialMint],
    });
  }

  console.log('');

  // ── Step 3: Configure HealthFactorEngine risk params ──────────────────────

  console.log('⚙️   Configuring HealthFactorEngine…');
  for (const asset of ASSETS) {
    await writeTx({
      address: HEALTH_FACTOR_ENGINE,
      abi: HFE_ABI,
      functionName: 'configureAsset',
      args: [deployedTokens[asset.id], asset.ltv, asset.lt, asset.bonus],
    });
    process.stdout.write(` ✅  ${asset.symbol}`);
  }
  console.log('\n');

  // ── Step 4: Configure OracleRouter ───────────────────────────────────────

  console.log('📡  Configuring OracleRouter…');
  const FIXED   = 2;
  const KEEPER  = 1;
  const STALENESS_FIXED  = 365n * 24n * 3600n;
  const STALENESS_KEEPER = 300n; // 5 minutes

  for (const asset of ASSETS) {
    const addr = deployedTokens[asset.id];
    if (asset.oracle === 'FIXED') {
      await writeTx({
        address: ORACLE_ROUTER,
        abi: ORACLE_ABI,
        functionName: 'configureAsset',
        args: [addr, FIXED, '0x0000000000000000000000000000000000000000', asset.fixedPrice, STALENESS_FIXED],
      });
    } else {
      await writeTx({
        address: ORACLE_ROUTER,
        abi: ORACLE_ABI,
        functionName: 'configureAsset',
        args: [addr, KEEPER, '0x0000000000000000000000000000000000000000', 0n, STALENESS_KEEPER],
      });
      // Push initial price so it's not stale
      await writeTx({
        address: ORACLE_ROUTER,
        abi: ORACLE_ABI,
        functionName: 'pushPrice',
        args: [addr, asset.keeperPrice],
      });
    }
    process.stdout.write(` ✅  ${asset.symbol}`);
  }
  console.log('\n');

  // ── Step 5: Add reserves to LendingPool ──────────────────────────────────

  console.log('🏦  Adding reserves to LendingPool…');
  for (const asset of ASSETS) {
    const addr = deployedTokens[asset.id];
    await writeTx({
      address: LENDING_POOL,
      abi: LENDING_POOL_ABI,
      functionName: 'addReserve',
      args: [
        addr,
        INTEREST_RATE_MODEL,
        asset.isEquity,
        `Liquihood ${asset.name}`,
        `lh${asset.symbol}`,
        `Liquihood Debt ${asset.name}`,
        `d${asset.symbol}`,
      ],
    });
    process.stdout.write(` ✅  ${asset.symbol}`);
  }
  console.log('\n');

  // ── Step 6: Seed initial liquidity (approve + supply) ────────────────────

  console.log('💧  Seeding initial pool liquidity…');
  for (const asset of ASSETS) {
    const addr = deployedTokens[asset.id];
    // Approve
    await writeTx({
      address: addr,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LENDING_POOL, asset.initialMint],
    });
    // Supply
    await writeTx({
      address: LENDING_POOL,
      abi: LENDING_POOL_ABI,
      functionName: 'supply',
      args: [addr, asset.initialMint],
    });
    process.stdout.write(` ✅  ${asset.symbol}`);
  }
  console.log('\n');

  // ── Output: copy-paste block for contracts.ts ─────────────────────────────

  const tsBlock = `
// ── Token addresses — generated by setup-protocol.mjs ──
export const ASSET_TOKEN_ADDRESS: Record<string, \`0x\${string}\`> = {
${ASSETS.map(a => `  '${a.id}': '${deployedTokens[a.id]}',`).join('\n')}
};

export const PROTOCOL_CONFIGURED = Object.keys(ASSET_TOKEN_ADDRESS).length === 7;
`;

  console.log('\n' + '═'.repeat(70));
  console.log('✅  PROTOCOL CONFIGURED SUCCESSFULLY');
  console.log('═'.repeat(70));
  console.log('\nPaste this into src/lib/contracts.ts (replace the ASSET_TOKEN_ADDRESS export):\n');
  console.log(tsBlock);
  console.log('═'.repeat(70));

  // Write to JSON
  const deploymentsDir = join(WORKSPACE, 'contracts/deployments');
  mkdirSync(deploymentsDir, { recursive: true });
  writeFileSync(
    join(deploymentsDir, 'tokens.json'),
    JSON.stringify(deployedTokens, null, 2)
  );
  console.log(`\n📄  Addresses saved to contracts/deployments/tokens.json`);

  // Auto-update contracts.ts
  const contractsTs = join(__dirname, 'src/lib/contracts.ts');
  let contractsContent = readFileSync(contractsTs, 'utf8');
  // Replace ASSET_TOKEN_ADDRESS block
  contractsContent = contractsContent.replace(
    /\/\/ Token contracts.*?export const PROTOCOL_CONFIGURED.*?;/s,
    `// Token contracts deployed by setup-protocol.mjs\nexport const ASSET_TOKEN_ADDRESS: Record<string, \`0x\${string}\`> = {\n${ASSETS.map(a => `  '${a.id}': '${deployedTokens[a.id]}',`).join('\n')}\n};\n\nexport const PROTOCOL_CONFIGURED = Object.keys(ASSET_TOKEN_ADDRESS).length === 7;`
  );
  writeFileSync(contractsTs, contractsContent);
  console.log(`✅  contracts.ts auto-updated — real on-chain mode is now ACTIVE\n`);
}

main().catch(e => {
  console.error('\n❌  Fatal error:', e);
  process.exit(1);
});
