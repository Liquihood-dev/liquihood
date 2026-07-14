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
 * @title  DeployCore
 * @notice Deploys and wires up the 8 core Liquihood protocol contracts.
 *
 *         This script is asset-address-independent: it does not configure
 *         individual token reserves or oracle feeds. Those are handled by
 *         ConfigureAssets.s.sol once real token addresses on Robinhood Chain
 *         are confirmed.
 *
 *         Deployment order:
 *           1. InterestRateModel
 *           2. MarketHoursPolicy
 *           3. InsuranceFund
 *           4. OracleRouter
 *           5. HealthFactorEngine
 *           6. IsolatedMarketController
 *           7. LiquidationManager
 *           8. LendingPool
 *           9. Wire-up (register LendingPool in each module)
 *
 *         Run:
 *           forge script script/DeployCore.s.sol:DeployCore \
 *             --rpc-url https://rpc.mainnet.chain.robinhood.com \
 *             --private-key $DEPLOYER_PRIVATE_KEY \
 *             --broadcast \
 *             -vvvv
 *
 * @author Liquihood Protocol
 */
contract DeployCore is Script {
    // ── Kinked Rate Model Parameters (matches frontend lib/protocol/index.ts) ──
    uint256 constant RAY            = 1e27;
    uint256 constant OPTIMAL_UTIL   = 80e25;   // 80%
    uint256 constant BASE_RATE      = 0;        // 0%
    uint256 constant SLOPE_1        = 65e23;   // 6.5% below kink (annual ray)
    uint256 constant SLOPE_2        = 60e25;   // 60%  above kink (annual ray)
    uint256 constant RESERVE_FACTOR = 10e25;   // 10%

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        console.log("==============================================");
        console.log("  Liquihood Protocol - Core Deployment");
        console.log("==============================================");
        console.log("Deployer : %s", deployer);
        console.log("Chain ID : %s", block.chainid);
        console.log("Block    : %s", block.number);
        console.log("");

        // 1. InterestRateModel — kinked two-slope curve
        InterestRateModel irm = new InterestRateModel(
            deployer,
            OPTIMAL_UTIL,
            BASE_RATE,
            SLOPE_1,
            SLOPE_2,
            RESERVE_FACTOR
        );

        // 2. MarketHoursPolicy — keeper = deployer (update to dedicated keeper later)
        MarketHoursPolicy mhp = new MarketHoursPolicy(deployer, deployer);

        // 3. InsuranceFund — loss absorber, first in waterfall
        InsuranceFund fund = new InsuranceFund(deployer);

        // 4. OracleRouter — keeper = deployer (update to keeper network later)
        OracleRouter oracle = new OracleRouter(deployer, deployer);

        // 5. HealthFactorEngine — risk parameters (LTV / liquidation thresholds / bonuses)
        HealthFactorEngine hfe = new HealthFactorEngine(deployer);

        // 6. IsolatedMarketController — isolated market debt ceilings
        IsolatedMarketController imc = new IsolatedMarketController(deployer);

        // 7. LiquidationManager — liquidation logic and event emission
        LiquidationManager lm = new LiquidationManager(deployer);

        // 8. LendingPool — main user-facing entry point
        LendingPool pool = new LendingPool(
            deployer,
            address(oracle),
            address(hfe),
            address(lm),
            address(imc),
            address(mhp),
            address(fund)
        );

        // 9. Wire-up: register LendingPool in each module that needs it
        fund.setLendingPool(address(pool));
        hfe.setLendingPool(address(pool));
        lm.setLendingPool(address(pool));
        imc.setLendingPool(address(pool));

        vm.stopBroadcast();

        // ── Deployment Summary ──────────────────────────────────────────────
        console.log("==============================================");
        console.log("  Deployment Complete");
        console.log("==============================================");
        console.log("InterestRateModel        : %s", address(irm));
        console.log("MarketHoursPolicy        : %s", address(mhp));
        console.log("InsuranceFund            : %s", address(fund));
        console.log("OracleRouter             : %s", address(oracle));
        console.log("HealthFactorEngine       : %s", address(hfe));
        console.log("IsolatedMarketController : %s", address(imc));
        console.log("LiquidationManager       : %s", address(lm));
        console.log("LendingPool              : %s", address(pool));
        console.log("");
        console.log("Next: run ConfigureAssets.s.sol with real token addresses to register reserves.");
    }
}
