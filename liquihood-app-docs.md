# Liquihood — Complete App Documentation

> **Version:** 2.1 · **Date:** July 13, 2026 · **Network:** Robinhood Chain (Chain ID 4663)  
> **App:** https://app.liquihood.xyz · **Landing:** https://liquihood.xyz · **GitHub:** https://github.com/Liquihood-dev · **X:** https://x.com/liquihood

---

## Table of Contents

1. [What is Liquihood](#1-what-is-liquihood)
2. [Network & Infrastructure](#2-network--infrastructure)
3. [Deployed Contracts](#3-deployed-contracts)
4. [Supported Assets](#4-supported-assets)
5. [App Pages & Features](#5-app-pages--features)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [Markets](#52-markets)
   - 5.3 [Earn (Supply)](#53-earn-supply)
   - 5.4 [Borrow](#54-borrow)
   - 5.5 [Liquidation Explorer](#55-liquidation-explorer)
   - 5.6 [Transparency](#56-transparency)
   - 5.7 [Asset Detail](#57-asset-detail)
   - 5.8 [History](#58-history)
   - 5.9 [Create Market (Admin)](#59-create-market-admin)
6. [Core Mechanics](#6-core-mechanics)
   - 6.1 [Health Factor](#61-health-factor)
   - 6.2 [Interest Rate Model](#62-interest-rate-model)
   - 6.3 [Oracle System](#63-oracle-system)
   - 6.4 [Market Hours Policy](#64-market-hours-policy)
   - 6.5 [Liquidation Engine](#65-liquidation-engine)
   - 6.6 [Insurance Fund](#66-insurance-fund)
   - 6.7 [Isolated Markets](#67-isolated-markets)
7. [Risk Parameters](#7-risk-parameters)
8. [Transaction Flows](#8-transaction-flows)
9. [Wallet & Network Setup](#9-wallet--network-setup)
10. [Glossary](#10-glossary)

---

## 1. What is Liquihood

Liquihood is a **non-custodial, overcollateralized, pooled lending protocol** deployed on Robinhood Chain. It lets users borrow **USDG** (Global Dollar, issued by Paxos) against a basket of tokenized assets — including tokenized US equities (Stock Tokens), Ethereum, and stablecoins — without selling their positions.

### One-sentence summary

> Deposit tokenized stocks or crypto as collateral, borrow USDG against them, repay anytime, keep your market exposure throughout.

### What Liquihood is

- A two-sided protocol: **suppliers** deposit USDG to earn yield; **borrowers** post collateral to draw USDG.
- A **pooled lending model** (Aave-style) — not a CDP/stablecoin issuer. Liquihood cannot mint USDG.
- **Universal collateral**: equities, crypto, and stablecoins all accepted under one Health Factor system, with risk-tiered parameters per asset class.
- **Fully on-chain**: all logic runs on Robinhood Chain. Non-custodial. No off-chain accounts.

### What Liquihood is not

- Not a stablecoin issuer — it cannot create USDG.
- Not a brokerage or margin product — no rehypothecation, no off-chain accounts.
- Not a guarantee of liquidity — borrow capacity depends on supplied USDG and pool utilization.
- Not affiliated with or endorsed by Robinhood Markets, Inc.

### Key differentiators

| Feature | Liquihood | Typical DeFi Lending |
|---|---|---|
| Tokenized equity as collateral | ✅ (AAPL-T, TSLA-T, HOOD-T) | ❌ |
| NYSE market-hours risk gate | ✅ (automatic) | ❌ |
| Gap-buffered liquidation thresholds for equities | ✅ | ❌ |
| Isolated markets for speculative assets | ✅ | Sometimes |
| Single borrow asset (USDG) | ✅ (clean UX) | Usually multiple |

---

## 2. Network & Infrastructure

| Property | Value |
|---|---|
| **Blockchain** | Robinhood Chain |
| **Chain ID** | 4663 |
| **RPC URL** | `https://rpc.mainnet.chain.robinhood.com` |
| **Native gas token** | ETH |
| **Block time** | ~100ms |
| **L2 stack** | Arbitrum Orbit |
| **Sequencer** | Operated by Robinhood (single sequencer) |
| **Explorer** | https://explorer.robinhood.com |

### Adding Robinhood Chain to your wallet

In MetaMask, Rabby, or any EVM wallet:

```
Network name:  Robinhood Chain
RPC URL:       https://rpc.mainnet.chain.robinhood.com
Chain ID:      4663
Currency:      ETH
Explorer:      https://explorer.robinhood.com
```

---

## 3. Deployed Contracts

All 8 core Liquihood contracts are live on Robinhood Chain mainnet. All addresses are source-deployed and wired — no proxies or placeholders. An ENS-compatible on-chain name registry (`ProtocolNameRegistry`) allows resolving any contract by name.

### Core Contracts

| Contract | ENS Name | Address |
|---|---|---|
| **LendingPool** | `pool.liquihood` | `0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E` |
| **OracleRouter** | `oracle.liquihood` | `0x9c445077D3826C706A1f39413F2508cc09049827` |
| **InterestRateModel** | `rates.liquihood` | `0x419D74beFA27CE808C9c863533193847F25EFb6F` |
| **HealthFactorEngine** | `health.liquihood` | `0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA` |
| **InsuranceFund** | `insurance.liquihood` | `0xb89Bc97cA63A4Beb1edeD769E13CE1E441Eeb87F` |
| **LiquidationManager** | `liquidator.liquihood` | `0x13EC47404D1a54D7Bed50Cda76D41254319de3CE` |
| **IsolatedMarketController** | `isolated.liquihood` | resolved from `LendingPool.isolatedController()` |
| **MarketHoursPolicy** | `hours.liquihood` | `0xe71dbE28d26208648644d11e6f92D6305c2561Cb` |
| **ProtocolNameRegistry** | — | `0x2aba92C18A85F5bb8816Dc9373d8D8db1B209C1c` |

### Resolve any contract on-chain

```solidity
// Using ProtocolNameRegistry
registry.resolve("pool.liquihood")
// → 0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E
```

### Asset Token Addresses

| Asset | Symbol | Contract Address |
|---|---|---|
| USD Global | USDG | `0x1fad69eaf1f4e9d9470787f51d458a93464833f6` |
| Ethereum | ETH | `0xe75454ef6858d469bf499f456bc35732fab629db` |
| Wrapped Ethereum | WETH | `0x1625619cc04b012aed8522e079d942801977e360` |
| Apple Tokenized | AAPL-T | `0xcebc4394f2f58d5ec9a6f370c59f414c91730c35` |
| Tesla Tokenized | TSLA-T | `0xa5d32358aa01063eea9e00dfaec98d0348b05b83` |
| Robinhood Tokenized | HOOD-T | `0xd23722ffa116966b5472c6164b20e04eeb9df5e7` |

---

## 4. Supported Assets

Liquihood currently has **6 active assets** across 3 tiers in the Main Market. No Isolated Market assets are listed at launch — the infrastructure is deployed and ready.

### Asset Tiers

| Tier | Assets | Characteristics |
|---|---|---|
| **Stablecoin** | USDG | Fixed $1.00 peg, highest LTV, lowest liquidation bonus |
| **Crypto** | ETH, WETH | 24/7 trading, standard DeFi collateral |
| **Equity** | AAPL-T, TSLA-T, HOOD-T | Tokenized US stocks, subject to NYSE market-hours policy |
| **Speculative** | *(none listed yet)* | Isolated markets only; infrastructure ready |

### Asset Parameters (Full Table)

| Symbol | Tier | Max LTV | Liq. Threshold | Liq. Bonus | Supply Cap | Oracle Source |
|---|---|---|---|---|---|---|
| USDG | Stablecoin | 86% | 91% | 4% | 50,000,000 | Fixed — $1.00 |
| ETH | Crypto | 80% | 85% | 5% | 5,000 ETH | Keeper — ETH/USD |
| WETH | Crypto | 75% | 80% | 5% | 5,000 WETH | Keeper — ETH/USD |
| AAPL-T | Equity | 60% | 70% | 7% | 80,000 AAPL-T | Keeper — AAPL/USD |
| TSLA-T | Equity | 38% | 48% | 10% | 40,000 TSLA-T | Keeper — TSLA/USD |
| HOOD-T | Equity | 42% | 52% | 10% | 100,000 HOOD-T | Keeper — HOOD/USD |

> **LTV (Loan-to-Value):** Maximum you can borrow relative to your collateral value.  
> **Liquidation Threshold:** The point at which your position becomes liquidatable (always higher than LTV — the gap is your safety buffer).  
> **Liquidation Bonus:** The extra collateral a liquidator receives for repaying your debt, incentivizing them to keep the pool solvent.

### Equity assets — special behavior

- **Lower LTVs** than crypto: accounts for overnight/weekend price gaps ("gap risk") and issuer credit risk.
- **Market-hours gate**: new borrows and collateral withdrawals are restricted when NYSE/Nasdaq is closed (see §6.4).
- **Prices update only during trading hours** — the keeper pushes live prices every 5 minutes while markets are open.

---

## 5. App Pages & Features

### 5.1 Dashboard

**Route:** `/` (home after wallet connection)

The Dashboard is the central control panel for a user's active position. It shows the complete picture of your Liquihood account in real time.

#### What you see

| Panel | Description |
|---|---|
| **Health Factor** | Your position's solvency score (HF > 1.02 = safe, HF ≤ 1.0 = liquidatable). Displayed prominently with a color indicator (green / yellow / red). |
| **HF Sparkline** | 30-day History of your Health Factor plotted from confirmed on-chain transactions. |
| **Total Collateral** | USD value of all assets deposited as collateral, weighted by Liquidation Threshold. |
| **Total Debt** | Total outstanding USDG borrowed. |
| **Available to Borrow** | Maximum additional USDG you can borrow while maintaining HF ≥ 1.02. |
| **Net Worth** | Total supplied value minus total borrowed value. |
| **Supplied Assets** | Table of each asset you've deposited: amount, USD value, current supply APY, "Use as Collateral" toggle, and Supply/Withdraw action buttons. |
| **Borrowed Assets** | Table of outstanding borrows: amount, USD value, current borrow APR, Repay button. |
| **PnL Badge** | Estimated profit/loss from interest earned vs. interest paid. |
| **Position Alert Panel** | Live warnings when HF is in a risky range (< 1.3). |

#### Actions available on Dashboard

| Action | Description |
|---|---|
| **Supply** | Deposit any supported asset into the pool. |
| **Withdraw** | Pull supplied assets back to your wallet (HF-gated). |
| **Borrow** | Draw USDG from the pool against your collateral. |
| **Repay** | Pay back outstanding USDG debt (partially or fully). |
| **Toggle Collateral** | Enable or disable any supplied asset as collateral for borrowing. |
| **Risk Simulator** | Open a drawer to simulate how price changes would affect your Health Factor before making a decision. |
| **Withdraw All** | Emergency one-click button to exit all supplied positions (two-step confirmation required). |

#### Health Factor color guide

| Range | Color | Status |
|---|---|---|
| HF > 2.0 | 🟢 Green | Very safe |
| 1.5 < HF ≤ 2.0 | 🟢 Green | Safe |
| 1.2 < HF ≤ 1.5 | 🟡 Yellow | Monitor |
| 1.0 < HF ≤ 1.2 | 🔴 Red | Danger — add collateral or repay |
| HF ≤ 1.0 | 💀 Critical | Liquidatable |

---

### 5.2 Markets

**Route:** `/markets`

The Markets page shows an overview of all active lending markets and their live on-chain statistics.

#### Summary stats (top of page)

| Metric | Description |
|---|---|
| **TVL** | Total Value Locked — total USD value of all supplied assets |
| **Total Borrowed** | Total USDG currently drawn from the pool |
| **Available Liquidity** | TVL minus Total Borrowed — immediately withdrawable |

#### Per-asset market rows

Each asset row shows:
- Asset name, symbol, and tier badge
- **Live price** (updated every 5 minutes by keeper)
- **24h price change**
- **Supply APY** — current annualized yield for suppliers
- **Borrow APR** — current annualized cost for borrowers
- **Utilization** — percentage of supplied liquidity currently borrowed (visualized as a progress bar)
- **Max LTV** and **Liquidation Threshold**
- **Total Supplied** vs **Supply Cap**
- **Oracle source** label

#### Expand row

Clicking any row expands it to show:
- Full risk parameter table (LTV, LT, bonus, borrow cap)
- Quick Supply and Quick Borrow action buttons
- Link to full Asset Detail page

#### Filters

- **Search** by name or symbol
- **Tier filter**: All / Stablecoin / Crypto / Equity

---

### 5.3 Earn (Supply)

**Route:** `/earn`

The Earn page is the lender's interface. Suppliers deposit USDG (or other supported assets) into the pool and receive **lhUSDG** (LHTokens) as interest-bearing receipt tokens.

#### How it works

1. Approve and deposit an asset → receive lhTokens at the current exchange rate.
2. Exchange rate increases over time as interest accrues → your lhToken balance is worth more underlying asset on withdrawal.
3. Withdraw any time: burn lhTokens → receive underlying asset at the current (higher) exchange rate.

#### What you see on Earn

| Section | Description |
|---|---|
| **Pool rows** | Each lendable asset: APY, TVL, your deposit balance, accumulated interest earned |
| **Interest Rate Curve chart** | Live visualization of the kinked curve — see how supply APY and borrow APR change at different utilization levels |
| **Your deposit value** | USD equivalent of your current lhToken holdings |
| **Interest earned** | Estimated interest accumulated since your first supply transaction |

#### Key rules for suppliers

- Supply can **never be paused** — you can always deposit.
- Withdrawal may be limited if pool utilization is near 100% (insufficient cash). The punitive kink rate is designed to restore liquidity quickly.
- lhTokens (e.g. lhUSDG) are **freely transferable** ERC-20 tokens — you can hold them in any wallet.

---

### 5.4 Borrow

Borrowing is accessed via action buttons on the **Dashboard** or **Markets** page (no dedicated route — it uses the ActionModal system).

#### Borrow flow

```
1. Deposit collateral (Dashboard → Supply button for any asset)
2. Enable as collateral (toggle if not already enabled)
3. Click "Borrow" → enter USDG amount
4. System checks all gates (see below)
5. If approved → USDG transferred to your wallet, DebtToken minted
```

#### Borrow gates (all must pass, in order)

| Gate | Description |
|---|---|
| Market Active | The collateral market must not be Frozen or Paused |
| Borrow Cap | Total protocol-wide borrows must not exceed the asset's borrow cap |
| Valid Oracle Price | OracleRouter must return a VALID (non-stale, non-deviated) price for every collateral in the position |
| Market Hours | If any borrowing power comes from equity collateral (AAPL-T / TSLA-T / HOOD-T), the NYSE must currently be open |
| Health Factor | Post-borrow HF must be ≥ 1.02 |

#### Repay

- Enter a partial or full amount, or click "Max" to repay all.
- Interest is settled before principal.
- **Repay can never be paused** — you can always repay even during a global protocol freeze.

---

### 5.5 Liquidation Explorer

**Route:** `/liquidations`

Shows the real-time health of the protocol's lending pools and explains how the liquidation system works.

#### Summary cards

| Card | Description |
|---|---|
| **Total Liquidations** | All-time count (indexer integration pending) |
| **Total Repaid** | All-time USDG repaid via liquidations (indexer integration pending) |
| **Pool Health** | Live: "Solvent" (all reserves fully collateralized) or "Bad Debt" (one or more reserves underwater) |

#### Per-asset liquidation parameters

For each asset, the page displays:
- Current liquidation threshold
- Current liquidation bonus
- Close factor (50% normal / 100% for deep breach HF < 0.90 or dust positions < $50)
- Whether the asset is in isolated mode

#### How liquidations work

Anyone can be a liquidator — it is permissionless. When a position's HF drops below 1.0:

```
Liquidator repays part of the borrower's debt
→ Receives borrower's collateral + liquidation bonus
→ 90% of bonus goes to liquidator
→ 10% of bonus goes to Insurance Fund
→ Borrower's debt is partially (or fully) cleared
```

The maximum repayable per call is governed by the **close factor** — normally 50% of debt, so borrowers retain some equity. Full closure (100%) is allowed when HF < 0.90 or position is dust (< $50).

---

### 5.6 Transparency

**Route:** `/transparency`

Full public disclosure of every protocol parameter, price source, governance model, and contract status. No figures are hidden or approximated.

#### Sections

| Section | Content |
|---|---|
| **Risk Parameters table** | LTV, Liquidation Threshold, Liq. Bonus, Supply Cap, Borrow APR — all live from on-chain for every asset |
| **Oracle & Price Sources** | Shows current oracle source per asset (KEEPER / FIXED / CHAINLINK), last price update timestamp ("X seconds ago"), and staleness window |
| **Governance model** | Protocol owner structure, multisig details, timelock delays |
| **Contract status** | All 8 contract addresses with block explorer links |
| **Audit status** | Current state (audits planned; guarded caps apply until completed) |

---

### 5.7 Asset Detail

**Route:** `/assets/:id` (e.g. `/assets/aapl-t`)

Deep-dive page for a single asset showing:
- Full price chart
- All risk parameters
- Supply and borrow utilization
- Historical rates
- Quick Supply / Borrow action buttons

---

### 5.8 History

**Route:** `/history`

A chronological log of every on-chain transaction made by the connected wallet within Liquihood:

| Column | Description |
|---|---|
| **Type** | Supply / Withdraw / Borrow / Repay / Liquidation |
| **Asset** | Which asset was involved |
| **Amount** | Token amount |
| **Status** | Completed / Pending / Failed |
| **Resulting HF** | Your Health Factor immediately after this transaction |
| **Tx Hash** | Clickable link to Robinhood Chain block explorer |

---

### 5.9 Create Market (Admin)

**Route:** `/create-market`

> ⚠️ This page is restricted to the **protocol owner (deployer wallet)** only. Regular users will see a locked state.

Allows the protocol owner to add a new **Isolated Market** for a speculative asset through a 6-step sequential on-chain process:

| Step | Contract | Action |
|---|---|---|
| 1 | `HealthFactorEngine` | `configureAsset` — set LTV, Liquidation Threshold, Liquidation Bonus |
| 2 | `OracleRouter` | `configureAsset` — register as keeper-fed oracle |
| 3 | `OracleRouter` | `pushPrice` — push initial price on-chain |
| 4 | `LendingPool` | `addReserve` — add asset to the lending pool (deploys LHToken + DebtToken pair) |
| 5 | `IsolatedMarketController` | `configureIsolatedAsset` — mark as isolated and set debt ceiling |
| 6 | `IsolatedMarketController` | `setAllowedBorrowAsset` — permit USDG as the borrowable asset |

#### Form inputs

- Token contract address
- Initial price (USD)
- LTV (%) and Liquidation Threshold (%)
- Liquidation Bonus (%)
- Debt Ceiling (USD — maximum total USDG borrowable against this asset, protocol-wide)

---

## 6. Core Mechanics

### 6.1 Health Factor

The Health Factor (HF) is the single solvency score for your entire position. It governs every borrow, withdrawal, and liquidation decision.

```
HF = Σ( collateral_i × price_i × liquidationThreshold_i )
     ──────────────────────────────────────────────────
                   totalDebt × priceUSDG
```

| HF Value | Meaning | What can happen |
|---|---|---|
| HF > 1.02 | Safe | Borrow and withdraw collateral allowed |
| 1.00 < HF ≤ 1.02 | Buffer zone | No new borrows; existing position intact |
| HF ≤ 1.00 | Liquidatable | Liquidators can repay your debt and seize collateral |
| HF < 0.90 | Deep breach | Full close factor (100%) unlocked for liquidators |

**Important:** Two thresholds matter:
- `ltv` — governs *new borrowing power* (how much you can borrow)
- `liquidationThreshold` — governs *when you get liquidated* (always > LTV, creating a safety buffer)

---

### 6.2 Interest Rate Model

Liquihood uses a **kinked utilization curve** — a standard mechanism that automatically balances supply and demand.

```
U = totalBorrows / (totalSupplied + totalBorrows)

borrowRate(U) = (U / 0.80) × 6.5%                         for U ≤ 80%
              = 6.5% + ((U − 0.80) / 0.20) × 60%           for U > 80%

supplyAPY(U)  = borrowRate(U) × U × 90%   (10% reserve factor retained)
```

#### Rate parameters

| Parameter | Value | Purpose |
|---|---|---|
| Optimal Utilization (U*) | 80% | Kink point — rates gentle below, punitive above |
| Base Rate (R0) | 0% | No rate floor |
| Slope 1 (below kink) | 6.5% | At U=80%: borrow ≈ 6.5%, supply ≈ 4.7% |
| Slope 2 (above kink) | 60% | At U=95%: borrow ≈ 51.5% — self-correcting |
| Reserve Factor | 10% | 10% of all borrow interest → Insurance Fund |

**The kink is a liquidity guarantee.** At extreme utilization, punitive rates force borrowers to repay or new supply to enter — restoring the ability for suppliers to withdraw.

---

### 6.3 Oracle System

All asset prices flow through the **OracleRouter** contract, which validates every price before it is used to move funds.

#### Three oracle source types

| Source | Used for | Update frequency |
|---|---|---|
| **KEEPER** | ETH, WETH, AAPL-T, TSLA-T, HOOD-T | Every 5 minutes — keeper EOA calls `pushPriceBatch()` |
| **FIXED** | USDG | Always $1.00 — no staleness |
| **CHAINLINK** | Reserved for future Chainlink-native feeds on Robinhood Chain | N/A (not yet configured) |

#### Validation pipeline (every price read)

Every time a price is used (borrow, liquidation, HF calculation), it passes through this pipeline:

1. **Staleness check** — `block.timestamp − updatedAt ≤ 300 seconds (5 min)`. Stale prices are rejected, not silently used.
2. **Bounds check** — price must be between `minAnswer` and `maxAnswer`. Prevents circuit-limit failure class.
3. **Deviation circuit-breaker** — if a single update moves price > 10%, the asset market is automatically frozen pending guardian review.
4. **Cross-reference (advisory)** — on-chain DEX TWAP used as a sanity signal only, never as a price source (thin liquidity makes TWAPs manipulable).

**Fail-closed design**: if any check fails, the price is rejected. The protocol prefers refusing an action over using a bad price.

---

### 6.4 Market Hours Policy

Enforced by the **MarketHoursPolicy** contract. Because stock prices only update ~32.5 hours per week while the chain runs 24/7, opening new equity-backed borrows off-hours creates an attack vector: borrow at Friday's close, gap down over the weekend, default on Monday.

#### Rules by market state

| Condition | New equity borrow | Withdraw equity collateral | Liquidations |
|---|---|---|---|
| **Market OPEN** (Mon–Fri, NYSE hours) | ✅ Allowed (HF ≥ 1.02) | ✅ Allowed (HF ≥ 1.02) | ✅ Active |
| **Market CLOSED** (nights / weekends / holidays) | ❌ Blocked — equity contributes **0** to new borrowing power | ✅ Only if post-action HF ≥ 1.30 | ✅ Active at last-close price |

#### How it works

- The keeper EOA calls `openMarket()` at NYSE open — sets an 8-hour TTL.
- The TTL auto-expires, or the keeper calls `closeMarket()` at close.
- Default (uncertain state) = **closed**. Conservative fail-safe.
- Existing positions and repayments are **always** available regardless of market status.

---

### 6.5 Liquidation Engine

#### Parameters

| Parameter | Value |
|---|---|
| Trigger | HF ≤ 1.00 |
| Close factor (normal) | 50% of outstanding debt per call |
| Close factor (deep breach, HF < 0.90) | 100% — full closure |
| Close factor (dust, position < $50) | 100% — economically unprofitable to partially liquidate |
| Bonus to liquidator | 90% of the liquidation bonus |
| Bonus to Insurance Fund | 10% of the liquidation bonus |

#### Liquidation bonus by tier

| Tier | Liquidation Bonus |
|---|---|
| Stablecoin (USDG) | 4% |
| Crypto (ETH, WETH) | 5% |
| Equity — mega-cap (AAPL-T) | 7% |
| Equity — high-volatility (TSLA-T, HOOD-T) | 10% |
| Speculative (Isolated Markets) | 15% |

#### Why the bonus must be sized correctly

A liquidation only occurs if `bonus × seizedValue > gas + DEX slippage + inventory risk`. If the bonus is too small, no one liquidates — the pool accumulates bad debt. Liquihood sizes bonuses against measured real DEX depth on Robinhood Chain.

---

### 6.6 Insurance Fund

The Insurance Fund (`InsuranceFund` contract) is the first-loss buffer, positioned ahead of suppliers in the bad-debt waterfall.

#### How it fills up

| Inflow | Rate |
|---|---|
| Reserve factor on borrow interest | 10% of all interest accrued |
| Liquidation fee share | 10% of every liquidation bonus |

#### Loss waterfall (what happens when bad debt occurs)

```
Bad debt loss
  → Step 1: Insurance Fund absorbs the shortfall
  → Step 2 (if Fund exhausted): socialized within the originating market only
      - Isolated market loss → haircut only that market's lhToken accounting
      - Main Market loss → pro-rata haircut on lhUSDG exchange rate (all suppliers)
  → Step 3: Automatic freeze of the originating market + public post-mortem
```

Isolated market scoping means a memecoin exploit can **never** socialize losses to main market USDG suppliers.

---

### 6.7 Isolated Markets

Assets in the **Speculative** tier (memecoins, high-volatility tokens) are confined to Isolated Markets:

- Each isolated asset has a **hard debt ceiling** — the maximum total USDG that can ever be borrowed against it, protocol-wide.
- Isolated borrowers can **only borrow USDG** — no cross-collateralization with the Main Market.
- Any bad debt from an isolated market is **fully contained** to that market.
- Maximum damage from any single isolated market exploit = the debt ceiling (a known, budgeted number).

**Current status:** IsolatedMarketController is deployed and operational. No Tier 4 assets are listed at launch. New markets can be added via the Create Market page (owner-only).

---

## 7. Risk Parameters

### Full Risk Table

| Asset | Tier | LTV | Liq. Threshold | LTV Buffer | Liq. Bonus | Supply Cap | Borrow Cap |
|---|---|---|---|---|---|---|---|
| USDG | Stablecoin | 86% | 91% | 5pp | 4% | 50,000,000 | 40,000,000 |
| ETH | Crypto | 80% | 85% | 5pp | 5% | 5,000 | 4,000 |
| WETH | Crypto | 75% | 80% | 5pp | 5% | 5,000 | 4,000 |
| AAPL-T | Equity | 60% | 70% | 10pp | 7% | 80,000 | 60,000 |
| TSLA-T | Equity | 38% | 48% | 10pp | 10% | 40,000 | 30,000 |
| HOOD-T | Equity | 42% | 52% | 10pp | 10% | 100,000 | 75,000 |

> **LTV Buffer** = Liquidation Threshold − LTV. This is your safety margin — the price drop your collateral can absorb before becoming liquidatable after you've borrowed at max LTV.

### Why equity LTVs are lower than crypto

Equity LT is derived from:
```
LT_equity = LT_base − gapBuffer − issuerHaircut

gapBuffer    = max(worst 2-yr gap-open, 2 × daily ATR)
issuerHaircut ≥ 5%  (Jersey-entity credit + regulatory overhang)
```

- **Gap risk**: equity markets close at weekends — a stock can open 10-20% lower on Monday vs Friday's close. The LT must absorb the modeled worst gap without requiring the user to have been watching.
- **Issuer risk**: Stock Tokens are debt securities issued by Robinhood Assets (Jersey) Limited — there is inherent issuer credit and regulatory risk not present in crypto.

---

## 8. Transaction Flows

### Supply (Lend USDG or any supported asset)

```
User
 → Approve asset spending to LendingPool
 → Call supply(asset, amount)
 → LendingPool checks supplyCap
 → Pulls asset (measured as balanceAfter − balanceBefore)
 → Accrues interest index
 → Mints lhTokens at current exchange rate → returned to user
```

### Deposit Collateral & Borrow

```
1. depositCollateral(asset, amount)
   → Adapter validates: market Active, supply cap not exceeded, decimals normalized
   → Collateral balance credited on-chain (no receipt token issued for collateral)

2. borrow(USDG, amount)
   → Gate 1: market Active (not Frozen/Paused)
   → Gate 2: borrowCap / debtCeiling not exceeded
   → Gate 3: OracleRouter returns VALID prices for all collateral
   → Gate 4: Market-Hours gate (if equity collateral)
   → Gate 5: post-action HF ≥ 1.02
   → DebtToken minted to borrower; USDG transferred out
```

### Repay

```
repay(asset, amount | max)
 → Burns DebtToken
 → Interest settled first, then principal
 → Always available, even under global pause
```

### Withdraw Collateral

```
withdrawCollateral(asset, amount)
 → Checks post-action HF ≥ 1.02
 → For equity collateral off-hours: requires post-action HF ≥ 1.30
 → Returns asset to wallet
```

### Liquidation

```
Liquidator calls liquidate(user, collateralAsset, repayAmount)
 → Validates: user HF ≤ 1.0; repayAmount ≤ closeFactor × debt
 → Pulls USDG from liquidator
 → Calculates seize = repayValue × (1 + bonus) / collateralPrice
 → 90% of bonus → liquidator; 10% → InsuranceFund
 → Collateral transferred to liquidator
```

---

## 9. Wallet & Network Setup

### Step-by-step setup

**1. Add Robinhood Chain to MetaMask / Rabby**

- Network name: `Robinhood Chain`
- RPC URL: `https://rpc.mainnet.chain.robinhood.com`
- Chain ID: `4663`
- Currency symbol: `ETH`
- Block explorer: `https://explorer.robinhood.com`

**2. Get ETH for gas**

You need a small amount of ETH on Robinhood Chain for gas fees. Bridge ETH from Ethereum mainnet via the official Robinhood Chain bridge.

**3. Get assets**

- **USDG**: Available via Robinhood Wallet and DEXs on Robinhood Chain (Uniswap, zero-fee DEX built by dYdX team).
- **ETH/WETH**: Bridgeable from Ethereum mainnet.
- **AAPL-T / TSLA-T / HOOD-T**: Available via Robinhood's Stock Token product (120+ jurisdictions, excluding the US) and tradeable on DEXs.

**4. Connect wallet in the app**

- Go to https://app.liquihood.xyz
- Click **Connect Wallet**
- Select your wallet and approve connection
- Switch to Robinhood Chain (Chain ID 4663) if prompted

---

## 10. Glossary

| Term | Definition |
|---|---|
| **USDG** | Global Dollar — a fiat-backed stablecoin issued by Paxos, natively available on Robinhood Chain. The sole borrow asset in Liquihood v1. |
| **lhUSDG / lhToken** | Liquihood supply receipt token. Represents your share of the pool. Exchange rate rises over time as interest accrues. Freely transferable ERC-20. |
| **DebtToken** | Non-transferable token tracking your borrow obligation. Balance grows continuously as interest accrues. |
| **Health Factor (HF)** | Ratio of your weighted collateral value to your debt. HF > 1.02 = can act; HF ≤ 1.0 = liquidatable. |
| **LTV (Loan-to-Value)** | Maximum you can borrow relative to your collateral's USD value. |
| **Liquidation Threshold (LT)** | The LTV at which your position becomes liquidatable. Always > LTV — the gap is your safety buffer. |
| **Liquidation Bonus** | Extra collateral seized by the liquidator on top of the repaid debt value. Incentivizes liquidators to keep the pool healthy. |
| **Supply Cap** | Maximum total deposits accepted for a given asset, protocol-wide. |
| **Borrow Cap** | Maximum total borrows allowed for a given asset, protocol-wide. |
| **Utilization** | Fraction of supplied liquidity currently borrowed. Drives the interest rate curve. |
| **Kink** | The utilization point (80%) where the interest rate curve steepens sharply. |
| **Reserve Factor** | 10% of all borrow interest that flows into the Insurance Fund instead of suppliers. |
| **Insurance Fund** | First-loss buffer funded by the reserve factor and liquidation fees. Absorbs bad debt before it touches suppliers. |
| **Isolated Market** | A lending market where a speculative asset can be used as collateral up to a hard debt ceiling, with zero contagion to the main pool. |
| **Debt Ceiling** | The hard cap on total USDG borrowable against a specific isolated asset, protocol-wide. |
| **Keeper** | An off-chain bot (EOA) that pushes live prices to the OracleRouter every 5 minutes and manages NYSE market-session state. |
| **OracleRouter** | On-chain contract that validates and routes all price reads. Always fail-closed — stale or deviated prices are rejected. |
| **MarketHoursPolicy** | On-chain contract that enforces NYSE/Nasdaq session state for equity collateral. New equity-backed borrows are blocked when markets are closed. |
| **Close Factor** | The maximum fraction of a borrower's debt that can be repaid in a single liquidation call. Normally 50%; 100% for deep breaches or dust positions. |
| **Gap Risk** | The risk that an equity's price opens significantly lower (or higher) after a market closure. The primary reason equity LTVs are lower than crypto. |
| **Stock Tokens** | Tokenized representations of US equities issued by Robinhood Assets (Jersey) Limited. Debt securities — not actual shares. Available in 120+ countries (excluding the US). |
| **Pooled Lending** | Architecture where many suppliers' funds are pooled together and lent to many borrowers — as opposed to CDP (collateralized debt position), where the protocol mints its own stablecoin. |

---

*This document is a technical reference for the Liquihood protocol. Nothing here constitutes financial advice. Borrowing against collateral carries liquidation risk. Always understand your Health Factor before opening or modifying a position.*

*Liquihood is an independent protocol built on Robinhood Chain. Not affiliated with or endorsed by Robinhood Markets, Inc.*

---

**Last updated:** July 13, 2026 · **Version:** 2.1
