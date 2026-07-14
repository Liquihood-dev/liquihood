// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title  InterestRateModel
 * @notice Implements the two-slope (kinked) interest rate model used by Liquihood.
 *
 *         Borrow APR:
 *           - Utilization U ≤ OPTIMAL_UTILIZATION:
 *               borrowApr = BASE_RATE + (U / OPTIMAL_UTILIZATION) * SLOPE_1
 *           - Utilization U > OPTIMAL_UTILIZATION:
 *               borrowApr = BASE_RATE + SLOPE_1 + ((U - OPTIMAL_UTILIZATION) /
 *                           (1 - OPTIMAL_UTILIZATION)) * SLOPE_2
 *
 *         Supply APY:
 *           supplyApy = borrowApr * U * (1 - RESERVE_FACTOR)
 *
 *         All rates are expressed in ray (1e27 = 100%).
 *         All utilization values are expressed in ray (1e27 = 100%).
 *
 * @author Liquihood Protocol
 */
contract InterestRateModel is Ownable {
    /// @dev Ray unit: 1e27 represents 100%.
    uint256 public constant RAY = 1e27;

    /// @notice Optimal utilization ratio (80% expressed in ray).
    uint256 public optimalUtilization;

    /// @notice Base borrow rate at 0% utilization (ray per second).
    uint256 public baseRate;

    /// @notice Slope below optimal utilization (in ray per second).
    uint256 public slope1;

    /// @notice Steep slope above optimal utilization (in ray per second).
    uint256 public slope2;

    /// @notice Protocol reserve factor (10% = 0.1e27).
    uint256 public reserveFactor;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ParametersUpdated(
        uint256 optimalUtilization,
        uint256 baseRate,
        uint256 slope1,
        uint256 slope2,
        uint256 reserveFactor
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner             Protocol owner / governance address.
     * @param _optimalUtil       Optimal utilization in ray (e.g. 0.8e27 for 80%).
     * @param _baseRate          Base borrow rate in ray/year (e.g. 0 for 0%).
     * @param _slope1            Rate slope below kink in ray/year (e.g. 0.065e27 for 6.5%).
     * @param _slope2            Rate slope above kink in ray/year (e.g. 0.60e27 for 60%).
     * @param _reserveFactor     Reserve factor in ray (e.g. 0.1e27 for 10%).
     */
    constructor(
        address _owner,
        uint256 _optimalUtil,
        uint256 _baseRate,
        uint256 _slope1,
        uint256 _slope2,
        uint256 _reserveFactor
    ) Ownable(_owner) {
        require(_optimalUtil > 0 && _optimalUtil < RAY, "IRM: invalid optimal util");
        require(_reserveFactor < RAY, "IRM: invalid reserve factor");
        optimalUtilization = _optimalUtil;
        baseRate = _baseRate;
        slope1 = _slope1;
        slope2 = _slope2;
        reserveFactor = _reserveFactor;
        emit ParametersUpdated(_optimalUtil, _baseRate, _slope1, _slope2, _reserveFactor);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core Rate Calculation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Compute the current borrow rate per year (in ray) given pool utilization.
     * @param  totalDebt     Total borrowed assets in pool (18-decimal units).
     * @param  totalSupply   Total supplied assets in pool (18-decimal units).
     * @return borrowRate    Annual borrow rate in ray (1e27 = 100%).
     */
    function getBorrowRate(
        uint256 totalDebt,
        uint256 totalSupply
    ) external view returns (uint256 borrowRate) {
        uint256 util = _utilization(totalDebt, totalSupply);
        borrowRate = _borrowRate(util);
    }

    /**
     * @notice Compute the current supply rate per year (in ray) given pool utilization.
     * @param  totalDebt     Total borrowed assets in pool (18-decimal units).
     * @param  totalSupply   Total supplied assets in pool (18-decimal units).
     * @return supplyRate    Annual supply rate in ray (1e27 = 100%).
     */
    function getSupplyRate(
        uint256 totalDebt,
        uint256 totalSupply
    ) external view returns (uint256 supplyRate) {
        uint256 util = _utilization(totalDebt, totalSupply);
        uint256 borrow = _borrowRate(util);
        // supplyRate = borrowRate × utilization × (1 − reserveFactor)
        // Use mulDiv to avoid divide-before-multiply precision loss.
        supplyRate = Math.mulDiv(borrow * util, RAY - reserveFactor, uint256(RAY) * RAY);
    }

    /**
     * @notice Return both borrow and supply rates in a single call.
     */
    function getRates(
        uint256 totalDebt,
        uint256 totalSupply
    ) external view returns (uint256 borrowRate, uint256 supplyRate) {
        uint256 util = _utilization(totalDebt, totalSupply);
        borrowRate = _borrowRate(util);
        supplyRate = Math.mulDiv(borrowRate * util, RAY - reserveFactor, uint256(RAY) * RAY);
    }

    /**
     * @notice Return the current utilization ratio in ray.
     */
    function getUtilization(
        uint256 totalDebt,
        uint256 totalSupply
    ) external pure returns (uint256) {
        return _utilization(totalDebt, totalSupply);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update all rate model parameters. Only callable by owner.
     */
    function setParameters(
        uint256 _optimalUtil,
        uint256 _baseRate,
        uint256 _slope1,
        uint256 _slope2,
        uint256 _reserveFactor
    ) external onlyOwner {
        require(_optimalUtil > 0 && _optimalUtil < RAY, "IRM: invalid optimal util");
        require(_reserveFactor < RAY, "IRM: invalid reserve factor");
        optimalUtilization = _optimalUtil;
        baseRate = _baseRate;
        slope1 = _slope1;
        slope2 = _slope2;
        reserveFactor = _reserveFactor;
        emit ParametersUpdated(_optimalUtil, _baseRate, _slope1, _slope2, _reserveFactor);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _utilization(
        uint256 debt,
        uint256 supply
    ) internal pure returns (uint256) {
        if (supply == 0) return 0;
        if (debt >= supply) return RAY; // 100%
        return (debt * RAY) / supply;
    }

    function _borrowRate(uint256 util) internal view returns (uint256) {
        if (util <= optimalUtilization) {
            return baseRate + (slope1 * util) / optimalUtilization;
        } else {
            uint256 excessUtil = util - optimalUtilization;
            uint256 maxExcess = RAY - optimalUtilization;
            return baseRate + slope1 + (slope2 * excessUtil) / maxExcess;
        }
    }
}
