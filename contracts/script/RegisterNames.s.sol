// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/ProtocolNameRegistry.sol";

/**
 * @title  RegisterNames
 * @notice Deploys ProtocolNameRegistry on Robinhood Chain and registers ENS-compatible
 *         names for all 8 Liquihood core protocol contracts.
 *
 *         Run:
 *           forge script script/RegisterNames.s.sol:RegisterNames \
 *             --rpc-url https://rpc.mainnet.chain.robinhood.com \
 *             --private-key $DEPLOYER_PRIVATE_KEY \
 *             --broadcast \
 *             -vvvv
 *
 * @author Liquihood Protocol
 */
contract RegisterNames is Script {

    // ── Deployed core contract addresses (Robinhood Chain, Chain ID 4663) ────

    address constant LENDING_POOL              = 0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E;
    address constant ORACLE_ROUTER             = 0x9c445077D3826C706A1f39413F2508cc09049827;
    address constant INTEREST_RATE_MODEL       = 0x419D74beFA27CE808C9c863533193847F25EFb6F;
    address constant HEALTH_FACTOR_ENGINE      = 0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA;
    address constant INSURANCE_FUND            = 0xb89Bc97cA63A4Beb1edeD769E13CE1E441Eeb87F;
    address constant LIQUIDATION_MANAGER       = 0x13EC47404D1a54D7Bed50Cda76D41254319de3CE;
    address constant ISOLATED_MARKET_CTRL      = 0x4596073d475F1ebCcdB18f4BDb64463368695B1d;
    address constant MARKET_HOURS_POLICY       = 0xe71dbE28d26208648644d11e6f92D6305c2561Cb;

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        console.log("==============================================");
        console.log("  Liquihood Protocol - Name Registry");
        console.log("==============================================");
        console.log("Deployer:", deployer);

        // ── 1. Deploy registry ────────────────────────────────────────────────
        ProtocolNameRegistry registry = new ProtocolNameRegistry(deployer);
        console.log("");
        console.log("ProtocolNameRegistry deployed:", address(registry));

        // ── 2. Register all 8 core contract names ────────────────────────────
        console.log("");
        console.log("Registering names...");

        registry.register("pool.liquihood",       LENDING_POOL);
        console.log("  pool.liquihood        ->", LENDING_POOL);

        registry.register("oracle.liquihood",     ORACLE_ROUTER);
        console.log("  oracle.liquihood      ->", ORACLE_ROUTER);

        registry.register("rates.liquihood",      INTEREST_RATE_MODEL);
        console.log("  rates.liquihood       ->", INTEREST_RATE_MODEL);

        registry.register("health.liquihood",     HEALTH_FACTOR_ENGINE);
        console.log("  health.liquihood      ->", HEALTH_FACTOR_ENGINE);

        registry.register("insurance.liquihood",  INSURANCE_FUND);
        console.log("  insurance.liquihood   ->", INSURANCE_FUND);

        registry.register("liquidator.liquihood", LIQUIDATION_MANAGER);
        console.log("  liquidator.liquihood  ->", LIQUIDATION_MANAGER);

        registry.register("isolated.liquihood",   ISOLATED_MARKET_CTRL);
        console.log("  isolated.liquihood    ->", ISOLATED_MARKET_CTRL);

        registry.register("hours.liquihood",      MARKET_HOURS_POLICY);
        console.log("  hours.liquihood       ->", MARKET_HOURS_POLICY);

        // ── 3. Verify all entries ─────────────────────────────────────────────
        console.log("");
        console.log("Verifying registrations...");
        (, string[] memory nameList, address[] memory addrs) = registry.getAllEntries();
        for (uint256 i = 0; i < nameList.length; i++) {
            console.log("  [OK]", nameList[i], "->", addrs[i]);
        }

        console.log("");
        console.log("==============================================");
        console.log("  Name Registry ready.");
        console.log("  Total names registered:", registry.totalNames());
        console.log("  Registry address:", address(registry));
        console.log("==============================================");

        vm.stopBroadcast();
    }
}
