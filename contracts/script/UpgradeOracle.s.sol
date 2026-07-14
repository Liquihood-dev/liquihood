// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/OracleRouter.sol";
import "../src/LendingPool.sol";

/**
 * @title  UpgradeOracle
 * @notice Deploys the upgraded multi-keeper OracleRouter and points the
 *         existing LendingPool at it. Re-configures all active asset feeds.
 *
 *         Env vars required:
 *           DEPLOYER_PRIVATE_KEY       - primary keeper / owner
 *           BACKUP_KEEPER_ADDRESS      - optional second keeper address to whitelist
 *           LENDING_POOL_ADDRESS       - existing LendingPool (must have setOracle)
 *
 *         Run:
 *           forge script script/UpgradeOracle.s.sol:UpgradeOracle \
 *             --rpc-url https://rpc.mainnet.chain.robinhood.com \
 *             --private-key $DEPLOYER_PRIVATE_KEY \
 *             --broadcast \
 *             -vvvv
 *
 * @author Liquihood Protocol
 */
contract UpgradeOracle is Script {
    // ── Existing protocol addresses (Robinhood Chain mainnet) ─────────────────
    address constant LENDING_POOL    = 0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E;
    address constant OLD_ORACLE      = 0x9c445077D3826C706A1f39413F2508cc09049827;

    // ── Staleness windows ─────────────────────────────────────────────────────
    uint256 constant STALE_KEEPER    = 5 * 60;   // 5 min (keeper pushes every 4 min)
    uint256 constant STALE_FIXED     = 365 days; // stablecoins never expire

    // ── Token addresses (Robinhood Chain) ─────────────────────────────────────
    // Stablecoins (FIXED @ $1.00)
    address constant USDG   = 0x1FaD69eaf1f4E9d9470787f51D458A93464833F6;
    address constant USDE   = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;

    // Crypto / on-chain (KEEPER)
    address constant ETH    = 0xE75454eF6858D469bf499f456Bc35732FAb629dB;
    address constant WETH   = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant VIRTUAL= 0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31;
    address constant CASHCAT= 0x020bfC650A365f8BB26819deAAbF3E21291018b4;

    // Tokenized equities (KEEPER)
    address constant AAPL   = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant AMZN   = 0x12f190a9F9d7D37a250758b26824B97CE941bF54;
    address constant NVDA   = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant TSLA   = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant MSTR   = 0xec262a75e413fAfD0dF80480274532C79D42da09;

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        console.log("==============================================");
        console.log("  OracleRouter Upgrade - Multi-keeper");
        console.log("==============================================");
        console.log("Deployer  : %s", deployer);
        console.log("Chain ID  : %s", block.chainid);
        console.log("Old oracle: %s", OLD_ORACLE);
        console.log("");

        // ── 1. Deploy new OracleRouter with multi-keeper support ──────────────
        OracleRouter oracle = new OracleRouter(deployer, deployer);
        console.log("New OracleRouter: %s", address(oracle));

        // ── 2. Raise deviation limit to 50% ───────────────────────────────────
        oracle.setMaxDeviation(5000);
        console.log("maxDeviationBps set to 5000 (50%)");

        // ── 3. Add optional backup keeper ─────────────────────────────────────
        address backupKeeper = vm.envOr("BACKUP_KEEPER_ADDRESS", address(0));
        if (backupKeeper != address(0)) {
            oracle.addKeeper(backupKeeper);
            console.log("Backup keeper added: %s", backupKeeper);
        } else {
            console.log("BACKUP_KEEPER_ADDRESS not set - single keeper mode");
        }

        // ── 4. Configure asset feeds ──────────────────────────────────────────
        // Stablecoins - FIXED
        oracle.configureAsset(USDG,    OracleRouter.SourceType.FIXED,  address(0), 1e8, STALE_FIXED);
        oracle.configureAsset(USDE,    OracleRouter.SourceType.FIXED,  address(0), 1e8, STALE_FIXED);
        console.log("Stablecoins configured (FIXED @ $1.00)");

        // Crypto - KEEPER
        oracle.configureAsset(ETH,     OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(WETH,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(VIRTUAL, OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(CASHCAT, OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        console.log("Crypto assets configured (KEEPER)");

        // Tokenized equities - KEEPER (NYSE market hours only)
        oracle.configureAsset(AAPL,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(AMZN,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(NVDA,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(TSLA,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(MSTR,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        console.log("Equity assets configured (KEEPER)");

        // ── 5. Seed prices from old oracle so LendingPool doesn't stale ───────
        // We read old keeper prices and copy them to the new oracle.
        // (Keeper will refresh within 4 min anyway, this is just insurance.)
        console.log("Seeding initial prices from old oracle state...");
        address[] memory keeperAssets = new address[](9);
        keeperAssets[0] = ETH; keeperAssets[1] = WETH; keeperAssets[2] = VIRTUAL;
        keeperAssets[3] = CASHCAT; keeperAssets[4] = AAPL; keeperAssets[5] = AMZN;
        keeperAssets[6] = NVDA;    keeperAssets[7] = TSLA; keeperAssets[8] = MSTR;

        OracleRouter oldOracle = OracleRouter(OLD_ORACLE);
        uint256[] memory seedPrices = new uint256[](9);
        for (uint256 i = 0; i < keeperAssets.length; i++) {
            try oldOracle.getPrice(keeperAssets[i]) returns (uint256 p) {
                seedPrices[i] = p;
            } catch {
                seedPrices[i] = 0;
            }
        }
        // Build compact arrays excluding zeros
        uint256 validCount = 0;
        for (uint256 i = 0; i < seedPrices.length; i++) {
            if (seedPrices[i] > 0) validCount++;
        }
        address[] memory seedAssets  = new address[](validCount);
        uint256[] memory seedVals    = new uint256[](validCount);
        uint256 j = 0;
        for (uint256 i = 0; i < keeperAssets.length; i++) {
            if (seedPrices[i] > 0) {
                seedAssets[j] = keeperAssets[i];
                seedVals[j]   = seedPrices[i];
                j++;
            }
        }
        if (validCount > 0) {
            oracle.pushPriceBatch(seedAssets, seedVals);
            console.log("Seeded %s prices from old oracle", validCount);
        }

        // ── 6. Point LendingPool at new oracle ────────────────────────────────
        LendingPool(LENDING_POOL).setOracle(address(oracle));
        console.log("LendingPool oracle updated -> %s", address(oracle));

        vm.stopBroadcast();

        // ── Summary ───────────────────────────────────────────────────────────
        console.log("");
        console.log("==============================================");
        console.log("  Upgrade Complete");
        console.log("==============================================");
        console.log("New OracleRouter : %s", address(oracle));
        console.log("LendingPool      : %s", LENDING_POOL);
        console.log("Primary keeper   : %s", deployer);
        if (backupKeeper != address(0)) {
            console.log("Backup keeper    : %s", backupKeeper);
        }
        console.log("");
        console.log("IMPORTANT: update ORACLE_ROUTER in keeper.ts to:");
        console.log("  %s", address(oracle));
    }
}
