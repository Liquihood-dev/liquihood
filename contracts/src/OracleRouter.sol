// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal Chainlink aggregator interface.
interface IChainlinkAggregator {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

/**
 * @title  OracleRouter
 * @notice Central price oracle used by the Liquihood LendingPool.
 *
 *         Three price source types are supported:
 *           - CHAINLINK  : live on-chain Chainlink aggregator feed (crypto assets).
 *           - KEEPER     : off-chain keeper-pushed prices (tokenized equities, pushed
 *                          every ~4 min via a trusted multi-keeper network).
 *           - FIXED      : hardcoded $1.00 (stablecoins: USDG, USDC, USDT, DAI).
 *
 *         Prices are expressed in USD with 8 decimal places (Chainlink convention).
 *
 *         Safety mechanisms:
 *           - Multi-keeper whitelist: any authorised keeper can push prices
 *             independently, eliminating single-keeper SPOF.
 *           - Staleness guard: prices older than `maxStaleness` seconds revert.
 *           - Deviation circuit breaker: a new keeper price that deviates more than
 *             `maxDeviationBps` (50% default) from the previous price is rejected.
 *           - Minimum Chainlink answer check: negative or zero prices revert.
 *
 * @author Liquihood Protocol
 */
contract OracleRouter is Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum SourceType { CHAINLINK, KEEPER, FIXED }

    struct AssetConfig {
        SourceType source;
        /// @dev Chainlink aggregator address (only for CHAINLINK source).
        address feed;
        /// @dev Fixed price in 8-decimal USD (only for FIXED source).
        uint256 fixedPrice;
        /// @dev Maximum age of a price in seconds before it is considered stale.
        uint256 maxStaleness;
    }

    struct KeeperPrice {
        uint256 price;       // 8-decimal USD
        uint256 updatedAt;   // block.timestamp of the last push
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Maximum price deviation allowed per keeper update (basis points).
    uint256 public maxDeviationBps = 5000; // 50% — generous for volatile assets

    /// @notice Whitelist of authorised keeper addresses.
    mapping(address => bool) public authorizedKeepers;

    /// @notice Configuration per asset (asset address → config).
    mapping(address => AssetConfig) public assetConfigs;

    /// @notice Latest keeper-pushed prices (asset address → KeeperPrice).
    mapping(address => KeeperPrice) public keeperPrices;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AssetConfigured(address indexed asset, SourceType source, address feed, uint256 fixedPrice);
    event KeeperPriceUpdated(address indexed asset, uint256 price, uint256 timestamp);
    event KeeperAdded(address indexed keeper);
    event KeeperRemoved(address indexed keeper);
    event MaxDeviationUpdated(uint256 bps);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner          Protocol owner / governance address.
     * @param _primaryKeeper  Initial keeper address for price pushes.
     */
    constructor(address _owner, address _primaryKeeper) Ownable(_owner) {
        require(_primaryKeeper != address(0), "OR: zero keeper");
        authorizedKeepers[_primaryKeeper] = true;
        emit KeeperAdded(_primaryKeeper);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Price Queries
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Return the current USD price of `_asset` with 8 decimal precision.
     * @dev    Reverts if the price is stale, invalid, or the asset is not configured.
     * @param  _asset  ERC-20 token address.
     * @return price   USD price with 8 decimals (e.g. 15000_00000000 = $15,000.00).
     */
    function getPrice(address _asset) external view returns (uint256 price) {
        AssetConfig memory cfg = assetConfigs[_asset];
        require(cfg.maxStaleness > 0, "OR: asset not configured");

        if (cfg.source == SourceType.FIXED) {
            return cfg.fixedPrice;
        }

        if (cfg.source == SourceType.CHAINLINK) {
            return _getChainlinkPrice(cfg.feed, cfg.maxStaleness);
        }

        // KEEPER
        KeeperPrice memory kp = keeperPrices[_asset];
        require(kp.updatedAt > 0, "OR: no keeper price set");
        require(
            block.timestamp - kp.updatedAt <= cfg.maxStaleness,
            "OR: keeper price stale"
        );
        return kp.price;
    }

    /**
     * @notice Batch-fetch prices for multiple assets. Reverts on any stale/unconfigured entry.
     * @param  _assets  Array of asset addresses.
     * @return prices   Corresponding prices in 8-decimal USD.
     */
    function getPrices(address[] calldata _assets)
        external
        view
        returns (uint256[] memory prices)
    {
        prices = new uint256[](_assets.length);
        for (uint256 i = 0; i < _assets.length; i++) {
            AssetConfig memory cfg = assetConfigs[_assets[i]];
            require(cfg.maxStaleness > 0, "OR: asset not configured");

            if (cfg.source == SourceType.FIXED) {
                prices[i] = cfg.fixedPrice;
            } else if (cfg.source == SourceType.CHAINLINK) {
                prices[i] = _getChainlinkPrice(cfg.feed, cfg.maxStaleness);
            } else {
                KeeperPrice memory kp = keeperPrices[_assets[i]];
                require(kp.updatedAt > 0, "OR: no keeper price");
                require(
                    block.timestamp - kp.updatedAt <= cfg.maxStaleness,
                    "OR: keeper price stale"
                );
                prices[i] = kp.price;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Keeper Interface
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Push a new price for a KEEPER-type asset.
     * @dev    Callable by any authorised keeper.
     * @param  _asset  Asset address.
     * @param  _price  New price in 8-decimal USD.
     */
    function pushPrice(address _asset, uint256 _price) external {
        require(authorizedKeepers[msg.sender], "OR: not authorized keeper");
        require(_price > 0, "OR: zero price");
        AssetConfig memory cfg = assetConfigs[_asset];
        require(cfg.source == SourceType.KEEPER, "OR: not a keeper asset");

        uint256 prev = keeperPrices[_asset].price;
        if (prev > 0) {
            uint256 diff = _price > prev ? _price - prev : prev - _price;
            uint256 deviationBps = (diff * 10000) / prev;
            require(deviationBps <= maxDeviationBps, "OR: deviation too large");
        }

        keeperPrices[_asset] = KeeperPrice({ price: _price, updatedAt: block.timestamp });
        emit KeeperPriceUpdated(_asset, _price, block.timestamp);
    }

    /**
     * @notice Batch push prices. Saves gas on multi-asset equity updates.
     * @dev    Callable by any authorised keeper.
     */
    function pushPriceBatch(
        address[] calldata _assets,
        uint256[] calldata _prices
    ) external {
        require(authorizedKeepers[msg.sender], "OR: not authorized keeper");
        require(_assets.length == _prices.length, "OR: length mismatch");
        for (uint256 i = 0; i < _assets.length; i++) {
            require(_prices[i] > 0, "OR: zero price");
            AssetConfig memory cfg = assetConfigs[_assets[i]];
            require(cfg.source == SourceType.KEEPER, "OR: not a keeper asset");
            uint256 prev = keeperPrices[_assets[i]].price;
            if (prev > 0) {
                uint256 diff = _prices[i] > prev ? _prices[i] - prev : prev - _prices[i];
                uint256 deviationBps = (diff * 10000) / prev;
                require(deviationBps <= maxDeviationBps, "OR: deviation too large");
            }
            keeperPrices[_assets[i]] = KeeperPrice({ price: _prices[i], updatedAt: block.timestamp });
            emit KeeperPriceUpdated(_assets[i], _prices[i], block.timestamp);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Add a keeper to the authorised whitelist. Only callable by owner.
     * @param  _keeper  Address to authorise.
     */
    function addKeeper(address _keeper) external onlyOwner {
        require(_keeper != address(0), "OR: zero keeper");
        require(!authorizedKeepers[_keeper], "OR: already a keeper");
        authorizedKeepers[_keeper] = true;
        emit KeeperAdded(_keeper);
    }

    /**
     * @notice Remove a keeper from the authorised whitelist. Only callable by owner.
     * @param  _keeper  Address to de-authorise.
     */
    function removeKeeper(address _keeper) external onlyOwner {
        require(authorizedKeepers[_keeper], "OR: not a keeper");
        authorizedKeepers[_keeper] = false;
        emit KeeperRemoved(_keeper);
    }

    /**
     * @notice Configure or update an asset's oracle source. Only callable by owner.
     */
    function configureAsset(
        address _asset,
        SourceType _source,
        address _feed,
        uint256 _fixedPrice,
        uint256 _maxStaleness
    ) external onlyOwner {
        require(_asset != address(0), "OR: zero asset");
        require(_maxStaleness > 0, "OR: zero staleness");
        if (_source == SourceType.CHAINLINK) require(_feed != address(0), "OR: zero feed");
        if (_source == SourceType.FIXED) require(_fixedPrice > 0, "OR: zero fixed price");
        assetConfigs[_asset] = AssetConfig({
            source: _source,
            feed: _feed,
            fixedPrice: _fixedPrice,
            maxStaleness: _maxStaleness
        });
        emit AssetConfigured(_asset, _source, _feed, _fixedPrice);
    }

    /**
     * @notice Update the maximum price deviation threshold. Only callable by owner.
     * @param  _bps  Basis points (e.g. 1000 = 10%).
     */
    function setMaxDeviation(uint256 _bps) external onlyOwner {
        require(_bps <= 10000, "OR: deviation too high"); // hard cap 100%
        maxDeviationBps = _bps;
        emit MaxDeviationUpdated(_bps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _getChainlinkPrice(
        address _feed,
        uint256 _maxStaleness
    ) internal view returns (uint256) {
        // slither-disable-next-line unused-return
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,

        ) = IChainlinkAggregator(_feed).latestRoundData();
        require(answer > 0, "OR: Chainlink non-positive price");
        require(block.timestamp - updatedAt <= _maxStaleness, "OR: Chainlink price stale");
        // Normalise to 8 decimals.
        uint8 dec = IChainlinkAggregator(_feed).decimals();
        if (dec == 8) return uint256(answer);
        if (dec < 8) return uint256(answer) * 10 ** (8 - dec);
        return uint256(answer) / 10 ** (dec - 8);
    }
}
