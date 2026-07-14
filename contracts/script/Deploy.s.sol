// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/InterestRateModel.sol";
import "../src/MarketHoursPolicy.sol";
import "../src/InsuranceFund.sol";
import "../src/OracleRouter.sol";
import "../src/HealthFactorEngine.sol";
import "../src/IsolatedMarketController.sol";
import "../src/LiquidationManager.sol";
import "../src/LendingPool.sol";

/**
 * @title  Deploy
 * @notice Deployment script for the full Liquihood protocol on Robinhood Chain (Chain ID 4663).
 *
 *         Deployment order (dependency graph — each contract only references contracts
 *         that have already been deployed):
 *
 *           1.  InterestRateModel        — no dependencies
 *           2.  MarketHoursPolicy        — no dependencies
 *           3.  InsuranceFund            — no dependencies
 *           4.  OracleRouter             — no dependencies
 *           5.  HealthFactorEngine       — no dependencies
 *           6.  IsolatedMarketController — no dependencies
 *           7.  LiquidationManager       — no dependencies
 *           8.  LendingPool              — requires all of the above
 *           9.  Wire-up calls            — link LendingPool into each module
 *
 *         Run with:
 *           forge script script/Deploy.s.sol:Deploy \
 *             --rpc-url robinhood \
 *             --private-key $DEPLOYER_PRIVATE_KEY \
 *             --broadcast \
 *             -vvvv
 *
 * @author Liquihood Protocol
 */
contract Deploy is Script {
    // ─────────────────────────────────────────────────────────────────────────
    // Rate Model Parameters (kinked curve — matches frontend lib/protocol/index.ts)
    // ─────────────────────────────────────────────────────────────────────────

    uint256 constant RAY               = 1e27;
    uint256 constant OPTIMAL_UTIL      = 80e25;   // 80%  in ray
    uint256 constant BASE_RATE         = 0;        // 0%   base rate
    uint256 constant SLOPE_1           = 65e23;   // 6.5% below kink (ray/year)
    uint256 constant SLOPE_2           = 60e25;   // 60%  above kink (ray/year)
    uint256 constant RESERVE_FACTOR    = 10e25;   // 10%  reserve factor

    // ─────────────────────────────────────────────────────────────────────────
    // Stablecoin fixed price ($1.00 with 8 decimals)
    // ─────────────────────────────────────────────────────────────────────────
    uint256 constant STABLE_PRICE_USD8 = 1e8;

    // ─────────────────────────────────────────────────────────────────────────
    // Oracle Staleness Limits
    // ─────────────────────────────────────────────────────────────────────────
    uint256 constant CHAINLINK_STALENESS = 1 hours;
    uint256 constant KEEPER_STALENESS    = 5 minutes;
    uint256 constant FIXED_STALENESS     = 365 days;

    // ─────────────────────────────────────────────────────────────────────────
    // Risk Parameters (LTV / Liquidation Threshold / Liquidation Bonus)
    // Stablecoins:   LTV 85% / LT 90% / Bonus 5%
    // Crypto:        LTV 75% / LT 82.5% / Bonus 8%
    // Equities:      LTV 70% / LT 80% / Bonus 10%
    // Isolated:      LTV 55% / LT 65% / Bonus 15%
    // ─────────────────────────────────────────────────────────────────────────
    uint256 constant LTV_STABLE    = 85e25;   uint256 constant LT_STABLE    = 90e25;   uint256 constant BONUS_STABLE    = 5e25;
    uint256 constant LTV_CRYPTO    = 75e25;   uint256 constant LT_CRYPTO    = 825e24;  uint256 constant BONUS_CRYPTO    = 8e25;
    uint256 constant LTV_EQUITY    = 70e25;   uint256 constant LT_EQUITY    = 80e25;   uint256 constant BONUS_EQUITY    = 10e25;
    uint256 constant LTV_ISOLATED  = 55e25;   uint256 constant LT_ISOLATED  = 65e25;   uint256 constant BONUS_ISOLATED  = 15e25;

    // ─────────────────────────────────────────────────────────────────────────
    // Isolated debt ceilings (8-decimal USD)
    // ─────────────────────────────────────────────────────────────────────────
    uint256 constant CEILING_DOGE   = 500_000 * 1e8;   // $500,000
    uint256 constant CEILING_MEME1  = 100_000 * 1e8;   // $100,000

    // ─────────────────────────────────────────────────────────────────────────
    // Placeholder asset addresses on Robinhood Chain
    // Replace these with actual deployed token addresses before running.
    // ─────────────────────────────────────────────────────────────────────────

    // Stablecoins
    address constant USDG  = 0x0000000000000000000000000000000000000001;
    address constant USDC  = 0x0000000000000000000000000000000000000002;
    address constant USDT  = 0x0000000000000000000000000000000000000003;
    address constant DAI   = 0x0000000000000000000000000000000000000004;

    // Crypto
    address constant WETH  = 0x0000000000000000000000000000000000000005;
    address constant WBTC  = 0x0000000000000000000000000000000000000006;
    address constant SOL   = 0x0000000000000000000000000000000000000007;
    address constant LINK  = 0x0000000000000000000000000000000000000008;
    address constant AVAX  = 0x0000000000000000000000000000000000000009;
    address constant MATIC = 0x000000000000000000000000000000000000000A;
    address constant DOT   = 0x000000000000000000000000000000000000000b;

    // Tokenized Equities
    address constant AAPL  = 0x000000000000000000000000000000000000000C;
    address constant MSFT  = 0x000000000000000000000000000000000000000d;
    address constant TSLA  = 0x000000000000000000000000000000000000000E;
    address constant NVDA  = 0x000000000000000000000000000000000000000F;
    address constant AMZN  = 0x0000000000000000000000000000000000000010;
    address constant GOOGL = 0x0000000000000000000000000000000000000011;
    address constant META  = 0x0000000000000000000000000000000000000012;
    address constant NFLX  = 0x0000000000000000000000000000000000000013;
    address constant SPY   = 0x0000000000000000000000000000000000000014;
    address constant QQQ   = 0x0000000000000000000000000000000000000015;
    address constant COIN  = 0x0000000000000000000000000000000000000016;

    // Isolated
    address constant DOGE  = 0x0000000000000000000000000000000000000017;
    address constant MEME1 = 0x0000000000000000000000000000000000000018;

    // Chainlink price feeds on Robinhood Chain (replace with actual feed addresses)
    address constant FEED_WETH  = address(0); // placeholder — update before broadcast
    address constant FEED_WBTC  = address(0);
    address constant FEED_SOL   = address(0);
    address constant FEED_LINK  = address(0);
    address constant FEED_AVAX  = address(0);
    address constant FEED_MATIC = address(0);
    address constant FEED_DOT   = address(0);
    address constant FEED_DOGE  = address(0);

    // ─────────────────────────────────────────────────────────────────────────
    // Run
    // ─────────────────────────────────────────────────────────────────────────

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer   = vm.addr(deployerPk);

        console.log("=== Liquihood Protocol Deployment ===");
        console.log("Deployer: %s", deployer);
        console.log("Chain ID: %s", block.chainid);

        vm.startBroadcast(deployerPk);

        // ── 1. InterestRateModel ──────────────────────────────────────────────
        InterestRateModel irm = new InterestRateModel(
            deployer, OPTIMAL_UTIL, BASE_RATE, SLOPE_1, SLOPE_2, RESERVE_FACTOR
        );
        console.log("InterestRateModel:        %s", address(irm));

        // ── 2. MarketHoursPolicy ─────────────────────────────────────────────
        MarketHoursPolicy mhp = new MarketHoursPolicy(deployer, deployer);
        console.log("MarketHoursPolicy:        %s", address(mhp));

        // ── 3. InsuranceFund ─────────────────────────────────────────────────
        InsuranceFund fund = new InsuranceFund(deployer);
        console.log("InsuranceFund:            %s", address(fund));

        // ── 4. OracleRouter ──────────────────────────────────────────────────
        OracleRouter oracle = new OracleRouter(deployer, deployer);
        console.log("OracleRouter:             %s", address(oracle));

        // ── 5. HealthFactorEngine ────────────────────────────────────────────
        HealthFactorEngine hfe = new HealthFactorEngine(deployer);
        console.log("HealthFactorEngine:       %s", address(hfe));

        // ── 6. IsolatedMarketController ──────────────────────────────────────
        IsolatedMarketController imc = new IsolatedMarketController(deployer);
        console.log("IsolatedMarketController: %s", address(imc));

        // ── 7. LiquidationManager ────────────────────────────────────────────
        LiquidationManager lm = new LiquidationManager(deployer);
        console.log("LiquidationManager:       %s", address(lm));

        // ── 8. LendingPool ───────────────────────────────────────────────────
        LendingPool pool = new LendingPool(
            deployer,
            address(oracle),
            address(hfe),
            address(lm),
            address(imc),
            address(mhp),
            address(fund)
        );
        console.log("LendingPool:              %s", address(pool));

        // ── 9. Wire-up: register LendingPool in each module ──────────────────
        fund.setLendingPool(address(pool));
        hfe.setLendingPool(address(pool));
        lm.setLendingPool(address(pool));
        imc.setLendingPool(address(pool));
        console.log("Modules wired to LendingPool.");

        // ── 10. Configure Oracle — Stablecoins (FIXED at $1.00) ──────────────
        oracle.configureAsset(USDG,  OracleRouter.SourceType.FIXED, address(0), STABLE_PRICE_USD8, FIXED_STALENESS);
        oracle.configureAsset(USDC,  OracleRouter.SourceType.FIXED, address(0), STABLE_PRICE_USD8, FIXED_STALENESS);
        oracle.configureAsset(USDT,  OracleRouter.SourceType.FIXED, address(0), STABLE_PRICE_USD8, FIXED_STALENESS);
        oracle.configureAsset(DAI,   OracleRouter.SourceType.FIXED, address(0), STABLE_PRICE_USD8, FIXED_STALENESS);

        // ── 11. Configure Oracle — Crypto (KEEPER; swap to CHAINLINK once feeds live) ──
        oracle.configureAsset(WETH,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(WBTC,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(SOL,   OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(LINK,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(AVAX,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(MATIC, OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(DOT,   OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);

        // ── 12. Configure Oracle — Equities (KEEPER, 30s push during NYSE hours) ──
        oracle.configureAsset(AAPL,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(MSFT,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(TSLA,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(NVDA,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(AMZN,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(GOOGL, OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(META,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(NFLX,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(SPY,   OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(QQQ,   OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(COIN,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);

        // ── 13. Configure Oracle — Isolated (KEEPER) ─────────────────────────
        oracle.configureAsset(DOGE,  OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);
        oracle.configureAsset(MEME1, OracleRouter.SourceType.KEEPER, address(0), 0, KEEPER_STALENESS);

        console.log("Oracle configured for all 22 assets.");

        // ── 14. Configure HealthFactorEngine risk parameters ─────────────────
        // Stablecoins
        hfe.configureAsset(USDG,  LTV_STABLE,   LT_STABLE,   BONUS_STABLE);
        hfe.configureAsset(USDC,  LTV_STABLE,   LT_STABLE,   BONUS_STABLE);
        hfe.configureAsset(USDT,  LTV_STABLE,   LT_STABLE,   BONUS_STABLE);
        hfe.configureAsset(DAI,   LTV_STABLE,   LT_STABLE,   BONUS_STABLE);
        // Crypto
        hfe.configureAsset(WETH,  LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        hfe.configureAsset(WBTC,  LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        hfe.configureAsset(SOL,   LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        hfe.configureAsset(LINK,  LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        hfe.configureAsset(AVAX,  LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        hfe.configureAsset(MATIC, LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        hfe.configureAsset(DOT,   LTV_CRYPTO,   LT_CRYPTO,   BONUS_CRYPTO);
        // Equities
        hfe.configureAsset(AAPL,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(MSFT,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(TSLA,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(NVDA,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(AMZN,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(GOOGL, LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(META,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(NFLX,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(SPY,   LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(QQQ,   LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        hfe.configureAsset(COIN,  LTV_EQUITY,   LT_EQUITY,   BONUS_EQUITY);
        // Isolated
        hfe.configureAsset(DOGE,  LTV_ISOLATED, LT_ISOLATED, BONUS_ISOLATED);
        hfe.configureAsset(MEME1, LTV_ISOLATED, LT_ISOLATED, BONUS_ISOLATED);

        console.log("HealthFactorEngine configured for all 22 assets.");

        // ── 15. Configure IsolatedMarketController ───────────────────────────
        imc.configureIsolatedAsset(DOGE,  CEILING_DOGE);
        imc.configureIsolatedAsset(MEME1, CEILING_MEME1);
        // Isolated assets may only borrow stablecoins.
        imc.setAllowedBorrowAsset(DOGE,  USDG, true);
        imc.setAllowedBorrowAsset(DOGE,  USDC, true);
        imc.setAllowedBorrowAsset(DOGE,  USDT, true);
        imc.setAllowedBorrowAsset(DOGE,  DAI,  true);
        imc.setAllowedBorrowAsset(MEME1, USDG, true);
        imc.setAllowedBorrowAsset(MEME1, USDC, true);
        imc.setAllowedBorrowAsset(MEME1, USDT, true);
        imc.setAllowedBorrowAsset(MEME1, DAI,  true);

        console.log("IsolatedMarketController configured.");

        // ── 16. Add reserves to LendingPool ─────────────────────────────────
        _addReserves(pool, address(irm));

        console.log("All reserves added to LendingPool.");

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("\n=== Deployment Complete ===");
        console.log("InterestRateModel:        %s", address(irm));
        console.log("MarketHoursPolicy:        %s", address(mhp));
        console.log("InsuranceFund:            %s", address(fund));
        console.log("OracleRouter:             %s", address(oracle));
        console.log("HealthFactorEngine:       %s", address(hfe));
        console.log("IsolatedMarketController: %s", address(imc));
        console.log("LiquidationManager:       %s", address(lm));
        console.log("LendingPool:              %s", address(pool));
        console.log("\nNext steps:");
        console.log("1. Replace placeholder asset addresses with real token addresses.");
        console.log("2. Update Chainlink feed addresses and switch KEEPER assets to CHAINLINK.");
        console.log("3. Verify contracts on Blockscout: https://explorer.robinhood.com");
        console.log("4. Update transparency.tsx with deployed contract addresses.");
    }

    function _addReserves(LendingPool pool, address irm) internal {
        // Stablecoins (not equity assets)
        pool.addReserve(USDG,  irm, false, "Liquihood USDG",  "lhUSDG",  "Liquihood Debt USDG",  "dUSDG");
        pool.addReserve(USDC,  irm, false, "Liquihood USDC",  "lhUSDC",  "Liquihood Debt USDC",  "dUSDC");
        pool.addReserve(USDT,  irm, false, "Liquihood USDT",  "lhUSDT",  "Liquihood Debt USDT",  "dUSDT");
        pool.addReserve(DAI,   irm, false, "Liquihood DAI",   "lhDAI",   "Liquihood Debt DAI",   "dDAI");

        // Crypto
        pool.addReserve(WETH,  irm, false, "Liquihood WETH",  "lhWETH",  "Liquihood Debt WETH",  "dWETH");
        pool.addReserve(WBTC,  irm, false, "Liquihood WBTC",  "lhWBTC",  "Liquihood Debt WBTC",  "dWBTC");
        pool.addReserve(SOL,   irm, false, "Liquihood SOL",   "lhSOL",   "Liquihood Debt SOL",   "dSOL");
        pool.addReserve(LINK,  irm, false, "Liquihood LINK",  "lhLINK",  "Liquihood Debt LINK",  "dLINK");
        pool.addReserve(AVAX,  irm, false, "Liquihood AVAX",  "lhAVAX",  "Liquihood Debt AVAX",  "dAVAX");
        pool.addReserve(MATIC, irm, false, "Liquihood MATIC", "lhMATIC", "Liquihood Debt MATIC", "dMATIC");
        pool.addReserve(DOT,   irm, false, "Liquihood DOT",   "lhDOT",   "Liquihood Debt DOT",   "dDOT");

        // Tokenized Equities (isEquity = true → market hours enforced)
        pool.addReserve(AAPL,  irm, true,  "Liquihood AAPL-T",  "lhAAPL",  "Liquihood Debt AAPL-T",  "dAAPL");
        pool.addReserve(MSFT,  irm, true,  "Liquihood MSFT-T",  "lhMSFT",  "Liquihood Debt MSFT-T",  "dMSFT");
        pool.addReserve(TSLA,  irm, true,  "Liquihood TSLA-T",  "lhTSLA",  "Liquihood Debt TSLA-T",  "dTSLA");
        pool.addReserve(NVDA,  irm, true,  "Liquihood NVDA-T",  "lhNVDA",  "Liquihood Debt NVDA-T",  "dNVDA");
        pool.addReserve(AMZN,  irm, true,  "Liquihood AMZN-T",  "lhAMZN",  "Liquihood Debt AMZN-T",  "dAMZN");
        pool.addReserve(GOOGL, irm, true,  "Liquihood GOOGL-T", "lhGOOGL", "Liquihood Debt GOOGL-T", "dGOOGL");
        pool.addReserve(META,  irm, true,  "Liquihood META-T",  "lhMETA",  "Liquihood Debt META-T",  "dMETA");
        pool.addReserve(NFLX,  irm, true,  "Liquihood NFLX-T",  "lhNFLX",  "Liquihood Debt NFLX-T",  "dNFLX");
        pool.addReserve(SPY,   irm, true,  "Liquihood SPY-T",   "lhSPY",   "Liquihood Debt SPY-T",   "dSPY");
        pool.addReserve(QQQ,   irm, true,  "Liquihood QQQ-T",   "lhQQQ",   "Liquihood Debt QQQ-T",   "dQQQ");
        pool.addReserve(COIN,  irm, true,  "Liquihood COIN-T",  "lhCOIN",  "Liquihood Debt COIN-T",  "dCOIN");

        // Isolated (isEquity = false for DOGE; MEME-1 is non-equity)
        pool.addReserve(DOGE,  irm, false, "Liquihood DOGE",  "lhDOGE",  "Liquihood Debt DOGE",  "dDOGE");
        pool.addReserve(MEME1, irm, false, "Liquihood MEME-1", "lhMEME1", "Liquihood Debt MEME-1", "dMEME1");
    }
}
