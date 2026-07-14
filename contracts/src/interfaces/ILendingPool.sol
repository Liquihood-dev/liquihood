// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ILendingPool
 * @notice Minimal interface consumed by FlashLiquidator and any external integrators.
 */
interface ILendingPool {
    function liquidate(
        address _borrower,
        address _debtAsset,
        address _collateralAsset,
        uint256 _debtAmountToRepay
    ) external;
}
