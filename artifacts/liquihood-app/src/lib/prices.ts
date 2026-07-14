// Fetches live asset prices from the API-server price proxy.
// Maps protocol assetId (lowercase-hyphenated) → USD price + 24h change fraction.

export interface LivePrices {
  prices: Record<string, number>;
  change24h: Record<string, number>;
  updatedAt: number;
}

// Server symbol → protocol assetId
const SERVER_TO_ASSET: Record<string, string> = {
  USDG:    'usd-g',
  USDC:    'usd-c',
  USDT:    'usdt',
  DAI:     'dai',
  ETH:     'eth',
  WETH:    'weth',
  WBTC:    'wbtc',
  BNB:     'bnb',
  SOL:     'sol',
  AVAX:    'avax',
  LINK:    'link',
  UNI:     'uni',
  // Real robinscan.io tokenized stocks
  'AAPL-T': 'aapl',
  'AMZN-T': 'amzn',
  'NVDA-T': 'nvda',
  'TSLA-T': 'tsla',
  'MSTR':   'mstr',
  VIRTUAL:  'virtual',
  USDe:     'usde',
  LHOOD:    'lhood',
};

const FALLBACK_PRICES: Record<string, number> = {
  'usd-g': 1,   'usd-c': 1,   usdt: 1,     dai: 1,
  eth: 1795,    weth: 1795,   wbtc: 64100,  bnb: 576,    sol: 77.8,
  avax: 6.7,    link: 7.98,   uni: 3.57,    virtual: 1.5, usde: 1.0, lhood: 0.10,
  aapl: 215,    amzn: 245,    nvda: 204,    tsla: 393,    mstr: 92,
};

const ZERO_CHANGE = Object.fromEntries(Object.keys(FALLBACK_PRICES).map(k => [k, 0]));

export const FALLBACK: LivePrices = { prices: FALLBACK_PRICES, change24h: ZERO_CHANGE, updatedAt: 0 };

export async function fetchLivePrices(): Promise<LivePrices> {
  try {
    const res = await fetch('/api/prices', { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return FALLBACK;

    const raw = await res.json() as { prices: Record<string, number>; change24h: Record<string, number>; updatedAt: number };

    const prices: Record<string, number>   = { ...FALLBACK_PRICES };
    const change24h: Record<string, number> = { ...ZERO_CHANGE };

    for (const [serverKey, assetId] of Object.entries(SERVER_TO_ASSET)) {
      const p = raw.prices?.[serverKey];
      const c = raw.change24h?.[serverKey];
      if (typeof p === 'number' && p > 0)        prices[assetId]    = p;
      if (typeof c === 'number' && isFinite(c))  change24h[assetId] = c;
    }

    return { prices, change24h, updatedAt: raw.updatedAt ?? Date.now() };
  } catch {
    return FALLBACK;
  }
}
