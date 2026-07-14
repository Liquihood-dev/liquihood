// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  IsolatedMarketController
 * @notice Manages debt ceiling enforcement for isolated-mode collateral assets.
 *
 *         Isolated markets allow higher-risk or lower-liquidity assets to be used as
 *         collateral subject to a hard debt ceiling. When a user supplies an isolated
 *         asset as collateral they may only borrow stablecoins, and the total protocol-
 *         wide debt backed by that isolated asset cannot exceed `debtCeiling[asset]`.
 *
 *         This limits contagion risk from an isolated asset price collapse: the maximum
 *         bad debt that can be created is bounded by the ceiling regardless of how much
 *         of that asset users supply.
 *
 *         Example isolated assets: DOGE, MEME-1.
 *         Standard (cross) assets: WETH, WBTC, AAPL-T, USDC, etc.
 *
 * @author Liquihood Protocol
 */
contract IsolatedMarketController is Ownable {
    /// @notice Whether an asset is in isolated mode.
    mapping(address => bool) public isIsolated;

    /// @notice Maximum USD-equivalent debt allowed per isolated asset (8-decimal USD).
    mapping(address => uint256) public debtCeiling;

    /// @notice Current USD-equivalent debt outstanding per isolated asset (8-decimal USD).
    mapping(address => uint256) public currentDebt;

    /// @notice Allowed borrow assets for isolated collateral (isolated asset → set of allowed borrow assets).
    mapping(address => mapping(address => bool)) public allowedBorrowAsset;

    /// @notice Address of the LendingPool (the only authorised caller for debt tracking updates).
    address public lendingPool;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AssetIsolated(address indexed asset, uint256 debtCeiling);
    event DebtCeilingUpdated(address indexed asset, uint256 newCeiling);
    event IsolatedDebtIncreased(address indexed asset, uint256 amount, uint256 total);
    event IsolatedDebtDecreased(address indexed asset, uint256 amount, uint256 total);
    event LendingPoolUpdated(address indexed previous, address indexed next);
    event AllowedBorrowAssetSet(address indexed isolatedAsset, address indexed borrowAsset, bool allowed);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner  Protocol owner / governance address.
     */
    constructor(address _owner) Ownable(_owner) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Ceiling Enforcement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Check that a new borrow against an isolated collateral does not breach the ceiling.
     * @dev    Reverts if the ceiling would be exceeded. Does NOT update `currentDebt`.
     *         Called by LendingPool before recording a new borrow.
     *
     * @param  _isolatedCollateral  Isolated collateral asset address.
     * @param  _borrowAsset         Asset the user wants to borrow.
     * @param  _newDebtUSD          Additional debt amount in 8-decimal USD.
     */
    function validateBorrow(
        address _isolatedCollateral,
        address _borrowAsset,
        uint256 _newDebtUSD
    ) external view {
        if (!isIsolated[_isolatedCollateral]) return; // not isolated, no restriction
        require(
            allowedBorrowAsset[_isolatedCollateral][_borrowAsset],
            "IMC: borrow asset not allowed in isolated mode"
        );
        require(
            currentDebt[_isolatedCollateral] + _newDebtUSD <= debtCeiling[_isolatedCollateral],
            "IMC: isolated debt ceiling exceeded"
        );
    }

    /**
     * @notice Record a new debt increment for an isolated collateral asset.
     * @dev    Called by LendingPool after a successful isolated borrow.
     * @param  _isolatedCollateral  Isolated collateral asset address.
     * @param  _debtUSD             Additional debt in 8-decimal USD.
     */
    function increaseDebt(address _isolatedCollateral, uint256 _debtUSD) external {
        require(msg.sender == lendingPool, "IMC: only LendingPool");
        require(isIsolated[_isolatedCollateral], "IMC: not isolated");
        currentDebt[_isolatedCollateral] += _debtUSD;
        require(
            currentDebt[_isolatedCollateral] <= debtCeiling[_isolatedCollateral],
            "IMC: ceiling exceeded"
        );
        emit IsolatedDebtIncreased(_isolatedCollateral, _debtUSD, currentDebt[_isolatedCollateral]);
    }

    /**
     * @notice Record a debt repayment against an isolated collateral asset.
     * @dev    Called by LendingPool when isolated borrow is repaid or liquidated.
     * @param  _isolatedCollateral  Isolated collateral asset address.
     * @param  _debtUSD             Repaid debt in 8-decimal USD.
     */
    function decreaseDebt(address _isolatedCollateral, uint256 _debtUSD) external {
        require(msg.sender == lendingPool, "IMC: only LendingPool");
        require(isIsolated[_isolatedCollateral], "IMC: not isolated");
        if (_debtUSD > currentDebt[_isolatedCollateral]) {
            currentDebt[_isolatedCollateral] = 0;
        } else {
            currentDebt[_isolatedCollateral] -= _debtUSD;
        }
        emit IsolatedDebtDecreased(_isolatedCollateral, _debtUSD, currentDebt[_isolatedCollateral]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Configure an asset as isolated with a debt ceiling. Only callable by owner.
     * @param  _asset       Asset address.
     * @param  _ceiling     Maximum debt in 8-decimal USD (e.g. 500_000 * 1e8 = $500,000).
     */
    function configureIsolatedAsset(
        address _asset,
        uint256 _ceiling
    ) external onlyOwner {
        require(_asset != address(0), "IMC: zero address");
        require(_ceiling > 0, "IMC: zero ceiling");
        isIsolated[_asset] = true;
        debtCeiling[_asset] = _ceiling;
        emit AssetIsolated(_asset, _ceiling);
    }

    /**
     * @notice Update the debt ceiling for an existing isolated asset. Only callable by owner.
     */
    function setDebtCeiling(address _asset, uint256 _ceiling) external onlyOwner {
        require(isIsolated[_asset], "IMC: not isolated");
        require(_ceiling >= currentDebt[_asset], "IMC: ceiling below current debt");
        debtCeiling[_asset] = _ceiling;
        emit DebtCeilingUpdated(_asset, _ceiling);
    }

    /**
     * @notice Permit or revoke a borrow asset for use in isolated mode. Only callable by owner.
     * @param  _isolatedAsset  The isolated collateral asset.
     * @param  _borrowAsset    The asset users may borrow against it.
     * @param  _allowed        True to allow, false to revoke.
     */
    function setAllowedBorrowAsset(
        address _isolatedAsset,
        address _borrowAsset,
        bool _allowed
    ) external onlyOwner {
        require(isIsolated[_isolatedAsset], "IMC: not isolated");
        allowedBorrowAsset[_isolatedAsset][_borrowAsset] = _allowed;
        emit AllowedBorrowAssetSet(_isolatedAsset, _borrowAsset, _allowed);
    }

    /**
     * @notice Remove isolated mode from an asset. Only callable by owner.
     * @dev    Only allowed when outstanding debt is zero.
     */
    function removeIsolation(address _asset) external onlyOwner {
        require(currentDebt[_asset] == 0, "IMC: outstanding debt exists");
        isIsolated[_asset] = false;
    }

    /**
     * @notice Register the LendingPool address. Only callable by owner.
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        require(_lendingPool != address(0), "IMC: zero address");
        emit LendingPoolUpdated(lendingPool, _lendingPool);
        lendingPool = _lendingPool;
    }
}
