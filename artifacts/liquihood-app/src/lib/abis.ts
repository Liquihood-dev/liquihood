// ─────────────────────────────────────────────────────────────────────────────
// Minimal ABIs for Liquihood Protocol contracts
// Derived from contracts/src/*.sol
// ─────────────────────────────────────────────────────────────────────────────

export const LENDING_POOL_ABI = [
  // Core operations
  {
    name: 'supply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_asset', type: 'address' }, { name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_asset', type: 'address' }, { name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'borrow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_asset', type: 'address' }, { name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'repay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_asset', type: 'address' }, { name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  // Governance / owner
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'addReserve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset',     type: 'address' },
      { name: '_irm',       type: 'address' },
      { name: '_isEquity',  type: 'bool'    },
      { name: '_lhName',    type: 'string'  },
      { name: '_lhSymbol',  type: 'string'  },
      { name: '_debtName',  type: 'string'  },
      { name: '_debtSymbol',type: 'string'  },
    ],
    outputs: [],
  },
  {
    name: 'isolatedController',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // View helpers
  {
    name: 'getHealthFactor',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getReserveList',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getUserCollateral',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }, { name: '_asset', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getUserDebt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }, { name: '_asset', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getReserveStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_asset', type: 'address' }],
    outputs: [
      { name: 'totalLiquidity', type: 'uint256' },
      { name: 'totalDebt', type: 'uint256' },
      { name: 'utilizationRate', type: 'uint256' },
    ],
  },
  {
    name: 'reserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'asset', type: 'address' },
      { name: 'lhToken', type: 'address' },
      { name: 'debtToken', type: 'address' },
      { name: 'irm', type: 'address' },
      { name: 'totalLiquidity', type: 'uint256' },
      { name: 'lastUpdateTimestamp', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'borrowingEnabled', type: 'bool' },
      { name: 'isEquityAsset', type: 'bool' },
    ],
  },
  // Events
  {
    name: 'Liquidation',
    type: 'event',
    inputs: [
      { name: 'liquidator',       type: 'address', indexed: true  },
      { name: 'borrower',         type: 'address', indexed: true  },
      { name: 'debtAsset',        type: 'address', indexed: false },
      { name: 'collateralAsset',  type: 'address', indexed: false },
      { name: 'debtRepaid',       type: 'uint256', indexed: false },
      { name: 'collateralSeized', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Supply',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Borrow',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Repay',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Withdraw',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// LiquihoodToken ABI — standard ERC-20 + owner-only mint (no faucet)
export const LIQUIHOOD_TOKEN_ABI = [
  ...ERC20_ABI,
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const ORACLE_ROUTER_ABI = [
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_asset', type: 'address' }],
    outputs: [{ name: 'price', type: 'uint256' }],
  },
  {
    name: 'configureAsset',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_source', type: 'uint8' },   // 0=CHAINLINK 1=KEEPER 2=FIXED
      { name: '_feed', type: 'address' },
      { name: '_fixedPrice', type: 'uint256' },
      { name: '_maxStaleness', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'pushPriceBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_assets', type: 'address[]' },
      { name: '_prices', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'pushPrice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_price', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'authorizedKeepers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_keeper', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'addKeeper',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_keeper', type: 'address' }],
    outputs: [],
  },
  {
    name: 'removeKeeper',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_keeper', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setMaxDeviation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_bps', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'maxDeviationBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const ISOLATED_MARKET_CONTROLLER_ABI = [
  {
    name: 'configureIsolatedAsset',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset',   type: 'address' },
      { name: '_ceiling', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'setAllowedBorrowAsset',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_isolatedAsset', type: 'address' },
      { name: '_borrowAsset',   type: 'address' },
      { name: '_allowed',       type: 'bool'    },
    ],
    outputs: [],
  },
  {
    name: 'isIsolated',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'debtCeiling',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'currentDebt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const HEALTH_FACTOR_ENGINE_ABI = [
  {
    name: 'configureAsset',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_ltv', type: 'uint256' },
      { name: '_liquidationThreshold', type: 'uint256' },
      { name: '_liquidationBonus', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getAssetRiskParams',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_asset', type: 'address' }],
    outputs: [
      { name: 'ltv', type: 'uint256' },
      { name: 'liquidationThreshold', type: 'uint256' },
      { name: 'liquidationBonus', type: 'uint256' },
    ],
  },
] as const;

// ─── UniswapV2 DEX ABIs ───────────────────────────────────────────────────────

export const UNISWAP_V2_FACTORY_ABI = [
  {
    name: 'getPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }],
    outputs: [{ name: 'pair', type: 'address' }],
  },
  {
    name: 'createPair',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }],
    outputs: [{ name: 'pair', type: 'address' }],
  },
  {
    name: 'allPairsLength',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const UNISWAP_V2_ROUTER_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn',     type: 'uint256'   },
      { name: 'amountOutMin', type: 'uint256'   },
      { name: 'path',         type: 'address[]' },
      { name: 'to',           type: 'address'   },
      { name: 'deadline',     type: 'uint256'   },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256'   },
      { name: 'path',     type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA',         type: 'address' },
      { name: 'tokenB',         type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin',     type: 'uint256' },
      { name: 'amountBMin',     type: 'uint256' },
      { name: 'to',             type: 'address' },
      { name: 'deadline',       type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA',    type: 'uint256' },
      { name: 'amountB',    type: 'uint256' },
      { name: 'liquidity',  type: 'uint256' },
    ],
  },
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0',           type: 'uint112' },
      { name: 'reserve1',           type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32'  },
    ],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
