// ─────────────────────────────────────────────────────────────────────────────
// Protocol types & constants
//
// priceUsd: seed values only — overridden every 60s by live prices from
//   CoinGecko (crypto) and Yahoo Finance (equities) via the API server.
//
// totalSupplied / totalBorrowed: start at 0.
//   Real values are read on-chain via useAllReserveStats (getReserveStats batch)
//   and merged into assets within ProtocolProvider on every render cycle.
//   These zeros are only visible for the brief moment before the first RPC
//   response arrives (~1-2 s).
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketState {
  id: string;
  name: string;
  symbol: string;
  tier: 'Stablecoin' | 'Crypto' | 'Equity' | 'Speculative';
  priceUsd: number;
  priceChange24h: number;
  ltv: number;                  // 0–1  max loan-to-value
  liquidationThreshold: number; // 0–1
  liquidationBonus: number;     // e.g. 0.05 = 5%
  supplyCap: number;            // asset units (USD for isolated debt ceiling)
  totalSupplied: number;        // asset units — live from chain
  totalBorrowed: number;        // asset units — live from chain
  borrowCap: number;            // asset units
  isolated: boolean;
  isEquity: boolean;
  oracleSource: string;         // human-readable price source
  decimals?: number;            // ERC-20 decimal places (default 18)
}

// Backwards-compat alias
export type AssetParameters = MarketState;

export interface UserPosition {
  assetId: string;
  supplied: number;
  borrowed: number;
  useAsCollateral: boolean;
}

export interface Transaction {
  id: string;
  type: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay' | 'Liquidation';
  assetId: string;
  amount: number;
  timestamp: number;
  status: 'Completed' | 'Failed' | 'Pending';
  resultingHf: number;
}

// ─── Interest rate model ─────────────────────────────────────────────────────
// Kinked curve: optimal utilization 80%
// Below kink:  borrowApr = (U / 0.80) × 6.5%
// Above kink:  borrowApr = 6.5% + ((U - 0.80) / 0.20) × 60%
// Reserve factor: 10%
export const calculateRates = (totalSupplied: number, totalBorrowed: number) => {
  const utilization = totalSupplied > 0 ? Math.min(totalBorrowed / totalSupplied, 1) : 0;
  let borrowApr: number;
  if (utilization <= 0.8) {
    borrowApr = (utilization / 0.8) * 0.065;
  } else {
    borrowApr = 0.065 + ((utilization - 0.8) / 0.2) * 0.60;
  }
  const supplyApy = borrowApr * utilization * 0.90; // 10% reserve factor
  return { utilization, borrowApr, supplyApy };
};

// ─── Active market list ───────────────────────────────────────────────────────
// totalSupplied / totalBorrowed are 0 here — overwritten by useAllReserveStats.
// priceUsd seed values are overwritten by live API prices within ~1 s of load.
export const INITIAL_ASSETS: MarketState[] = [

  // ── STABLECOIN ───────────────────────────────────────────────────────────────
  {
    id: 'usd-g', name: 'USD Global', symbol: 'USDG', tier: 'Stablecoin',
    priceUsd: 1.0, priceChange24h: 0,
    ltv: 0.86, liquidationThreshold: 0.91, liquidationBonus: 0.04,
    supplyCap: 50_000_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 40_000_000, isolated: false, isEquity: false,
    oracleSource: 'Fixed peg — $1.00',
  },

  // ── CRYPTO ──────────────────────────────────────────────────────────────────
  {
    id: 'weth', name: 'Wrapped Ether', symbol: 'WETH', tier: 'Crypto',
    priceUsd: 1795, priceChange24h: 0,
    ltv: 0.80, liquidationThreshold: 0.85, liquidationBonus: 0.05,
    supplyCap: 5_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 4_000, isolated: false, isEquity: false,
    oracleSource: 'Keeper — ETH/USD',
  },

  // ── STABLECOIN (Real) ────────────────────────────────────────────────────────
  {
    id: 'usde', name: 'Ethena USDe', symbol: 'USDe', tier: 'Stablecoin',
    priceUsd: 1.0, priceChange24h: 0,
    ltv: 0.85, liquidationThreshold: 0.90, liquidationBonus: 0.04,
    supplyCap: 20_000_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 15_000_000, isolated: false, isEquity: false,
    oracleSource: 'Keeper — USDe/USD',
  },

  // ── MEMECOIN ─────────────────────────────────────────────────────────────────
  {
    id: 'cashcat', name: 'Cash Cat', symbol: 'CASHCAT', tier: 'Speculative',
    priceUsd: 0.178, priceChange24h: 0,
    ltv: 0.35, liquidationThreshold: 0.45, liquidationBonus: 0.12,
    supplyCap: 50_000_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 20_000_000, isolated: true, isEquity: false,
    oracleSource: 'Keeper — CASHCAT/USD',
  },

  // ── CRYPTO (Speculative) ─────────────────────────────────────────────────────
  {
    id: 'virtual', name: 'Virtuals Protocol', symbol: 'VIRTUAL', tier: 'Speculative',
    priceUsd: 1.5, priceChange24h: 0,
    ltv: 0.45, liquidationThreshold: 0.55, liquidationBonus: 0.10,
    supplyCap: 2_000_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 1_000_000, isolated: false, isEquity: false,
    oracleSource: 'Keeper — VIRTUAL/USD',
  },

  // ── TOKENIZED EQUITIES (real robinscan.io contracts) ─────────────────────────
  {
    id: 'aapl', name: 'Apple', symbol: 'AAPL', tier: 'Equity',
    priceUsd: 215, priceChange24h: 0,
    ltv: 0.65, liquidationThreshold: 0.75, liquidationBonus: 0.07,
    supplyCap: 50_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 35_000, isolated: false, isEquity: true,
    oracleSource: 'Keeper — AAPL/USD',
  },
  {
    id: 'amzn', name: 'Amazon', symbol: 'AMZN', tier: 'Equity',
    priceUsd: 245, priceChange24h: 0,
    ltv: 0.55, liquidationThreshold: 0.67, liquidationBonus: 0.08,
    supplyCap: 40_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 28_000, isolated: false, isEquity: true,
    oracleSource: 'Keeper — AMZN/USD',
  },
  {
    id: 'nvda', name: 'NVIDIA', symbol: 'NVDA', tier: 'Equity',
    priceUsd: 204, priceChange24h: 0,
    ltv: 0.50, liquidationThreshold: 0.62, liquidationBonus: 0.09,
    supplyCap: 60_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 40_000, isolated: false, isEquity: true,
    oracleSource: 'Keeper — NVDA/USD',
  },
  {
    id: 'tsla', name: 'Tesla', symbol: 'TSLA', tier: 'Equity',
    priceUsd: 393, priceChange24h: 0,
    ltv: 0.40, liquidationThreshold: 0.52, liquidationBonus: 0.10,
    supplyCap: 30_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 20_000, isolated: false, isEquity: true,
    oracleSource: 'Keeper — TSLA/USD',
  },
  {
    id: 'mstr', name: 'Strategy Inc', symbol: 'MSTR', tier: 'Equity',
    priceUsd: 92, priceChange24h: 0,
    ltv: 0.35, liquidationThreshold: 0.47, liquidationBonus: 0.12,
    supplyCap: 100_000, totalSupplied: 0, totalBorrowed: 0,
    borrowCap: 60_000, isolated: false, isEquity: true,
    oracleSource: 'Keeper — MSTR/USD',
  },

];
