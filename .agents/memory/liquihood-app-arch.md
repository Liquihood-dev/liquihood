---
name: Liquihood App Architecture
description: Full protocol app at /liquihood-app — real on-chain data flow, deployed addresses, key files, and architecture decisions.
---

## Overview
Full DeFi lending protocol app at `/liquihood-app`. React + Vite + wagmi + Privy. Robinhood Chain (Chain ID 4663).

## Status: FULLY ON-CHAIN — ALL DATA REAL
`PROTOCOL_CONFIGURED = true`. All user positions, reserve stats (TVL, borrowed), and Health Factor are read from the deployed contracts via wagmi batch calls. No localStorage positions or simulated interest accrual.

## Current Contract Addresses (v2 — 2026-07-14)
- LendingPool: `0xcf689f3eFAbCE22A0f29FE0D47A5fd5d6e7e7291`
- OracleRouter: `0x3b568db680888C7B90e6Bf04B16F190923547956`
- HealthFactorEngine: `0x0A57832CB756e4895FfD1eA09Fa9e309824C36a4`
- InterestRateModel: `0xC9457F985Ca56e15F413f01F507BE4Fc23b49426`
Source of truth: `artifacts/liquihood-app/src/lib/contracts.ts`

## Data Flow (as of 2026-07-14)

### Real on-chain (wagmi `useReadContracts` batch):
- **User positions** → `useAllOnChainPositions` → `getUserCollateral` + `getUserDebt` per asset (14 calls batched)
- **Reserve stats (TVL, borrowed)** → `useAllReserveStats` → `getReserveStats` per asset (7 calls batched)
- **Wallet balances** → `useAllWalletBalances` → `balanceOf` per asset (7 calls batched)
- **Health factor** → `useOnChainHealthFactor` → `getHealthFactor`

### Real-time prices (API server proxy):
- Multi-source: CoinGecko + Binance REST (no key needed) + Yahoo Finance + DexScreener
- Computes **median** per asset across valid sources; logs warning if spread >5%, marks `confident: false`
- Response includes `meta: { sources, spread, confident }` per asset
- Keeper pushes every 4 min to OracleRouter; skips assets with `confident: false`
- Backup keeper: reads `BACKUP_KEEPER_PRIVATE_KEY`, runs offset by 2 min; checks `authorizedKeepers[backup]` before starting — gracefully skips if not whitelisted on new oracle

### Still in localStorage (no on-chain event indexer):
- Transaction history (tx hashes + metadata)
- Notifications
- Per-wallet collateral toggle preferences (`collateralPrefs`)

## Key Hooks
- `use-on-chain-data.ts` — ALL read hooks
- `use-protocol.tsx` — Provider: merges chain positions + collateral prefs, handles live prices, executeTransaction

## Active Markets — 10 reserves
Main markets (non-isolated): USDG, WETH, USDe, VIRTUAL, AAPL, AMZN, NVDA, TSLA, MSTR
Isolated market: CASHCAT (100k USDG debt ceiling, borrow USDG only)

## Keeper (api-server)
`artifacts/api-server/src/lib/keeper.ts`
- ORACLE_ROUTER: `0x3b568db680888C7B90e6Bf04B16F190923547956`
- Runs every 4 min; skips unconfident prices
- Path to tokens.json: `resolve(__dirname, '../../../contracts/deployments/tokens.json')` (3 levels up from dist/)

## executeTransaction flow (real path)
1. Compute predictedHf (simulateHf) BEFORE tx for transaction record
2. Approve if needed (Supply/Repay)
3. writeContractAsync → supply/borrow/repay/withdraw
4. waitForTransactionReceipt
5. `void refetchPositions()` + `void refetchStats()` — fire & forget
6. Save transaction with txHash to localStorage; toast "Confirmed"

## Borrow Guard (2026-07-13)
- `isUnsafe = numAmount > 0 && newHf < hfFloor` (removed `&& newHf > 0`)
- Borrow disabled for `REAL_MARKET_IDS` assets when pool liquidity < 0.0001
- Oracle staleness: 600s (10-min window; keeper pushes every 4 min → 6-min buffer)

## Real Stock Markets
5 real robinscan.io tokenized stocks: aapl, amzn, nvda, tsla, mstr
All in `REAL_MARKET_IDS`. Logos bundled as local SVGs in `src/assets/`.
Keeper price keys: AAPL-T, AMZN-T, NVDA-T, TSLA-T, MSTR (Yahoo Finance).
