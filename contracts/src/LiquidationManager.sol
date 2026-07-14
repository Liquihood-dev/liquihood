// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title  LiquidationManager
 * @notice Executes liquidations of undercollateralised positions.
 *
 *         Liquidation mechanics:
 *           1. Any external address (liquidator) may call `liquidate()` on any
 *              borrower whose health factor has fallen below 1.0.
 *           2. The liquidator repays up to 50% of the borrower's debt (close factor).
 *           3. In exchange the liquidator receives an equivalent value of the
 *              borrower's collateral plus a liquidation bonus (5–15% depending on asset).
 *           4. If the seized collateral does not fully cover the repaid debt (bad debt),
 *              the shortfall is forwarded to the InsuranceFund.
 *           5. The LendingPool settles the accounting; this contract only orchestrates
 *              the logic and emits events for off-chain indexers.
 *
 *         Loss waterfall:
 *           Borrower collateral → InsuranceFund reserves → Supplier haircut (last resort).
 *
 * @author Liquihood Protocol
 */
contract LiquidationManager is Ownable {
    using SafeERC20 for IERC20;

    /// @dev Ray unit.
    uint256 public constant RAY = 1e27;

    /// @notice Maximum debt repayable per liquidation (50% close factor in ray).
    uint256 public constant CLOSE_FACTOR = 5e26;

    /// @notice Address of the LendingPool. Only it may call `executeLiquidation`.
    address public lendingPool;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event LiquidationExecuted(
        address indexed liquidator,
        address indexed borrower,
        address indexed debtAsset,
        address  collateralAsset,
        uint256  debtRepaid,
        uint256  collateralSeized,
        uint256  bonus,
        uint256  badDebt
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
    // Liquidation Calculation (view — called by LendingPool to preview amounts)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Calculate the collateral amount to seize for a given debt repayment.
     *
     * @param  debtAssetPrice         USD price of the debt asset (8-decimal).
     * @param  collateralAssetPrice   USD price of the collateral asset (8-decimal).
     * @param  liquidationBonus       Liquidation bonus in ray (e.g. 0.08e27 = 8%).
     * @param  debtAmountToRepay      Amount of debt asset the liquidator will repay (18-dec).
     *
     * @return collateralToSeize      Amount of collateral to transfer to liquidator (18-dec).
     * @return bonusAmount            USD-equivalent bonus (18-dec collateral units, informational).
     */
    function calculateCollateralToSeize(
        uint256 debtAssetPrice,
        uint256 collateralAssetPrice,
        uint256 liquidationBonus,
        uint256 debtAmountToRepay
    ) external pure returns (uint256 collateralToSeize, uint256 bonusAmount) {
        require(collateralAssetPrice > 0, "LM: zero collateral price");
        require(debtAssetPrice > 0, "LM: zero debt price");

        // debtUSD (26-dec) = debtAmount (18) × debtPrice (8)
        uint256 debtUSD = debtAmountToRepay * debtAssetPrice;

        // Apply bonus without intermediate division (avoids divide-before-multiply
        // precision loss). denominator = collateralAssetPrice × RAY.
        // collateralToSeize (18-dec) = debtUSD × (RAY + bonus) / (collateralPrice × RAY)
        uint256 denom = uint256(collateralAssetPrice) * RAY;
        collateralToSeize = Math.mulDiv(debtUSD, RAY + liquidationBonus, denom);
        bonusAmount       = Math.mulDiv(debtUSD, liquidationBonus,       denom);
    }

    /**
     * @notice Calculate the maximum debt a liquidator may repay (close factor applied).
     * @param  totalDebt  Total outstanding debt of the borrower in underlying units.
     * @return            Maximum repayable amount in underlying units.
     */
    function maxRepayAmount(uint256 totalDebt) external pure returns (uint256) {
        return (totalDebt * CLOSE_FACTOR) / RAY;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Liquidation Execution (called by LendingPool after state updates)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record a completed liquidation. Called by LendingPool after all state
     *         changes (debt burn, collateral seizure) have been applied.
     *
     * @dev    This function emits the canonical LiquidationExecuted event consumed by
     *         off-chain indexers and the Liquihood frontend liquidation history page.
     *         Asset transfers are handled by LendingPool — this contract only logs.
     *
     * @param  _liquidator        Address that performed the liquidation.
     * @param  _borrower          Liquidated borrower address.
     * @param  _debtAsset         Debt asset address.
     * @param  _collateralAsset   Seized collateral asset address.
     * @param  _debtRepaid        Debt amount repaid by liquidator.
     * @param  _collateralSeized  Collateral amount transferred to liquidator.
     * @param  _bonus             Bonus collateral amount (subset of _collateralSeized).
     * @param  _badDebt           Unrecoverable shortfall forwarded to InsuranceFund (0 if none).
     */
    function recordLiquidation(
        address _liquidator,
        address _borrower,
        address _debtAsset,
        address _collateralAsset,
        uint256 _debtRepaid,
        uint256 _collateralSeized,
        uint256 _bonus,
        uint256 _badDebt
    ) external {
        require(msg.sender == lendingPool, "LM: only LendingPool");
        emit LiquidationExecuted(
            _liquidator,
            _borrower,
            _debtAsset,
            _collateralAsset,
            _debtRepaid,
            _collateralSeized,
            _bonus,
            _badDebt
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register the LendingPool address. Only callable by owner.
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        require(_lendingPool != address(0), "LM: zero address");
        emit LendingPoolUpdated(lendingPool, _lendingPool);
        lendingPool = _lendingPool;
    }
}
