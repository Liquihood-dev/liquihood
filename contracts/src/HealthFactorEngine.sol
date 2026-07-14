// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  HealthFactorEngine
 * @notice Computes borrower health factors and enforces liquidation thresholds.
 *
 *         Health Factor formula:
 *           HF = Σ(collateralValueUSD × liquidationThreshold) / Σ(debtValueUSD)
 *
 *         Where:
 *           - collateralValueUSD = collateral amount × oracle price
 *           - liquidationThreshold is asset-specific (e.g. 90% stables, 82.5% crypto, 80% equities)
 *           - debtValueUSD       = debt amount × oracle price
 *
 *         HF < 1.0 → position is undercollateralised and eligible for liquidation.
 *         HF = 1.82 (example) → 82% buffer above liquidation threshold.
 *
 *         The maximum close factor per liquidation is 50%: a liquidator may repay at
 *         most 50% of a borrower's debt in a single transaction. This prevents
 *         excessive collateral seizure from a single price move.
 *
 *         All asset risk parameters (LTV, liquidation threshold, liquidation bonus)
 *         are stored here and read by the LendingPool when evaluating borrow
 *         eligibility and executing liquidations.
 *
 * @author Liquihood Protocol
 */
contract HealthFactorEngine is Ownable {
    /// @dev Ray unit: 1e27 = 100%.
    uint256 public constant RAY = 1e27;

    /// @dev Minimum health factor before a position is liquidatable (1.0 in ray).
    uint256 public constant LIQUIDATION_THRESHOLD_HF = RAY;

    /// @dev Maximum fraction of debt that can be repaid in one liquidation (50% in ray).
    uint256 public constant CLOSE_FACTOR = 5e26; // 0.5 × RAY

    struct AssetRiskParams {
        /// @dev Maximum LTV ratio at which a user can borrow (e.g. 0.75e27 = 75%).
        uint256 ltv;
        /// @dev Threshold LTV at which the position becomes liquidatable (e.g. 0.80e27).
        uint256 liquidationThreshold;
        /// @dev Bonus paid to liquidator as a fraction of seized collateral (e.g. 0.08e27 = 8%).
        uint256 liquidationBonus;
        /// @dev Whether this asset is active.
        bool active;
    }

    /// @notice Risk parameters per asset (asset address → params).
    mapping(address => AssetRiskParams) public riskParams;

    /// @notice Address of the authorised LendingPool.
    address public lendingPool;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AssetRiskConfigured(
        address indexed asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    );
    event LendingPoolUpdated(address indexed previous, address indexed next);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner  Protocol owner / governance address.
     */
    constructor(address _owner) Ownable(_owner) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Health Factor Computation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Compute the health factor for a borrower's position.
     *
     * @param  collateralAssets   Array of collateral asset addresses.
     * @param  collateralAmounts  Corresponding collateral amounts in 18-decimal units.
     * @param  collateralPrices   Corresponding USD prices in 8-decimal units.
     * @param  debtAssets         Array of borrowed asset addresses.
     * @param  debtAmounts        Corresponding debt amounts in 18-decimal units.
     * @param  debtPrices         Corresponding USD prices in 8-decimal units.
     *
     * @return hf                 Health factor in ray. Returns type(uint256).max if no debt.
     */
    function computeHealthFactor(
        address[] calldata collateralAssets,
        uint256[] calldata collateralAmounts,
        uint256[] calldata collateralPrices,
        address[] calldata debtAssets,
        uint256[] calldata debtAmounts,
        uint256[] calldata debtPrices
    ) external view returns (uint256 hf) {
        require(
            collateralAssets.length == collateralAmounts.length &&
            collateralAmounts.length == collateralPrices.length,
            "HFE: collateral array mismatch"
        );
        require(
            debtAssets.length == debtAmounts.length &&
            debtAmounts.length == debtPrices.length,
            "HFE: debt array mismatch"
        );

        uint256 totalDebtUSD = _sumDebtUSD(debtAssets, debtAmounts, debtPrices);
        if (totalDebtUSD == 0) return type(uint256).max;

        uint256 weightedCollateralUSD = _sumWeightedCollateralUSD(
            collateralAssets, collateralAmounts, collateralPrices
        );

        return (weightedCollateralUSD * RAY) / totalDebtUSD;
    }

    /**
     * @notice Return true if the position is undercollateralised (HF < 1.0).
     */
    function isLiquidatable(
        address[] calldata collateralAssets,
        uint256[] calldata collateralAmounts,
        uint256[] calldata collateralPrices,
        address[] calldata debtAssets,
        uint256[] calldata debtAmounts,
        uint256[] calldata debtPrices
    ) external view returns (bool) {
        uint256 totalDebtUSD = _sumDebtUSD(debtAssets, debtAmounts, debtPrices);
        if (totalDebtUSD == 0) return false;
        uint256 weightedCollateralUSD = _sumWeightedCollateralUSD(
            collateralAssets, collateralAmounts, collateralPrices
        );
        return (weightedCollateralUSD * RAY) / totalDebtUSD < LIQUIDATION_THRESHOLD_HF;
    }

    /**
     * @notice Compute the maximum borrowable amount of `_debtAsset` given collateral.
     *
     * @param  collateralAssets   Collateral asset addresses.
     * @param  collateralAmounts  Collateral amounts (18-decimal).
     * @param  collateralPrices   Collateral prices (8-decimal USD).
     * @param  existingDebtUSD    Existing debt value in USD (18-decimal precision).
     * @param  debtAssetPrice     Price of the asset to borrow (8-decimal USD).
     *
     * @return maxBorrowAmount    Maximum additional borrowable units (18-decimal).
     */
    function getMaxBorrowAmount(
        address[] calldata collateralAssets,
        uint256[] calldata collateralAmounts,
        uint256[] calldata collateralPrices,
        uint256 existingDebtUSD,
        uint256 debtAssetPrice
    ) external view returns (uint256 maxBorrowAmount) {
        uint256 borrowCapacityUSD = _sumBorrowCapacityUSD(
            collateralAssets, collateralAmounts, collateralPrices
        );
        if (borrowCapacityUSD <= existingDebtUSD) return 0;
        uint256 availableUSD = borrowCapacityUSD - existingDebtUSD;
        // Convert USD (26-decimal intermediate) to 18-decimal token units.
        // availableUSD is in (18 + 8) = 26 decimals; divide by price (8 dec) → 18 dec.
        maxBorrowAmount = availableUSD / debtAssetPrice;
    }

    /**
     * @notice Calculate the maximum debt repayable in a single liquidation (50% close factor).
     * @param  totalDebt  Total outstanding debt in underlying units.
     * @return            Maximum repayable amount.
     */
    function maxLiquidatableDebt(uint256 totalDebt) external pure returns (uint256) {
        return (totalDebt * CLOSE_FACTOR) / RAY;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Risk Parameter Queries
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Return all risk parameters for a given asset.
     */
    function getAssetRiskParams(address _asset)
        external
        view
        returns (uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus)
    {
        AssetRiskParams memory p = riskParams[_asset];
        require(p.active, "HFE: asset not configured");
        return (p.ltv, p.liquidationThreshold, p.liquidationBonus);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Configure risk parameters for an asset. Only callable by owner.
     * @param  _asset                 Asset address.
     * @param  _ltv                   Max LTV in ray (e.g. 0.75e27).
     * @param  _liquidationThreshold  Liquidation threshold in ray (e.g. 0.82e27).
     * @param  _liquidationBonus      Liquidator bonus in ray (e.g. 0.08e27 = 8%).
     */
    function configureAsset(
        address _asset,
        uint256 _ltv,
        uint256 _liquidationThreshold,
        uint256 _liquidationBonus
    ) external onlyOwner {
        require(_asset != address(0), "HFE: zero address");
        require(_ltv < RAY, "HFE: LTV >= 100%");
        require(_liquidationThreshold > _ltv && _liquidationThreshold <= RAY, "HFE: bad threshold");
        require(_liquidationBonus <= 15e25, "HFE: bonus exceeds 15%"); // hard cap 15%
        riskParams[_asset] = AssetRiskParams({
            ltv: _ltv,
            liquidationThreshold: _liquidationThreshold,
            liquidationBonus: _liquidationBonus,
            active: true
        });
        emit AssetRiskConfigured(_asset, _ltv, _liquidationThreshold, _liquidationBonus);
    }

    /**
     * @notice Deactivate an asset's risk configuration. Only callable by owner.
     */
    function deactivateAsset(address _asset) external onlyOwner {
        riskParams[_asset].active = false;
    }

    /**
     * @notice Register the LendingPool address. Only callable by owner.
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        require(_lendingPool != address(0), "HFE: zero address");
        emit LendingPoolUpdated(lendingPool, _lendingPool);
        lendingPool = _lendingPool;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Sum (collateral × price × liquidationThreshold) across all collateral assets.
    ///      Result is in (18 + 8) = 26-decimal USD × ray = 53-decimal space; caller
    ///      divides by debtUSD (26-dec) and RAY to get a dimensionless HF in ray.
    function _sumWeightedCollateralUSD(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata prices
    ) internal view returns (uint256 total) {
        for (uint256 i = 0; i < assets.length; i++) {
            AssetRiskParams memory p = riskParams[assets[i]];
            if (!p.active || amounts[i] == 0) continue;
            // collateralUSD (26-dec) = amount (18) × price (8)
            uint256 collateralUSD = amounts[i] * prices[i];
            // weighted (53-dec) = collateralUSD (26) × liquidationThreshold (27)
            total += (collateralUSD * p.liquidationThreshold) / RAY;
        }
    }

    /// @dev Sum (collateral × price × LTV) — used for borrow capacity.
    function _sumBorrowCapacityUSD(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata prices
    ) internal view returns (uint256 total) {
        for (uint256 i = 0; i < assets.length; i++) {
            AssetRiskParams memory p = riskParams[assets[i]];
            if (!p.active || amounts[i] == 0) continue;
            uint256 collateralUSD = amounts[i] * prices[i];
            total += (collateralUSD * p.ltv) / RAY;
        }
    }

    /// @dev Sum (debt × price) across all debt positions.
    function _sumDebtUSD(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata prices
    ) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < assets.length; i++) {
            if (amounts[i] == 0) continue;
            total += amounts[i] * prices[i];
        }
    }
}
