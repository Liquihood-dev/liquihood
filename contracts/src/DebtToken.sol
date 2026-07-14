// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  DebtToken
 * @notice Non-transferable, non-delegatable debt tracking token for Liquihood.
 *
 *         Every active borrow is represented by a DebtToken balance. The token is
 *         intentionally non-transferable: the borrower who opened the position is
 *         always responsible for repaying it. This eliminates anonymous debt
 *         offloading and simplifies the liquidation engine.
 *
 *         Variable-rate debt is tracked in scaled units (debt / borrow index at
 *         open time). As the borrow index increases the effective debt grows,
 *         reflecting accumulated interest without requiring individual state writes.
 *
 *         Only the LendingPool (owner) may mint and burn.
 *
 * @author Liquihood Protocol
 */
contract DebtToken is Ownable {
    /// @dev Ray unit: 1e27 = 1.0.
    uint256 public constant RAY = 1e27;

    /// @notice Address of the underlying borrowed asset.
    address public immutable underlyingAsset;

    /// @notice Human-readable name and symbol.
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;

    /// @notice Current variable borrow index (accrues over time). Starts at 1e27.
    uint256 public borrowIndex;

    /// @notice Scaled debt balance per user.
    mapping(address => uint256) private _scaledBalances;

    /// @notice Total scaled debt across all borrowers.
    uint256 public totalScaledDebt;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Mint(address indexed borrower, uint256 underlyingAmount, uint256 index);
    event Burn(address indexed borrower, uint256 underlyingAmount, uint256 index);
    event IndexUpdated(uint256 newIndex);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner           LendingPool address.
     * @param _underlyingAsset Borrowed asset ERC-20 address.
     * @param _name            Token name (e.g. "Liquihood Debt USDG").
     * @param _symbol          Token symbol (e.g. "dUSDG").
     */
    constructor(
        address _owner,
        address _underlyingAsset,
        string memory _name,
        string memory _symbol
    ) Ownable(_owner) {
        require(_underlyingAsset != address(0), "DT: zero underlying");
        underlyingAsset = _underlyingAsset;
        name = _name;
        symbol = _symbol;
        borrowIndex = RAY;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mint / Burn (LendingPool only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record new debt for `_borrower`. Called by LendingPool on borrow.
     * @param  _borrower         Borrower address.
     * @param  _underlyingAmount Amount of underlying borrowed.
     */
    function mint(address _borrower, uint256 _underlyingAmount) external onlyOwner {
        require(_underlyingAmount > 0, "DT: zero amount");
        uint256 scaled = (_underlyingAmount * RAY) / borrowIndex;
        _scaledBalances[_borrower] += scaled;
        totalScaledDebt += scaled;
        emit Mint(_borrower, _underlyingAmount, borrowIndex);
    }

    /**
     * @notice Cancel debt for `_borrower`. Called by LendingPool on repay or liquidation.
     * @param  _borrower         Borrower address.
     * @param  _underlyingAmount Amount of underlying being repaid.
     */
    function burn(address _borrower, uint256 _underlyingAmount) external onlyOwner {
        require(_underlyingAmount > 0, "DT: zero amount");
        uint256 scaled = (_underlyingAmount * RAY) / borrowIndex;
        if (scaled > _scaledBalances[_borrower]) scaled = _scaledBalances[_borrower]; // full repay guard
        _scaledBalances[_borrower] -= scaled;
        totalScaledDebt -= scaled;
        emit Burn(_borrower, _underlyingAmount, borrowIndex);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Index Management (LendingPool only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Advance the borrow index to reflect accrued interest.
     * @param  _newIndex  New borrow index in ray. Must be ≥ current index.
     */
    function updateIndex(uint256 _newIndex) external onlyOwner {
        require(_newIndex >= borrowIndex, "DT: index must not decrease");
        borrowIndex = _newIndex;
        emit IndexUpdated(_newIndex);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Balance Queries
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Current debt of `_user` in underlying units (principal + accrued interest).
     */
    function balanceOf(address _user) public view returns (uint256) {
        return (_scaledBalances[_user] * borrowIndex) / RAY;
    }

    /**
     * @notice Raw scaled balance of `_user`.
     */
    function scaledBalanceOf(address _user) external view returns (uint256) {
        return _scaledBalances[_user];
    }

    /**
     * @notice Total outstanding debt across all borrowers in underlying units.
     */
    function totalDebt() external view returns (uint256) {
        return (totalScaledDebt * borrowIndex) / RAY;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Non-Transferable Guards
    // ─────────────────────────────────────────────────────────────────────────

    function transfer(address, uint256) external pure returns (bool) {
        revert("DT: non-transferable");
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("DT: non-transferable");
    }

    function approve(address, uint256) external pure returns (bool) {
        revert("DT: non-transferable");
    }
}
