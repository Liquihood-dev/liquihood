// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  LHToken
 * @notice Interest-bearing ERC-20 supply receipt for Liquihood.
 *
 *         When a user supplies asset X to the LendingPool they receive lhX tokens
 *         (e.g. lhUSDG, lhETH) at a 1:1 ratio relative to the pool's current
 *         liquidity index. As interest accrues the index grows, so the same number
 *         of lhTokens is redeemable for an increasing amount of the underlying.
 *
 *         Accounting model (scaled balances):
 *           scaledBalance[user]   = underlying deposited / liquidityIndex at deposit time
 *           underlying balance   = scaledBalance[user] * currentLiquidityIndex
 *
 *         lhTokens are freely transferable (composable with other DeFi). The recipient
 *         inherits the accrued interest from the moment of transfer.
 *
 *         Only the LendingPool (the owner of this contract) may mint and burn.
 *
 * @author Liquihood Protocol
 */
contract LHToken is ERC20, Ownable {
    /// @dev Ray unit: 1e27 = 1.0 index value.
    uint256 public constant RAY = 1e27;

    /// @notice Address of the underlying ERC-20 asset.
    address public immutable underlyingAsset;

    /// @notice Current liquidity index (accrues per-second as interest is collected).
    ///         Stored in ray. Starts at 1e27 (1.0).
    uint256 public liquidityIndex;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Mint(address indexed to, uint256 amount, uint256 index);
    event Burn(address indexed from, uint256 amount, uint256 index);
    event IndexUpdated(uint256 newIndex);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner           LendingPool address (only minter/burner).
     * @param _underlyingAsset Address of the underlying ERC-20.
     * @param _name            Token name (e.g. "Liquihood USDG").
     * @param _symbol          Token symbol (e.g. "lhUSDG").
     */
    constructor(
        address _owner,
        address _underlyingAsset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(_owner) {
        require(_underlyingAsset != address(0), "LHT: zero underlying");
        underlyingAsset = _underlyingAsset;
        liquidityIndex = RAY; // starts at 1.0
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mint / Burn (LendingPool only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint lhTokens to `_to` representing `_underlyingAmount` of the underlying.
     * @dev    Minted amount is the scaled amount: underlying / currentIndex.
     *         Called by LendingPool on supply.
     * @param  _to               Recipient address.
     * @param  _underlyingAmount Amount of underlying being supplied.
     */
    function mint(address _to, uint256 _underlyingAmount) external onlyOwner {
        require(_underlyingAmount > 0, "LHT: zero amount");
        uint256 scaledAmount = (_underlyingAmount * RAY) / liquidityIndex;
        _mint(_to, scaledAmount);
        emit Mint(_to, scaledAmount, liquidityIndex);
    }

    /**
     * @notice Burn lhTokens from `_from` representing `_underlyingAmount` of the underlying.
     * @dev    Burned amount is the scaled amount: underlying / currentIndex.
     *         Called by LendingPool on withdraw.
     * @param  _from             Token holder address.
     * @param  _underlyingAmount Amount of underlying being withdrawn.
     */
    function burn(address _from, uint256 _underlyingAmount) external onlyOwner {
        require(_underlyingAmount > 0, "LHT: zero amount");
        uint256 scaledAmount = (_underlyingAmount * RAY) / liquidityIndex;
        _burn(_from, scaledAmount);
        emit Burn(_from, scaledAmount, liquidityIndex);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Index Management (LendingPool only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the liquidity index. Called by LendingPool when interest accrues.
     * @param  _newIndex  New index value in ray. Must be ≥ current index.
     */
    function updateIndex(uint256 _newIndex) external onlyOwner {
        require(_newIndex >= liquidityIndex, "LHT: index must not decrease");
        liquidityIndex = _newIndex;
        emit IndexUpdated(_newIndex);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Balance Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Return the current underlying balance of `_user` (principal + accrued interest).
     */
    function balanceOfUnderlying(address _user) external view returns (uint256) {
        return (balanceOf(_user) * liquidityIndex) / RAY;
    }

    /**
     * @notice Return the current total underlying value represented by all lhTokens.
     */
    function totalUnderlying() external view returns (uint256) {
        return (totalSupply() * liquidityIndex) / RAY;
    }

    /**
     * @notice Convert a raw scaled balance to underlying value at the current index.
     */
    function scaledToUnderlying(uint256 _scaledAmount) external view returns (uint256) {
        return (_scaledAmount * liquidityIndex) / RAY;
    }

    /**
     * @notice Convert an underlying amount to scaled balance at the current index.
     */
    function underlyingToScaled(uint256 _underlyingAmount) external view returns (uint256) {
        return (_underlyingAmount * RAY) / liquidityIndex;
    }
}
