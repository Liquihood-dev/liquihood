/**
 * keeper.ts
 *
 * Price keeper: fetches live prices from the prices API and pushes them
 * to OracleRouter.pushPriceBatch() on Robinhood Chain every 4 minutes.
 *
 * Supports a PRIMARY keeper (DEPLOYER_PRIVATE_KEY) and an optional BACKUP
 * keeper (BACKUP_KEEPER_PRIVATE_KEY) that runs 2 minutes offset from primary.
 * Both keepers must be registered as authorizedKeepers in OracleRouter.
 *
 * Token addresses are loaded from contracts/deployments/tokens.json.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from './logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RPC_URL       = 'https://rpc.mainnet.chain.robinhood.com';
const ORACLE_ROUTER = '0x3b568db680888C7B90e6Bf04B16F190923547956' as `0x${string}`;
const CHAIN_ID      = 4663;
const INTERVAL_MS   = 4 * 60 * 1000; // 4 minutes (staleness = 5 min → 1-min buffer)
const BACKUP_OFFSET = 2 * 60 * 1000; // 2 minute offset for backup keeper

// Maps tokens.json asset ID → prices API key (which uses uppercase / display symbols)
// KEEPER assets only — MUST match OracleRouter.SourceType.KEEPER on-chain.
// USDG and USDe are configured as FIXED (always $1.00) on the oracle — do NOT
// include them here. pushPriceBatch reverts if any asset is SourceType.FIXED.
const KEEPER_ASSETS: { id: string; priceKey: string }[] = [
  { id: 'eth',     priceKey: 'ETH'     },
  { id: 'weth',    priceKey: 'WETH'    },
  { id: 'cashcat', priceKey: 'CASHCAT' },
  { id: 'virtual', priceKey: 'VIRTUAL' },
  // Real robinscan.io tokenized stocks
  { id: 'aapl',    priceKey: 'AAPL-T'  },
  { id: 'amzn',    priceKey: 'AMZN-T'  },
  { id: 'nvda',    priceKey: 'NVDA-T'  },
  { id: 'tsla',    priceKey: 'TSLA-T'  },
  { id: 'mstr',    priceKey: 'MSTR'    },
];

const ORACLE_ABI = parseAbi([
  'function pushPriceBatch(address[] assets, uint256[] prices)',
  'function setMaxDeviation(uint256 _bps)',
  'function maxDeviationBps() view returns (uint256)',
  'function authorizedKeepers(address) view returns (bool)',
  'function addKeeper(address _keeper)',
]);

const robinhoodChain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

// ─── Token address loader ─────────────────────────────────────────────────────

function loadTokenAddresses(): Record<string, string> | null {
  const tokensPath = resolve(__dirname, '../../../contracts/deployments/tokens.json');
  if (!existsSync(tokensPath)) {
    logger.info('keeper: contracts/deployments/tokens.json not found — run setup-protocol.mjs first');
    return null;
  }
  try {
    return JSON.parse(readFileSync(tokensPath, 'utf8'));
  } catch (e) {
    logger.error({ err: e }, 'keeper: failed to parse tokens.json');
    return null;
  }
}

// ─── Price push ───────────────────────────────────────────────────────────────

/** Convert float price (USD) to 8-decimal bigint for OracleRouter. */
function toUsd8(price: number): bigint {
  return BigInt(Math.round(price * 1e8));
}

/**
 * Ensure OracleRouter.maxDeviationBps is at least 5000 (50%).
 * Called at startup; non-fatal if it fails (old oracle may not support it).
 */
async function ensureMaxDeviation(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  try {
    const current = await publicClient.readContract({
      address: ORACLE_ROUTER,
      abi: ORACLE_ABI,
      functionName: 'maxDeviationBps',
    }) as bigint;

    if (Number(current) < 5000) {
      logger.info({ currentBps: Number(current) }, 'keeper: raising maxDeviationBps to 5000 (50%)');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await (walletClient as any).writeContract({
        address: ORACLE_ROUTER,
        abi: ORACLE_ABI,
        functionName: 'setMaxDeviation',
        args: [5000n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      logger.info({ txHash: hash }, 'keeper: maxDeviationBps set to 5000');
    } else {
      logger.info({ currentBps: Number(current) }, 'keeper: maxDeviationBps already sufficient');
    }
  } catch (e: any) {
    logger.warn({ err: e?.shortMessage ?? e?.message ?? String(e) }, 'keeper: failed to set maxDeviationBps (non-fatal)');
  }
}

/**
 * Core keeper cycle: fetch prices and push batch to OracleRouter.
 */
async function runKeeperCycle(
  apiBaseUrl: string,
  privateKey: `0x${string}`,
  label: string,
) {
  const tokenAddresses = loadTokenAddresses();
  if (!tokenAddresses) return;

  // Fetch live prices from the API server (already aggregated + median)
  let livePrices: Record<string, number>;
  let liveMeta: Record<string, { sources: string[]; spread: number; confident: boolean }> | undefined;
  try {
    const res = await fetch(`${apiBaseUrl}/api/prices`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as {
      prices: Record<string, number>;
      meta?: Record<string, { sources: string[]; spread: number; confident: boolean }>;
    };
    livePrices = data.prices;
    liveMeta   = data.meta;
  } catch (e: any) {
    logger.error({ err: e, keeper: label }, 'keeper: failed to fetch prices');
    return;
  }

  // Build arrays for pushPriceBatch — skip assets where price confidence is low
  const assets: `0x${string}`[] = [];
  const prices: bigint[] = [];
  const skipped: string[] = [];

  for (const { id, priceKey } of KEEPER_ASSETS) {
    const addr  = tokenAddresses[id];
    const price = livePrices[priceKey];
    if (!addr || !price || price <= 0) continue;

    // Skip if multi-source disagrees (spread > 5%) to avoid pushing bad data
    const assetMeta = liveMeta?.[priceKey];
    if (assetMeta && !assetMeta.confident) {
      skipped.push(`${priceKey}(spread ${(assetMeta.spread * 100).toFixed(1)}%)`);
      continue;
    }

    assets.push(addr as `0x${string}`);
    prices.push(toUsd8(price));
  }

  if (skipped.length > 0) {
    logger.warn({ skipped, keeper: label }, 'keeper: skipped assets due to low price confidence');
  }

  if (assets.length === 0) {
    logger.info({ keeper: label }, 'keeper: no valid prices to push');
    return;
  }

  logger.info({
    keeper: label,
    assetCount: assets.length,
    pricesSample: assets.slice(0, 3).map((a, i) => `${a.slice(0, 8)}…=$${Number(prices[i]) / 1e8}`),
  }, 'keeper: pushing prices on-chain');

  try {
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: robinhoodChain,
      transport: http(),
    });

    const hash = await walletClient.writeContract({
      address: ORACLE_ROUTER,
      abi: ORACLE_ABI,
      functionName: 'pushPriceBatch',
      args: [assets, prices],
    });

    logger.info({ keeper: label, txHash: hash }, 'keeper: prices pushed successfully');
  } catch (e: any) {
    logger.error({ keeper: label, err: e?.shortMessage ?? e?.message ?? String(e) }, 'keeper: on-chain push failed');
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

let keeperStarted = false;

export function startKeeper(apiBaseUrl: string): void {
  if (keeperStarted) return;
  keeperStarted = true;

  const pk = process.env['DEPLOYER_PRIVATE_KEY'];
  if (!pk) {
    logger.warn('keeper: DEPLOYER_PRIVATE_KEY not set — price keeper disabled');
    return;
  }

  const primaryKey  = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
  const backupPkRaw = process.env['BACKUP_KEEPER_PRIVATE_KEY'];
  const backupKey   = backupPkRaw
    ? ((backupPkRaw.startsWith('0x') ? backupPkRaw : `0x${backupPkRaw}`) as `0x${string}`)
    : null;

  logger.info({
    intervalMin:  INTERVAL_MS / 60000,
    hasBackup:    !!backupKey,
    backupOffset: backupKey ? `${BACKUP_OFFSET / 60000} min` : 'n/a',
  }, 'keeper: starting price keeper');

  const primaryAccount = privateKeyToAccount(primaryKey);
  const walletClient   = createWalletClient({ account: primaryAccount, chain: robinhoodChain, transport: http() });
  const publicClient   = createPublicClient({ chain: robinhoodChain, transport: http() });

  // Raise max deviation to 50% once at startup
  setTimeout(async () => {
    await ensureMaxDeviation(walletClient, publicClient);
    await runKeeperCycle(apiBaseUrl, primaryKey, 'primary');
  }, 30_000);

  setInterval(() => runKeeperCycle(apiBaseUrl, primaryKey, 'primary'), INTERVAL_MS);

  // ── Backup keeper (if configured) ──────────────────────────────────────────
  if (backupKey) {
    const backupAddr = privateKeyToAccount(backupKey).address;
    logger.info({ backupAddress: backupAddr }, 'keeper: backup keeper configured');

    // Backup runs with a 2-minute offset so primary and backup interleave
    setTimeout(async () => {
      // Verify backup is authorized on the new OracleRouter
      try {
        const isAuth = await publicClient.readContract({
          address: ORACLE_ROUTER,
          abi: ORACLE_ABI,
          functionName: 'authorizedKeepers',
          args: [backupAddr],
        }) as boolean;
        if (!isAuth) {
          logger.warn({ backupAddress: backupAddr }, 'keeper: backup address not authorized in OracleRouter — skipping backup cycle');
          return;
        }
      } catch {
        // Old oracle without multi-keeper — skip backup silently
        logger.info('keeper: OracleRouter does not support multi-keeper (old version) — backup skipped');
        return;
      }

      logger.info({ backupAddress: backupAddr }, 'keeper: backup keeper authorized — starting backup cycles');
      await runKeeperCycle(apiBaseUrl, backupKey, 'backup');
      setInterval(() => runKeeperCycle(apiBaseUrl, backupKey, 'backup'), INTERVAL_MS);
    }, 30_000 + BACKUP_OFFSET);
  }
}
