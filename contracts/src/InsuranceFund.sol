// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title  InsuranceFund
 * @notice Holds protocol reserve assets accumulated from borrower interest (reserve factor).
 *
 *         The InsuranceFund is the first loss absorber in the Liquihood loss waterfall:
 *           1. Borrower collateral is seized first.
 *           2. Any remaining shortfall is covered by the InsuranceFund.
 *           3. Only if the Fund is exhausted does supplier principal take a haircut.
 *
 *         Reserves are contributed by the LendingPool when it collects the reserve share
 *         of accrued interest. The owner (governance) may withdraw surplus reserves or
 *         deploy them to whitelisted yield strategies.
 *
 *         Multiple reserve tokens are supported (one per pool asset).
 *
 * @author Liquihood Protocol
 */
contract InsuranceFund is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Address of the LendingPool. Only it may call `coverShortfall`.
    address public lendingPool;

    /// @notice Accumulated reserves per token address.
    mapping(address => uint256) public reserves;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ReservesDeposited(address indexed token, uint256 amount);
    event ShortfallCovered(address indexed token, uint256 requested, uint256 covered);
    event ReservesWithdrawn(address indexed token, address indexed to, uint256 amount);
    event LendingPoolUpdated(address indexed previous, address indexed next);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner   Protocol owner / governance address.
     */
    constructor(address _owner) Ownable(_owner) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Reserve Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Accept a reserve contribution from the LendingPool.
     * @dev    Caller must have approved this contract to spend `_amount` of `_token`.
     * @param  _token   ERC-20 token address.
     * @param  _amount  Amount to deposit.
     */
    function depositReserves(address _token, uint256 _amount) external {
        require(msg.sender == lendingPool || msg.sender == owner(), "IF: unauthorised");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        reserves[_token] += _amount;
        emit ReservesDeposited(_token, _amount);
    }

    /**
     * @notice Cover a shortfall from a bad-debt liquidation.
     * @dev    Called by LendingPool. Returns the actual amount covered (may be less than
     *         requested if the fund is partially depleted).
     * @param  _token     ERC-20 token to send.
     * @param  _to        Recipient (typically the LendingPool or a specific pool).
     * @param  _requested Shortfall amount requested.
     * @return covered    Actual amount sent.
     */
    function coverShortfall(
        address _token,
        address _to,
        uint256 _requested
    ) external returns (uint256 covered) {
        require(msg.sender == lendingPool, "IF: only LendingPool");
        covered = _requested > reserves[_token] ? reserves[_token] : _requested;
        if (covered == 0) return 0;
        reserves[_token] -= covered;
        IERC20(_token).safeTransfer(_to, covered);
        emit ShortfallCovered(_token, _requested, covered);
    }

    /**
     * @notice Governance withdrawal of surplus reserves.
     * @param  _token  ERC-20 token to withdraw.
     * @param  _to     Recipient address.
     * @param  _amount Amount to withdraw.
     */
    function withdrawReserves(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_amount <= reserves[_token], "IF: insufficient reserves");
        reserves[_token] -= _amount;
        IERC20(_token).safeTransfer(_to, _amount);
        emit ReservesWithdrawn(_token, _to, _amount);
    }

    /**
     * @notice Return balance of a given reserve token held by this contract.
     */
    function balanceOf(address _token) external view returns (uint256) {
        return reserves[_token];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Set the authorised LendingPool address. Only callable once by owner.
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        require(_lendingPool != address(0), "IF: zero address");
        emit LendingPoolUpdated(lendingPool, _lendingPool);
        lendingPool = _lendingPool;
    }
}
