import { Router, type IRouter } from 'express';

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceEntry {
  source: string;
  price: number;
}

interface PriceResult {
  price: number;
  change24h: number;
  /** Names of sources that contributed to this price. */
  sources: string[];
  /** Spread between highest and lowest source price, as a fraction (0.02 = 2%). */
  spread: number;
  /** false if spread across sources exceeded 5% threshold — stale price used. */
  confident: boolean;
}

interface PriceCache {
  data: Record<string, number>;
  change24h: Record<string, number>;
  meta: Record<string, { sources: string[]; spread: number; confident: boolean }>;
  ts: number;
}

let cache: PriceCache | null = null;
const TTL = 60_000; // 60s

// Fallback prices (used when external APIs are unavailable)
const DEFAULTS: Record<string, number> = {
  USDG: 1, USDC: 1, USDT: 1, DAI: 1,
  ETH: 1795, WETH: 1795, WBTC: 64100, BNB: 576, SOL: 77.8, AVAX: 6.7, LINK: 7.98, UNI: 3.57,
  VIRTUAL: 1.5, USDe: 1.0, LHOOD: 0.10, CASHCAT: 0.178,
  'AAPL-T': 315, 'MSFT-T': 385, 'NVDA-T': 211, 'AMZN-T': 245, 'GOOGL-T': 357,
  'META-T': 669, 'TSLA-T': 407, 'NFLX-T': 73.4, 'SPY-T': 755, 'COIN-T': 159, 'HOOD-T': 112,
};

const prev      = (k: string) => cache?.data[k]      ?? DEFAULTS[k] ?? 0;
const prevC     = (k: string) => cache?.change24h[k] ?? 0;
const prevMeta  = (k: string): PriceCache['meta'][string] =>
  cache?.meta[k] ?? { sources: ['fallback'], spread: 0, confident: false };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute median of a numeric array. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Aggregate prices from multiple sources.
 * Returns median price + metadata. If spread > 5%, marks as !confident and
 * falls back to the previous cached price to avoid pushing bad data on-chain.
 */
function aggregate(
  sym: string,
  entries: SourceEntry[],
  prevPrice: number,
): { price: number; sources: string[]; spread: number; confident: boolean } {
  const valid = entries.filter(e => e.price > 0);
  if (valid.length === 0) {
    return { price: prevPrice, sources: ['fallback'], spread: 0, confident: false };
  }

  const prices = valid.map(e => e.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const mid = median(prices);
  const spread = lo > 0 ? (hi - lo) / lo : 0;
  const confident = spread <= 0.05; // 5% threshold

  // If spread too large, log a warning and use previous price to avoid bad push
  if (!confident && prevPrice > 0) {
    console.warn(`[prices] ${sym}: spread ${(spread * 100).toFixed(2)}% > 5% — using cached price`);
    return {
      price: prevPrice,
      sources: valid.map(e => e.source),
      spread,
      confident: false,
    };
  }

  return {
    price: mid,
    sources: valid.map(e => e.source),
    spread,
    confident: valid.length >= 2 ? confident : true, // single source always confident (no spread)
  };
}

// ─── Price fetchers ───────────────────────────────────────────────────────────

/** CoinGecko: batch fetch crypto prices + 24h change. */
async function fetchCoinGecko(): Promise<{
  prices: Record<string, number>;
  change24h: Record<string, number>;
}> {
  const cgIds = 'ethereum,bitcoin,binancecoin,solana,avalanche-2,chainlink,uniswap,dogecoin,virtual-protocol,ethena-usde';
  const cgMap: Record<string, string[]> = {
    ethereum:           ['ETH', 'WETH'],
    bitcoin:            ['WBTC'],
    binancecoin:        ['BNB'],
    solana:             ['SOL'],
    'avalanche-2':      ['AVAX'],
    chainlink:          ['LINK'],
    uniswap:            ['UNI'],
    dogecoin:           ['DOGE'],
    'virtual-protocol': ['VIRTUAL'],
    'ethena-usde':      ['USDe'],
  };

  const out: { prices: Record<string, number>; change24h: Record<string, number> } =
    { prices: {}, change24h: {} };

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } },
    );
    if (r.ok) {
      const d = await r.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
      for (const [id, syms] of Object.entries(cgMap)) {
        for (const sym of syms) {
          if (d[id]?.usd) {
            out.prices[sym]    = d[id].usd!;
            out.change24h[sym] = (d[id].usd_24h_change ?? 0) / 100;
          }
        }
      }
    }
  } catch { /* silently fall through */ }
  return out;
}

/** Binance REST: batch fetch spot prices for liquid crypto pairs. */
async function fetchBinance(): Promise<Record<string, number>> {
  // Binance symbols → our internal keys
  const binanceMap: Record<string, string[]> = {
    ETHUSDT:     ['ETH', 'WETH'],
    BTCUSDT:     ['WBTC'],
    BNBUSDT:     ['BNB'],
    SOLUSDT:     ['SOL'],
    AVAXUSDT:    ['AVAX'],
    LINKUSDT:    ['LINK'],
    UNIUSDT:     ['UNI'],
    DOGEUSDT:    ['DOGE'],
  };
  const symbols = Object.keys(binanceMap);
  const out: Record<string, number> = {};

  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'application/json' },
    });
    if (r.ok) {
      const data = await r.json() as Array<{ symbol: string; price: string }>;
      for (const { symbol, price } of data) {
        const syms = binanceMap[symbol];
        if (syms && parseFloat(price) > 0) {
          for (const sym of syms) out[sym] = parseFloat(price);
        }
      }
    }
  } catch { /* silently fall through */ }
  return out;
}

/** Yahoo Finance: individual equity ticker fetch. */
async function fetchEquity(ticker: string): Promise<{ price: number; change24h: number }> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } },
    );
    if (r.ok) {
      const d = await r.json() as any;
      const meta = d?.chart?.result?.[0]?.meta;
      return {
        price:     meta?.regularMarketPrice            ?? 0,
        change24h: (meta?.regularMarketChangePercent   ?? 0) / 100,
      };
    }
  } catch { /* fall through */ }
  return { price: 0, change24h: 0 };
}

/** DexScreener: single token by contract address. */
async function fetchDexScreener(tokenAddress: string): Promise<{ price: number; change24h: number }> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' } },
    );
    if (r.ok) {
      const d = await r.json() as { pairs?: Array<{ priceUsd?: string; priceChange?: { h24?: number } }> };
      const pair = d.pairs?.[0];
      if (pair?.priceUsd && parseFloat(pair.priceUsd) > 0) {
        return {
          price:     parseFloat(pair.priceUsd),
          change24h: (pair.priceChange?.h24 ?? 0) / 100,
        };
      }
    }
  } catch { /* fall through */ }
  return { price: 0, change24h: 0 };
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get('/prices', async (_req, res) => {
  if (cache && Date.now() - cache.ts < TTL) {
    return res.json({
      prices:    cache.data,
      change24h: cache.change24h,
      meta:      cache.meta,
      updatedAt: cache.ts,
    });
  }

  // Kick off all external fetches in parallel
  const [cgResult, binanceResult] = await Promise.all([
    fetchCoinGecko(),
    fetchBinance(),
  ]);

  // Equities — fetch in parallel
  const stocks: [string, string][] = [
    ['AAPL-T', 'AAPL'], ['MSFT-T', 'MSFT'], ['NVDA-T', 'NVDA'], ['AMZN-T', 'AMZN'],
    ['GOOGL-T', 'GOOGL'], ['META-T', 'META'], ['TSLA-T', 'TSLA'], ['NFLX-T', 'NFLX'],
    ['SPY-T',  'SPY'],  ['COIN-T', 'COIN'], ['HOOD-T', 'HOOD'], ['MSTR', 'MSTR'],
  ];

  // DexScreener for on-chain tokens
  const [
    stockResults,
    cashcatDex,
    lhoodDex,
  ] = await Promise.all([
    Promise.all(stocks.map(([sym, ticker]) =>
      fetchEquity(ticker).then(r => ({ sym, ...r }))
    )),
    fetchDexScreener('0x020bfC650A365f8BB26819deAAbF3E21291018b4'), // CASHCAT
    fetchDexScreener('0xb221e90e44d551702c3c989f7155a6afc86796ec'), // LHOOD
  ]);

  // ─── Build final prices ───────────────────────────────────────────────────

  const prices: Record<string, number>    = { USDG: 1, USDC: 1, USDT: 1, DAI: 1, USDe: 1, 'MEME-1': prev('MEME-1') };
  const change24h: Record<string, number> = { USDG: 0, USDC: 0, USDT: 0, DAI: 0, USDe: 0, 'MEME-1': 0 };
  const meta: PriceCache['meta']          = {
    USDG: { sources: ['fixed'], spread: 0, confident: true },
    USDC: { sources: ['fixed'], spread: 0, confident: true },
    USDT: { sources: ['fixed'], spread: 0, confident: true },
    DAI:  { sources: ['fixed'], spread: 0, confident: true },
    USDe: { sources: ['fixed'], spread: 0, confident: true },
    'MEME-1': prevMeta('MEME-1'),
  };

  // Crypto: aggregate CoinGecko + Binance
  const cryptoKeys = ['ETH', 'WETH', 'WBTC', 'BNB', 'SOL', 'AVAX', 'LINK', 'UNI', 'DOGE', 'VIRTUAL'];
  for (const sym of cryptoKeys) {
    const entries: SourceEntry[] = [];
    if (cgResult.prices[sym])     entries.push({ source: 'coingecko', price: cgResult.prices[sym] });
    if (binanceResult[sym])       entries.push({ source: 'binance',   price: binanceResult[sym] });

    const agg = aggregate(sym, entries, prev(sym));
    prices[sym]    = agg.price;
    change24h[sym] = cgResult.change24h[sym] ?? prevC(sym);
    meta[sym]      = { sources: agg.sources, spread: agg.spread, confident: agg.confident };
  }

  // Equities: single source (Yahoo Finance) — no spread to check
  for (const { sym, price, change24h: c24 } of stockResults) {
    prices[sym]    = price > 0 ? price : prev(sym);
    change24h[sym] = price > 0 ? c24   : prevC(sym);
    meta[sym]      = price > 0
      ? { sources: ['yahoo'], spread: 0, confident: true }
      : { ...prevMeta(sym), confident: false };
  }

  // CASHCAT: DexScreener primary, CoinGecko fallback
  {
    const entries: SourceEntry[] = [];
    if (cashcatDex.price > 0) entries.push({ source: 'dexscreener', price: cashcatDex.price });
    const agg = aggregate('CASHCAT', entries, prev('CASHCAT'));
    prices['CASHCAT']    = agg.price;
    change24h['CASHCAT'] = cashcatDex.price > 0 ? cashcatDex.change24h : prevC('CASHCAT');
    meta['CASHCAT']      = { sources: agg.sources, spread: agg.spread, confident: agg.confident };
  }

  // LHOOD: DexScreener only
  {
    prices['LHOOD']    = lhoodDex.price > 0 ? lhoodDex.price : prev('LHOOD');
    change24h['LHOOD'] = lhoodDex.price > 0 ? lhoodDex.change24h : prevC('LHOOD');
    meta['LHOOD']      = lhoodDex.price > 0
      ? { sources: ['dexscreener'], spread: 0, confident: true }
      : { ...prevMeta('LHOOD'), confident: false };
  }

  cache = { data: prices, change24h, meta, ts: Date.now() };
  return res.json({ prices, change24h, meta, updatedAt: cache.ts });
});

export default router;
