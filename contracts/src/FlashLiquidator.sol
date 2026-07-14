// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/ILendingPool.sol";

interface IUniswapV2Pair {
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title  FlashLiquidator
 * @notice Executes capital-free liquidations using UniswapV2 flash swaps.
 *
 *         Atomic flow (single transaction):
 *           1. flashLiquidate() borrows `debtAmount` of `debtAsset` from `flashPair`.
 *           2. uniswapV2Call() callback (pair is reentrancy-locked):
 *              a. Calls LendingPool.liquidate() — repays debtAsset, seizes collateral.
 *              b. Optionally swaps seized collateral → repayToken via the router.
 *                 swapPath MUST NOT traverse flashPair (which is locked):
 *                 enforced by requiring swapPath[0] != debtAsset.
 *              c. Computes minimum flash repayment from pre-swap reserves:
 *                   repayMin = ceil( R_repay × flash × 1000 / (997 × (R_debt − flash)) )
 *              d. Transfers repayMin of repayToken to the pair.
 *              e. Transfers excess repayToken as profit to the initiator.
 *
 *         Why repayToken differs from debtAsset:
 *           Repaying in the OTHER pair token avoids re-entering the locked pair.
 *           Example: borrow USDG from WETH/USDG, repay with WETH.
 *             - WETH collateral → repay directly, no swap.
 *             - CASHCAT collateral → swap via CASHCAT/WETH (not locked), repay WETH.
 *             - VIRTUAL collateral → swap via VIRTUAL/WETH (not locked), repay WETH.
 *
 *         Stack-depth notes:
 *           - flashLiquidate accepts FlashParams calldata (one stack slot).
 *           - uniswapV2Call decodes into CallbackData memory (one stack slot).
 *           - All helpers receive the memory pointer; fields read via MLOAD, not stack.
 *
 *         Security:
 *           - flashLiquidate() is onlyOwner.
 *           - uniswapV2Call() requires msg.sender == _pendingPair (transient guard).
 *           - swapPath[0] must not equal debtAsset (blocks routing through flashPair).
 *
 * @author Liquihood Protocol
 */
contract FlashLiquidator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ILendingPool     public immutable lendingPool;
    IUniswapV2Router public immutable router;

    /// @dev Transient guard: set before pair.swap(), cleared after it returns.
    address private _pendingPair;

    // ─── Structs ──────────────────────────────────────────────────────────────

    /**
     * @dev Input parameters for a flash liquidation.
     *      Packed as a single calldata struct so flashLiquidate() uses one stack slot.
     */
    struct FlashParams {
        address   borrower;
        address   debtAsset;        // token we flash-borrow and repay to LendingPool
        address   collateralAsset;  // token seized from the borrower
        uint256   debtAmount;       // repay amount ≤ close-factor × borrower's debt
        address   flashPair;        // UniswapV2 pair to flash-borrow debtAsset from
        address   repayToken;       // OTHER token of flashPair (used to repay flash loan)
        address[] swapPath;         // collateralAsset → … → repayToken (empty if same)
    }

    /**
     * @dev Internal callback data — ABI-encoded into the bytes passed to pair.swap()
     *      and decoded back in uniswapV2Call as a single memory pointer.
     */
    struct CallbackData {
        address   borrower;
        address   debtAsset;
        address   collateralAsset;
        uint256   debtAmount;
        address   repayToken;
        address[] swapPath;
        address   profitTo;  // receives excess repayToken as profit
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    event FlashLiquidation(
        address indexed borrower,
        address indexed collateralAsset,
        uint256 flashAmount,
        address repayToken,
        uint256 profit
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _owner, address _lendingPool, address _router) Ownable(_owner) {
        require(_lendingPool != address(0), "FL: zero lendingPool");
        require(_router      != address(0), "FL: zero router");
        lendingPool = ILendingPool(_lendingPool);
        router      = IUniswapV2Router(_router);
    }

    // ─── External ────────────────────────────────────────────────────────────

    /**
     * @notice Initiate a capital-free liquidation via UniswapV2 flash swap.
     * @param p  Flash liquidation parameters (see FlashParams).
     */
    // slither-disable-next-line reentrancy-benign
    function flashLiquidate(FlashParams calldata p) external onlyOwner nonReentrant {
        require(p.debtAmount > 0,            "FL: zero debtAmount");
        require(p.flashPair != address(0),   "FL: zero pair");
        require(p.repayToken != address(0),  "FL: zero repayToken");
        require(p.repayToken != p.debtAsset, "FL: repayToken must differ from debtAsset");

        if (p.swapPath.length > 0) {
            require(p.swapPath[0] != p.debtAsset,                      "FL: path must not start with borrowed token");
            require(p.swapPath[p.swapPath.length - 1] == p.repayToken, "FL: path must end with repayToken");
        }

        // Encode callback payload — all field reads are CALLDATALOAD (p is one stack slot)
        bytes memory data = abi.encode(CallbackData({
            borrower:        p.borrower,
            debtAsset:       p.debtAsset,
            collateralAsset: p.collateralAsset,
            debtAmount:      p.debtAmount,
            repayToken:      p.repayToken,
            swapPath:        p.swapPath,
            profitTo:        msg.sender
        }));

        // Initiate flash swap
        address t0 = IUniswapV2Pair(p.flashPair).token0();
        _pendingPair = p.flashPair;
        IUniswapV2Pair(p.flashPair).swap(
            t0 == p.debtAsset ? p.debtAmount : 0,
            t0 == p.debtAsset ? 0 : p.debtAmount,
            address(this),
            data
        );
        _pendingPair = address(0); // slither-disable-line reentrancy-benign
    }

    // ─── UniswapV2 Flash Swap Callback ────────────────────────────────────────

    /**
     * @notice Called by flashPair after delivering borrowed tokens.
     *         Decodes CallbackData as a single memory pointer (one stack slot)
     *         then delegates to _handleCallback.
     */
    function uniswapV2Call(
        address /*sender*/,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        require(msg.sender == _pendingPair, "FL: untrusted pair");
        // Decode into a memory struct pointer (1 stack slot) — avoids stack-too-deep
        CallbackData memory p = abi.decode(data, (CallbackData));
        _handleCallback(amount0 > 0 ? amount0 : amount1, p);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /**
     * @dev Core callback execution. msg.sender is forwarded from uniswapV2Call (= flash pair).
     *      Receives CallbackData as a memory pointer — only `flashAmount` and `p` on stack.
     */
    function _handleCallback(uint256 flashAmount, CallbackData memory p) internal {
        // 1. Liquidate the borrower
        IERC20(p.debtAsset).forceApprove(address(lendingPool), flashAmount);
        lendingPool.liquidate(p.borrower, p.debtAsset, p.collateralAsset, p.debtAmount);

        // 2. Ensure we hold repayToken (swap collateral if needed)
        _convertToRepayToken(p.collateralAsset, p.repayToken, p.swapPath);

        // 3. Compute and pay flash repayment (uses pre-swap reserves from msg.sender)
        uint256 repayMin = _computeRepay(flashAmount, p.repayToken);
        uint256 balance  = IERC20(p.repayToken).balanceOf(address(this));
        require(balance >= repayMin, "FL: insufficient repayToken");
        IERC20(p.repayToken).safeTransfer(msg.sender, repayMin); // msg.sender = flash pair

        // 4. Forward profit
        uint256 profit = balance - repayMin;
        if (profit > 0) IERC20(p.repayToken).safeTransfer(p.profitTo, profit);

        // slither-disable-next-line reentrancy-events
        emit FlashLiquidation(p.borrower, p.collateralAsset, flashAmount, p.repayToken, profit);
    }

    /**
     * @dev Swap all seized collateral → repayToken via the router.
     *      If collateral already IS repayToken, no swap is needed.
     *      swapPath must not route through the flash pair (validated in flashLiquidate).
     */
    function _convertToRepayToken(
        address collateralAsset,
        address repayToken,
        address[] memory swapPath
    ) internal {
        if (collateralAsset == repayToken) {
            require(IERC20(repayToken).balanceOf(address(this)) > 0, "FL: no collateral seized");
            return;
        }
        require(swapPath.length >= 2, "FL: swap path required");
        uint256 seized = IERC20(collateralAsset).balanceOf(address(this));
        require(seized > 0, "FL: no collateral seized");
        IERC20(collateralAsset).forceApprove(address(router), seized);
        // slither-disable-next-line unused-return
        router.swapExactTokensForTokens(seized, 0, swapPath, address(this), block.timestamp + 300);
    }

    /**
     * @dev Compute minimum repayToken needed to satisfy the UniswapV2 K invariant.
     *
     *      K check: (R_repay + repay)×997/1000 × (R_debt − flash) ≥ R_repay × R_debt
     *      Solving: repayMin = ceil( R_repay × flash × 1000 / (997 × (R_debt − flash)) )
     *
     *      msg.sender = flash pair (preserved through internal call chain).
     *      getReserves() returns stored pre-_update reserves (= pre-flash values). ✓
     */
    function _computeRepay(uint256 flashAmount, address repayToken) internal view returns (uint256) {
        // slither-disable-next-line unused-return
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(msg.sender).getReserves();
        bool repayIsToken0 = (IUniswapV2Pair(msg.sender).token0() == repayToken);
        uint256 R_repay = repayIsToken0 ? uint256(reserve0) : uint256(reserve1);
        uint256 R_debt  = repayIsToken0 ? uint256(reserve1) : uint256(reserve0);
        require(R_debt > flashAmount, "FL: insufficient pair liquidity");
        uint256 denom = 997 * (R_debt - flashAmount);
        return (R_repay * flashAmount * 1000 + denom - 1) / denom; // ceil
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Recover tokens accidentally sent to this contract.
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
