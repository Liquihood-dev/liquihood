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
 * @title  RedeployAll
 * @notice Full protocol redeploy: upgraded OracleRouter (multi-keeper) +
 *         LendingPool with setOracle. Configures all 10 reserves.
 *
 *         forge script script/RedeployAll.s.sol:RedeployAll \
 *           --rpc-url https://rpc.mainnet.chain.robinhood.com \
 *           --private-key $DEPLOYER_PRIVATE_KEY \
 *           --broadcast -vvvv
 */
contract RedeployAll is Script {

    uint256 constant RAY            = 1e27;
    uint256 constant OPTIMAL_UTIL   = 80e25;
    uint256 constant BASE_RATE      = 0;
    uint256 constant SLOPE_1        = 65e23;
    uint256 constant SLOPE_2        = 60e25;
    uint256 constant RESERVE_FACTOR = 10e25;
    uint256 constant STALE_KEEPER   = 5 * 60;
    uint256 constant STALE_FIXED    = 365 days;

    address constant USDG    = 0x1FaD69eaf1f4E9d9470787f51D458A93464833F6;
    address constant USDE    = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;
    address constant ETH_TOK = 0xE75454eF6858D469bf499f456Bc35732FAb629dB;
    address constant WETH    = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant VIRTUAL = 0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31;
    address constant CASHCAT = 0x020bfC650A365f8BB26819deAAbF3E21291018b4;
    address constant AAPL    = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant AMZN    = 0x12f190a9F9d7D37a250758b26824B97CE941bF54;
    address constant NVDA    = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant TSLA    = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant MSTR    = 0xec262a75e413fAfD0dF80480274532C79D42da09;
    address constant OLD_ORACLE = 0x9c445077D3826C706A1f39413F2508cc09049827;

    // ── helpers to avoid stack-too-deep ──────────────────────────────────────

    function _configOracle(OracleRouter oracle) internal {
        oracle.configureAsset(USDG,    OracleRouter.SourceType.FIXED,  address(0), 1e8, STALE_FIXED);
        oracle.configureAsset(USDE,    OracleRouter.SourceType.FIXED,  address(0), 1e8, STALE_FIXED);
        oracle.configureAsset(ETH_TOK, OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(WETH,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(VIRTUAL, OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(CASHCAT, OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(AAPL,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(AMZN,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(NVDA,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(TSLA,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
        oracle.configureAsset(MSTR,    OracleRouter.SourceType.KEEPER, address(0), 0, STALE_KEEPER);
    }

    function _seedPrices(OracleRouter oracle) internal {
        address[] memory assets = new address[](9);
        assets[0] = ETH_TOK; assets[1] = WETH;    assets[2] = VIRTUAL;
        assets[3] = CASHCAT; assets[4] = AAPL;    assets[5] = AMZN;
        assets[6] = NVDA;    assets[7] = TSLA;    assets[8] = MSTR;

        uint256[] memory prices = new uint256[](9);
        uint256 valid = 0;
        OracleRouter old = OracleRouter(OLD_ORACLE);
        for (uint256 i = 0; i < assets.length; i++) {
            try old.getPrice(assets[i]) returns (uint256 p) {
                if (p > 0) { prices[i] = p; valid++; }
            } catch {}
        }
        if (valid == 0) return;
        address[] memory sA = new address[](valid);
        uint256[] memory sP = new uint256[](valid);
        uint256 j = 0;
        for (uint256 i = 0; i < assets.length; i++) {
            if (prices[i] > 0) { sA[j] = assets[i]; sP[j] = prices[i]; j++; }
        }
        oracle.pushPriceBatch(sA, sP);
        console.log("Seeded %s prices from old oracle", valid);
    }

    function _configHFE(HealthFactorEngine hfe) internal {
        hfe.configureAsset(USDG,    86e25, 91e25, 4e25);
        hfe.configureAsset(WETH,    80e25, 85e25, 5e25);
        hfe.configureAsset(USDE,    85e25, 90e25, 4e25);
        hfe.configureAsset(CASHCAT, 35e25, 45e25, 12e25);
        hfe.configureAsset(VIRTUAL, 45e25, 55e25, 10e25);
        hfe.configureAsset(AAPL,    65e25, 75e25, 7e25);
        hfe.configureAsset(AMZN,    55e25, 67e25, 8e25);
        hfe.configureAsset(NVDA,    50e25, 62e25, 9e25);
        hfe.configureAsset(TSLA,    40e25, 52e25, 10e25);
        hfe.configureAsset(MSTR,    35e25, 47e25, 12e25);
    }

    function _addReserves(LendingPool pool, address irm) internal {
        pool.addReserve(USDG,    irm, false, "Liquihood USD Global",       "lhUSDG",    "Liquihood Debt USD Global",       "dUSDG");
        pool.addReserve(WETH,    irm, false, "Liquihood Wrapped Ether",     "lhWETH",    "Liquihood Debt Wrapped Ether",    "dWETH");
        pool.addReserve(USDE,    irm, false, "Liquihood Ethena USDe",       "lhUSDe",    "Liquihood Debt Ethena USDe",      "dUSDe");
        pool.addReserve(CASHCAT, irm, false, "Liquihood Cash Cat",          "lhCASHCAT", "Liquihood Debt Cash Cat",         "dCASHCAT");
        pool.addReserve(VIRTUAL, irm, false, "Liquihood Virtuals Protocol", "lhVIRTUAL", "Liquihood Debt Virtuals Protocol","dVIRTUAL");
        pool.addReserve(AAPL,    irm, true,  "Liquihood Apple",             "lhAAPL",    "Liquihood Debt Apple",            "dAAPL");
        pool.addReserve(AMZN,    irm, true,  "Liquihood Amazon",            "lhAMZN",    "Liquihood Debt Amazon",           "dAMZN");
        pool.addReserve(NVDA,    irm, true,  "Liquihood NVIDIA",            "lhNVDA",    "Liquihood Debt NVIDIA",           "dNVDA");
        pool.addReserve(TSLA,    irm, true,  "Liquihood Tesla",             "lhTSLA",    "Liquihood Debt Tesla",            "dTSLA");
        pool.addReserve(MSTR,    irm, true,  "Liquihood Strategy Inc",      "lhMSTR",    "Liquihood Debt Strategy Inc",     "dMSTR");
    }

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;
        console.log("Deployer:", deployer);
        console.log("ChainID: %s", block.chainid);

        InterestRateModel irm  = new InterestRateModel(deployer, OPTIMAL_UTIL, BASE_RATE, SLOPE_1, SLOPE_2, RESERVE_FACTOR);
        MarketHoursPolicy mhp  = new MarketHoursPolicy(deployer, deployer);
        InsuranceFund     fund = new InsuranceFund(deployer);
        OracleRouter    oracle = new OracleRouter(deployer, deployer);
        HealthFactorEngine hfe = new HealthFactorEngine(deployer);
        IsolatedMarketController imc = new IsolatedMarketController(deployer);
        LiquidationManager lm  = new LiquidationManager(deployer);

        LendingPool pool = new LendingPool(
            deployer, address(oracle), address(hfe),
            address(lm), address(imc), address(mhp), address(fund)
        );

        fund.setLendingPool(address(pool));
        hfe.setLendingPool(address(pool));
        lm.setLendingPool(address(pool));
        imc.setLendingPool(address(pool));

        oracle.setMaxDeviation(5000);

        address backup = vm.envOr("BACKUP_KEEPER_ADDRESS", address(0));
        if (backup != address(0)) oracle.addKeeper(backup);

        _configOracle(oracle);
        _seedPrices(oracle);
        _configHFE(hfe);

        imc.configureIsolatedAsset(CASHCAT, 100_000 * 1e18);
        imc.setAllowedBorrowAsset(CASHCAT, USDG, true);

        _addReserves(pool, address(irm));

        vm.stopBroadcast();

        console.log("=== NEW ADDRESSES ===");
        console.log("InterestRateModel        :", address(irm));
        console.log("MarketHoursPolicy        :", address(mhp));
        console.log("InsuranceFund            :", address(fund));
        console.log("OracleRouter             :", address(oracle));
        console.log("HealthFactorEngine       :", address(hfe));
        console.log("IsolatedMarketController :", address(imc));
        console.log("LiquidationManager       :", address(lm));
        console.log("LendingPool              :", address(pool));
    }
}
