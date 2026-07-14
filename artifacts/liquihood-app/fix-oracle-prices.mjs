/**
 * fix-oracle-prices.mjs
 *
 * Migrates oracle stored prices from stale initial values to current market
 * prices. OracleRouter limits each update to ±10% by default; we temporarily
 * raise it to 50%, step each asset toward target in ≤48% increments (re-reads
 * on-chain price before every push to handle keeper concurrency), then
 * restore the limit to 10%.
 *
 * Run: DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY node artifacts/liquihood-app/fix-oracle-prices.mjs
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
};

const ORACLE_ROUTER = '0x9c445077D3826C706A1f39413F2508cc09049827';

const ASSETS = [
  { id: 'eth',    address: '0xe75454ef6858d469bf499f456bc35732fab629db', priceKey: 'ETH'    },
  { id: 'weth',   address: '0x1625619cc04b012aed8522e079d942801977e360', priceKey: 'WETH'   },
  { id: 'aapl-t', address: '0xcebc4394f2f58d5ec9a6f370c59f414c91730c35', priceKey: 'AAPL-T' },
  { id: 'tsla-t', address: '0xa5d32358aa01063eea9e00dfaec98d0348b05b83', priceKey: 'TSLA-T' },
  { id: 'hood-t', address: '0xd23722ffa116966b5472c6164b20e04eeb9df5e7', priceKey: 'HOOD-T' },
  { id: 'doge',   address: '0x9f2b1ba1e5e1b07050b621090cb4e51df2ff77f9', priceKey: 'DOGE'   },
  { id: 'meme-1', address: '0xb554cbf2a8f1ec54a58a8facf081648a10e66c04', priceKey: 'MEME-1' },
];

const ORACLE_ABI = parseAbi([
  'function pushPriceBatch(address[] assets, uint256[] prices)',
  'function setMaxDeviation(uint256 _bps)',
  'function keeperPrices(address) view returns (uint256 price, uint256 updatedAt)',
]);

async function fetchLivePrices() {
  const res = await fetch('http://localhost:8080/api/prices');
  const { prices } = await res.json();
  return prices;
}

const toOnChain = (usd) => BigInt(Math.round(usd * 1e8));
const toUsd     = (bn)  => (Number(bn) / 1e8).toFixed(4);

/** Read stored (possibly stale) price from keeperPrices mapping */
async function readStored(publicClient, addr) {
  const r = await publicClient.readContract({
    address: ORACLE_ROUTER,
    abi: ORACLE_ABI,
    functionName: 'keeperPrices',
    args: [addr],
  });
  return BigInt(r.price ?? r[0] ?? 0n);
}

/** Next step toward target, at most maxBps (basis points) deviation from current */
function nextStep(current, target, maxBps = 4800n) {
  if (target > current) {
    const cap = current + (current * maxBps) / 10000n;
    return target <= cap ? target : cap;
  } else {
    const floor = current - (current * maxBps) / 10000n;
    return target >= floor ? target : floor;
  }
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('❌  DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });

  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  console.log(`\n🔑  Deployer: ${account.address}  nonce: ${nonce}`);

  async function writeTx(params) {
    const hash = await walletClient.writeContract({ ...params, nonce: nonce++ });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  // 1. Fetch live prices from API
  console.log('\n📡  Fetching live prices from API…');
  const livePrices = await fetchLivePrices();

  // 2. Raise max deviation to 50%
  console.log('⚙️   setMaxDeviation(5000) → 50%…');
  await writeTx({
    address: ORACLE_ROUTER,
    abi: ORACLE_ABI,
    functionName: 'setMaxDeviation',
    args: [5000n],
  });
  console.log('   ✅');

  // 3. Step each asset to target — re-read on-chain price before EVERY push
  console.log('\n🔢  Stepping oracle prices…');
  for (const a of ASSETS) {
    const liveUsd = livePrices[a.priceKey];
    if (!liveUsd) { console.log(`   ⚠️  ${a.id}: no live price — skip`); continue; }

    const target = toOnChain(liveUsd);
    console.log(`\n   ${a.id.padEnd(8)} → $${liveUsd}`);

    for (let step = 1; step <= 20; step++) {
      // Always re-read on-chain price to handle keeper concurrency
      const current = await readStored(publicClient, a.address);

      // Done?
      if (current > 0n) {
        const diff = target > current ? target - current : current - target;
        if (diff * 10000n <= current * 10n) { // within 0.1%
          console.log(`      ✅ on-chain: $${toUsd(current)} (done)`);
          break;
        }
      }

      const stepPrice = current === 0n ? target : nextStep(current, target, 4800n);
      process.stdout.write(`      step ${step}: $${toUsd(current)} → $${toUsd(stepPrice)}…`);

      try {
        await writeTx({
          address: ORACLE_ROUTER,
          abi: ORACLE_ABI,
          functionName: 'pushPriceBatch',
          args: [[a.address], [stepPrice]],
        });
        console.log(' ✅');
      } catch (e) {
        // Another tx (keeper) may have raced — bump nonce and retry from fresh price
        nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
        console.log(` ⚠️  race (nonce reset to ${nonce}) — retry`);
      }
    }
  }

  // 4. Restore max deviation to 10%
  console.log('\n⚙️   setMaxDeviation(1000) → 10%…');
  await writeTx({
    address: ORACLE_ROUTER,
    abi: ORACLE_ABI,
    functionName: 'setMaxDeviation',
    args: [1000n],
  });
  console.log('   ✅');

  console.log('\n✅  Oracle prices calibrated. Keeper will now update normally.');
}

main().catch(e => { console.error('\n❌', e.shortMessage || e.message); process.exit(1); });
