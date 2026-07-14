---
name: Real vs custom token addresses
description: Which Liquihood protocol markets use real Robinhood Chain tokens vs custom LiquihoodToken ERC-20s, and why.
---

## Current state (as of 2026-07-13)

| Asset ID | Display | Token address | Type |
|---|---|---|---|
| weth | ETH / Ethereum | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | ✅ Real WETH (decimals=18, supply ~21k) — this IS the ETH equivalent on Robinhood Chain |
| usd-g | USDG | `0x1fad69eaf1f4e9d9470787f51d458a93464833f6` | ⚠️ Custom LiquihoodToken (18 decimals) |
| virtual | VIRTUAL | `0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31` | ✅ Real Virtuals Protocol token (decimals=18, supply ~5.8M) |
| aapl-t | AAPL-T | `0xcebc4394f2f58d5ec9a6f370c59f414c91730c35` | ⚠️ Custom LiquihoodToken |
| tsla-t | TSLA-T | `0xa5d32358aa01063eea9e00dfaec98d0348b05b83` | ⚠️ Custom LiquihoodToken |
| hood-t | HOOD-T | `0xd23722ffa116966b5472c6164b20e04eeb9df5e7` | ⚠️ Custom LiquihoodToken |

## Key design decisions
- The "ETH" market was renamed from id='eth' to id='weth' with symbol='ETH' — WETH IS the real ETH on Robinhood Chain (bridged, NOT a WETH9 wrapper — no deposit/withdraw)
- Native ETH cannot be supplied directly to the pool (no gateway contract deployed)
- Real USDG at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` skipped — decimals=6, would require per-asset decimal support throughout all formatUnits calls
- VIRTUAL fully configured on-chain: HFE, Oracle (KEEPER mode, 5min staleness), LendingPool reserve, keeper pushes prices every 5min, logo served from local asset (TrustWallet PNG)

## Price flow
- API server (prices.ts): CoinGecko `virtual-protocol` → key `VIRTUAL`
- Frontend (src/lib/prices.ts): `SERVER_TO_ASSET` maps `VIRTUAL` → `virtual`
- Keeper (keeper.ts): `{ id: 'virtual', priceKey: 'VIRTUAL' }` → pushes to oracle every 5min

## Migration scripts
- `artifacts/liquihood-app/add-real-weth.mjs` — configures WETH market
- `artifacts/liquihood-app/add-virtual.mjs` — configures VIRTUAL market
- Correct Oracle ABI: `configureAsset(address, uint8 source, address feed, uint256 fixedPrice, uint256 maxStaleness)`
- Correct HFE ABI: `configureAsset(address, uint256 ltv, uint256 lt, uint256 bonus)` — values in RAY (1e27)
- Correct Pool ABI: `addReserve(address, address irm, bool isEquity, string lhName, string lhSymbol, string debtName, string debtSymbol)`

**Why:** Users hold real Robinhood Chain tokens. Protocol must accept those exact ERC-20 addresses or balanceOf returns 0 and supply is impossible.
