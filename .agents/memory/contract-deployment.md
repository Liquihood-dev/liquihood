---
name: Liquihood Contract Deployment
description: Deployed contract addresses on Robinhood Chain mainnet (Chain ID 4663) — v2 with multi-keeper oracle hardening.
---

## Deployed Addresses — v2 (multi-keeper oracle hardening)

Deployer: `0x12b502D89f3aF07633a1A8D34C122C87e58a5eb3`
Deployed: 2026-07-14 via `contracts/script/RedeployAll.s.sol`

| Contract                 | Address                                       |
|--------------------------|-----------------------------------------------|
| LendingPool              | `0xcf689f3eFAbCE22A0f29FE0D47A5fd5d6e7e7291` |
| OracleRouter             | `0x3b568db680888C7B90e6Bf04B16F190923547956`  |
| HealthFactorEngine       | `0x0A57832CB756e4895FfD1eA09Fa9e309824C36a4`  |
| InterestRateModel        | `0xC9457F985Ca56e15F413f01F507BE4Fc23b49426`  |
| InsuranceFund            | `0x8B1a81cEA55B3272EB493C9e44bFe23c8Ab790df`  |
| LiquidationManager       | `0x7C85Bef7E0593E6d0C8F11a80Bc49Aed3412709e`  |
| IsolatedMarketController | `0x6ED9CcB936384Ea0BCD3d872E7D92F9dD7d16eAD`  |
| MarketHoursPolicy        | `0x2421532bD2936BC8f3A7Fd33907E5705ddE50783`  |

All addresses saved to `contracts/deployments/addresses.json` (canonical source of truth from v2 onward).

## Previous v1 Addresses (abandoned — no user funds)

| Contract      | Address                                       |
|---------------|-----------------------------------------------|
| LendingPool   | `0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E` |
| OracleRouter  | `0x9c445077D3826C706A1f39413F2508cc09049827`  |

**Why full redeploy:** LendingPool v1 lacked `setOracle()`. Adding it required redeploying LendingPool bytecode. TVL was seed-only (<$6), so no user funds were at risk.

## Oracle Upgrade — What Changed

- `OracleRouter.sol`: replaced single `keeper` address with `mapping(address => bool) public authorizedKeepers`. Added `addKeeper(address)` / `removeKeeper(address)` (onlyOwner). Both `pushPrice` and `pushPriceBatch` check `authorizedKeepers[msg.sender]`. Default `maxDeviationBps` = 5000 (50%).
- `LendingPool.sol`: added `setOracle(address)` governance function (onlyOwner).
- Keeper startup registers backup keeper only if `authorizedKeepers[backupAddr]` returns true — gracefully skips if not whitelisted.

## Token Addresses (unchanged across v1 → v2)

| Token   | Address                                       |
|---------|-----------------------------------------------|
| USDG    | `0x1FaD69eaf1f4E9d9470787f51D458A93464833F6` |
| USDe    | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` |
| ETH     | `0xE75454eF6858D469bf499f456Bc35732FAb629dB` |
| WETH    | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| VIRTUAL | `0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31` |
| CASHCAT | `0x020bfC650A365f8BB26819deAAbF3E21291018b4` |
| AAPL    | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` |
| AMZN    | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` |
| NVDA    | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` |
| TSLA    | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` |
| MSTR    | `0xec262a75e413fAfD0dF80480274532C79D42da09` |

## Rate Model Parameters (unchanged)
- Optimal utilization: 80%
- Base rate: 0%, Slope 1: 6.5% annual, Slope 2: 60% annual
- Reserve factor: 10%, Close factor: 50%

## CASHCAT Isolated Market
- Debt ceiling: 100,000 USDG
- Allowed borrow asset: USDG only
- LTV: 35%, Liquidation threshold: 45%, Bonus: 12%

## ProtocolNameRegistry — `0x2aba92C18A85F5bb8816Dc9373d8D8db1B209C1c`
ENS names still point to v1 addresses. To update, rerun `contracts/script/RegisterNames.s.sol`.
