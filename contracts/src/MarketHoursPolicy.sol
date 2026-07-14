// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  MarketHoursPolicy
 * @notice Enforces trading-hour restrictions on equity-backed collateral operations.
 *
 *         Borrowing against tokenized equities (AAPL-T, NVDA-T, TSLA-T, etc.) is only
 *         permitted during NYSE trading hours. This prevents adverse price-gap risk from
 *         overnight or weekend moves that on-chain oracles cannot reflect in real time.
 *
 *         The keeper network is responsible for calling `setMarketOpen` once per day
 *         at market open (09:30 ET) and market close (16:00 ET). Failing to call
 *         close will NOT lock borrowers in — the contract stores a deadline beyond which
 *         the market is automatically considered closed (circuit breaker).
 *
 *         Withdrawal and repayment of equity collateral are always permitted regardless
 *         of market hours (borrowers must always be able to reduce risk).
 *
 * @author Liquihood Protocol
 */
contract MarketHoursPolicy is Ownable {
    /// @notice Maximum duration a market-open window can stay open without a close call.
    ///         If exceeded, `isMarketOpen()` returns false automatically.
    uint256 public constant MAX_OPEN_DURATION = 8 hours;

    /// @notice Authorised keeper that may toggle market open/closed.
    address public keeper;

    /// @notice Timestamp when the market was last opened.
    uint256 public openedAt;

    /// @notice Whether the market is currently in an open state.
    bool public marketOpen;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event MarketOpened(uint256 timestamp);
    event MarketClosed(uint256 timestamp);
    event KeeperUpdated(address indexed previous, address indexed next);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner   Protocol owner / governance address.
     * @param _keeper  Initial keeper address.
     */
    constructor(address _owner, address _keeper) Ownable(_owner) {
        require(_keeper != address(0), "MHP: zero keeper");
        keeper = _keeper;
        emit KeeperUpdated(address(0), _keeper);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Market State
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns true only when the market is open AND the window has not expired.
     */
    function isMarketOpen() public view returns (bool) {
        if (!marketOpen) return false;
        return block.timestamp < openedAt + MAX_OPEN_DURATION;
    }

    /**
     * @notice Revert if the equity market is not currently open.
     * @dev    Used as a modifier hook by LendingPool before equity borrows.
     */
    function requireMarketOpen() external view {
        require(isMarketOpen(), "MHP: equity market closed");
    }

    /**
     * @notice Keeper opens the equity market window.
     */
    function openMarket() external {
        require(msg.sender == keeper || msg.sender == owner(), "MHP: unauthorised");
        require(!isMarketOpen(), "MHP: already open");
        marketOpen = true;
        openedAt = block.timestamp;
        emit MarketOpened(block.timestamp);
    }

    /**
     * @notice Keeper closes the equity market window.
     */
    function closeMarket() external {
        require(msg.sender == keeper || msg.sender == owner(), "MHP: unauthorised");
        marketOpen = false;
        emit MarketClosed(block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Replace the keeper address. Only callable by owner.
     */
    function setKeeper(address _keeper) external onlyOwner {
        require(_keeper != address(0), "MHP: zero keeper");
        emit KeeperUpdated(keeper, _keeper);
        keeper = _keeper;
    }
}
