// ─────────────────────────────────────────────────────────────────────────────
// Deployed contract addresses — Robinhood Chain (Chain ID 4663)
// Token addresses populated after running contracts/script/setup-protocol.mjs
// ─────────────────────────────────────────────────────────────────────────────

export const LHOOD_TOKEN = '0xb221e90e44d551702c3c989f7155a6afc86796ec' as `0x${string}`;

export const CONTRACTS = {
  LENDING_POOL:               '0xcf689f3eFAbCE22A0f29FE0D47A5fd5d6e7e7291' as `0x${string}`,
  ORACLE_ROUTER:              '0x3b568db680888C7B90e6Bf04B16F190923547956' as `0x${string}`,
  HEALTH_FACTOR_ENGINE:       '0x0A57832CB756e4895FfD1eA09Fa9e309824C36a4' as `0x${string}`,
  INTEREST_RATE_MODEL:        '0xC9457F985Ca56e15F413f01F507BE4Fc23b49426' as `0x${string}`,
  INSURANCE_FUND:             '0x8B1a81cEA55B3272EB493C9e44bFe23c8Ab790df' as `0x${string}`,
  LIQUIDATION_MANAGER:        '0x7C85Bef7E0593E6d0C8F11a80Bc49Aed3412709e' as `0x${string}`,
} as const;

// IsolatedMarketController address is read at runtime from LendingPool.isolatedController()
// to avoid hardcoding — use CONTRACTS.LENDING_POOL + isolatedController ABI view function.

// Token contracts — real Robinhood Chain tokens where available
export const ASSET_TOKEN_ADDRESS: Record<string, `0x${string}`> = {
  'usd-g':  '0x1fad69eaf1f4e9d9470787f51d458a93464833f6', // Custom USDG (18 decimals)
  'weth':   '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', // Real Robinhood Chain WETH
  'virtual': '0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31', // Real Virtuals Protocol token
  'usde':    '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34', // Real Ethena USDe
  'cashcat': '0x020bfC650A365f8BB26819deAAbF3E21291018b4', // Cash Cat (memecoin)
  // ── Real tokenized stocks (robinscan.io) ──────────────────────────────────
  'aapl':  '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', // Apple
  'amzn':  '0x12f190a9F9d7D37a250758b26824B97CE941bF54', // Amazon
  'nvda':  '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', // NVIDIA
  'tsla':  '0x322F0929c4625eD5bAd873c95208D54E1c003b2d', // Tesla
  'mstr':  '0xec262a75e413fAfD0dF80480274532C79D42da09', // Strategy Inc (MSTR)
};

// Per-token decimal precision — critical for parseUnits / formatUnits
export const ASSET_TOKEN_DECIMALS: Record<string, number> = {
  'usd-g':  18,
  'weth':   18,
  'cashcat': 18,
  'virtual': 18,
  'usde':    18,
  'aapl':   18,
  'amzn':   18,
  'nvda':   18,
  'tsla':   18,
  'mstr':   18,
};

export const PROTOCOL_CONFIGURED = Object.keys(ASSET_TOKEN_ADDRESS).length >= 6;

// ─── Flash Liquidator contract ────────────────────────────────────────────────
export const FLASH_LIQUIDATOR = '0xa7c99a3cf3e1c4f317124cb168b066c6d86c0be7' as `0x${string}`;

// ─── DEX contracts (UniswapV2 fork on Robinhood Chain) ────────────────────────
export const DEX = {
  FACTORY: '0xe9df4972491b7e782f4544a8975e0f65d7df897c' as `0x${string}`,
  ROUTER:  '0xa852731d2ff4ece14c702b1e356cfe6808eaa486' as `0x${string}`,
} as const;

/** UniswapV2 pair address for each market asset (asset → pair with WETH or USDG). */
export const DEX_PAIR_ADDRESS: Record<string, `0x${string}`> = {
  'weth':    '0xaE1Dd7ED8f950CcC6AE8BA3e4A3575041694a85F', // WETH/USDG
  'cashcat': '0xAb27bd9aeCe2B61089AB59c08757c668fd092987', // CASHCAT/WETH
  'virtual': '0xE335CCeA8D6D9233d5F37344446c6B36A7f9f430', // VIRTUAL/WETH
};

/**
 * Markets backed by real Robinhood Chain tokens that any user can actually hold.
 * Custom-token markets (USDG) only have deployer seed liquidity.
 * Real robinscan stock tokens start with 0 pool liquidity — show "No Liquidity"
 * until users supply.
 */
export const REAL_MARKET_IDS = new Set(['usd-g', 'cashcat', 'weth', 'virtual', 'usde', 'aapl', 'amzn', 'nvda', 'tsla', 'mstr']);
