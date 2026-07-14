/**
 * continue-setup.mjs
 * Continues from where setup-protocol.mjs left off:
 *  - addReserve for AAPL-T, TSLA-T, HOOD-T, DOGE, MEME-1
 *  - seed initial liquidity for ALL 7 tokens
 *  - update contracts.ts
 */

import { createWalletClient, createPublicClient, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE  = resolve(__dirname, '../..');

const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
};

// ── Deployed addresses ────────────────────────────────────────────────────────

const LENDING_POOL        = '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E';
const INTEREST_RATE_MODEL = '0x419D74beFA27CE808C9c863533193847F25EFb6F';

const TOKENS = {
  'usd-g':  { address: '0x1fad69eaf1f4e9d9470787f51d458a93464833f6', symbol: 'USDG',   name: 'USD Global',           isEquity: false, isolated: false, initialMint: parseUnits('500000',  18) },
  'weth':   { address: '0x1625619cc04b012aed8522e079d942801977e360', symbol: 'WETH',   name: 'Wrapped Ethereum',     isEquity: false, isolated: false, initialMint: parseUnits('200',     18) },
  'aapl-t': { address: '0xcebc4394f2f58d5ec9a6f370c59f414c91730c35', symbol: 'AAPL-T', name: 'Apple Tokenized',      isEquity: true,  isolated: false, initialMint: parseUnits('5000',    18) },
  'tsla-t': { address: '0xa5d32358aa01063eea9e00dfaec98d0348b05b83', symbol: 'TSLA-T', name: 'Tesla Tokenized',      isEquity: true,  isolated: false, initialMint: parseUnits('5000',    18) },
  'hood-t': { address: '0xd23722ffa116966b5472c6164b20e04eeb9df5e7', symbol: 'HOOD-T', name: 'Robinhood Tokenized',  isEquity: true,  isolated: false, initialMint: parseUnits('10000',   18) },
  'doge':   { address: '0x9f2b1ba1e5e1b07050b621090cb4e51df2ff77f9', symbol: 'DOGE',   name: 'Dogecoin',             isEquity: false, isolated: true,  initialMint: parseUnits('5000000', 18) },
  'meme-1': { address: '0xb554cbf2a8f1ec54a58a8facf081648a10e66c04', symbol: 'MEME-1', name: 'PepeDog',              isEquity: false, isolated: true,  initialMint: parseUnits('500000',  18) },
};

const LENDING_POOL_ABI = parseAbi([
  'function addReserve(address asset, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)',
  'function supply(address asset, uint256 amount)',
  'function getReserveList() view returns (address[])',
]);

const ERC20_ABI = parseAbi([
  'function approve(address,uint256) returns (bool)',
  'function mint(address to, uint256 amount)',
]);

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('❌  DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  console.log(`\n🔑  Deployer: ${account.address}`);

  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });

  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  console.log(`📊  Current nonce: ${nonce}\n`);

  async function writeTx(params) {
    const hash = await walletClient.writeContract({ ...params, nonce: nonce++ });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt;
  }

  // ── Step 1: Check which reserves already exist ────────────────────────────
  const reserveList = await publicClient.readContract({
    address: LENDING_POOL,
    abi: LENDING_POOL_ABI,
    functionName: 'getReserveList',
  });
  const existingAddresses = new Set(reserveList.map(a => a.toLowerCase()));
  console.log(`📋  Existing reserves: ${reserveList.length}`);

  // ── Step 2: addReserve for tokens not yet in pool ─────────────────────────
  console.log('\n🏦  Adding missing reserves to LendingPool…');
  for (const [id, tok] of Object.entries(TOKENS)) {
    if (existingAddresses.has(tok.address.toLowerCase())) {
      console.log(`   ⏭  ${tok.symbol} already in pool — skip`);
      continue;
    }
    process.stdout.write(`   ➕  ${tok.symbol}…`);
    await writeTx({
      address: LENDING_POOL,
      abi: LENDING_POOL_ABI,
      functionName: 'addReserve',
      args: [
        tok.address,
        INTEREST_RATE_MODEL,
        tok.isEquity,
        `Liquihood ${tok.name}`,
        `lh${tok.symbol}`,
        `Liquihood Debt ${tok.name}`,
        `d${tok.symbol}`,
      ],
    });
    console.log(' ✅');
  }

  // ── Step 3: Seed liquidity for all tokens ────────────────────────────────
  console.log('\n💧  Seeding initial pool liquidity…');
  for (const [id, tok] of Object.entries(TOKENS)) {
    process.stdout.write(`   💰  ${tok.symbol}…`);

    // Mint to self (tokens are already minted in previous run, skip if balance sufficient)
    try {
      await writeTx({
        address: tok.address,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [account.address, tok.initialMint],
      });
    } catch (e) {
      console.log(` (mint skipped: ${e.shortMessage?.slice(0, 60) || e.message?.slice(0, 60)})`);
    }

    // Approve
    await writeTx({
      address: tok.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LENDING_POOL, tok.initialMint],
    });

    // Supply
    await writeTx({
      address: LENDING_POOL,
      abi: LENDING_POOL_ABI,
      functionName: 'supply',
      args: [tok.address, tok.initialMint],
    });

    console.log(' ✅');
  }

  // ── Step 4: Update contracts.ts ──────────────────────────────────────────
  const contractsTs = join(__dirname, 'src/lib/contracts.ts');
  let content = readFileSync(contractsTs, 'utf8');
  content = content.replace(
    /\/\/ Token contracts.*?export const PROTOCOL_CONFIGURED.*?;/s,
    `// Token contracts — LiquihoodToken (real ERC-20, no faucet) — deployed by setup-protocol.mjs\nexport const ASSET_TOKEN_ADDRESS: Record<string, \`0x\${string}\`> = {\n${
      Object.entries(TOKENS).map(([id, t]) => `  '${id}': '${t.address}',`).join('\n')
    }\n};\n\nexport const PROTOCOL_CONFIGURED = Object.keys(ASSET_TOKEN_ADDRESS).length === 7;`
  );
  writeFileSync(contractsTs, content);
  console.log('\n✅  contracts.ts updated');

  console.log('\n' + '═'.repeat(60));
  console.log('✅  SETUP COMPLETE — all real tokens live on Robinhood Chain');
  console.log('═'.repeat(60));
  for (const [id, tok] of Object.entries(TOKENS)) {
    console.log(`  ${tok.symbol.padEnd(8)} ${tok.address}`);
  }
}

main().catch(e => { console.error('\n❌', e.shortMessage || e.message); process.exit(1); });
