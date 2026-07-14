# Liquihood

**Decentralized lending protocol on Robinhood Chain** — borrow against real-world assets (stocks, crypto, meme tokens) with on-chain liquidations, automated interest accrual, and a flash liquidation bot.

## Protocol Overview

Liquihood is an Aave-inspired lending protocol deployed on Robinhood Chain (chain ID 4663). Users can:

- **Supply** USDG, WETH, AAPL, AMZN, TSLA, NVDA, and MEME tokens as collateral
- **Borrow** USDG against supplied collateral
- **Earn** yield through lhTokens (interest-bearing receipt tokens)
- **Liquidate** undercollateralized positions via direct or flash liquidation

## Architecture

| Component | Description |
|---|---|
| `LendingPool.sol` | Core lending, borrowing, and liquidation logic |
| `LiquidationManager.sol` | Collateral seizure calculations with `Math.mulDiv` precision |
| `InterestRateModel.sol` | Utilization-based variable rate model |
| `HealthFactorEngine.sol` | Position health factor computation |
| `OracleRouter.sol` | Multi-source price oracle (keeper-pushed + Chainlink fallback) |
| `InsuranceFund.sol` | Bad debt buffer |
| `IsolatedMarketController.sol` | Per-asset debt ceiling enforcement |
| `MarketHoursPolicy.sol` | Equity market hours enforcement for stock tokens |
| `FlashLiquidator.sol` | Capital-free liquidation via Uniswap V2 flash swaps |

## Smart Contract Addresses (Robinhood Chain, chain ID 4663)

See `contracts/deployments/` for deployed addresses.

## Tech Stack

- **Contracts**: Solidity 0.8.24, Foundry, OpenZeppelin v5
- **Frontend (app)**: React 19, Vite, Tailwind CSS v4, wagmi v3, viem v2
- **Frontend (landing)**: React 19, Vite, Tailwind CSS v4, Framer Motion
- **API**: Express 5, Node.js 24, TypeScript 5.9
- **Monorepo**: pnpm workspaces

## Development

```bash
# Install dependencies
pnpm install

# Run the protocol app
pnpm --filter @workspace/liquihood-app run dev

# Run the landing page
pnpm --filter @workspace/liquihood run dev

# Run the API server
pnpm --filter @workspace/api-server run dev

# Compile contracts
cd contracts && forge build

# Run security scan
cd contracts && slither . --config-file slither.config.json
```

## Security

All contracts have been analyzed with Slither static analysis — **0 findings** after remediation of:
- 3 reentrancy vulnerabilities (CEI pattern fixes)
- 4 precision loss issues (`Math.mulDiv` replacements)
- 5 missing zero-address validations
- 2 uninitialized local variables
- 1 missing interface inheritance
- 4 unused return values

## License

MIT
