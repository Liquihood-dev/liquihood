// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./LHToken.sol";
import "./DebtToken.sol";
import "./OracleRouter.sol";
import "./InterestRateModel.sol";
import "./HealthFactorEngine.sol";
import "./LiquidationManager.sol";
import "./IsolatedMarketController.sol";
import "./MarketHoursPolicy.sol";
import "./InsuranceFund.sol";
import "./interfaces/ILendingPool.sol";

/**
 * @title  LendingPool
 * @notice Main entry point for all Liquihood protocol operations.
 *
 *         Supported operations:
 *           - supply(asset, amount)        — Deposit collateral, receive lhTokens.
 *           - withdraw(asset, amount)      — Burn lhTokens, receive underlying.
 *           - borrow(asset, amount)        — Borrow against posted collateral.
 *           - repay(asset, amount)         — Repay debt, reduce DebtToken balance.
 *           - liquidate(borrower, ...)     — Seize undercollateralised collateral.
 *
 *         Each asset has a corresponding LHToken (supply receipt) and DebtToken
 *         (debt tracker). Interest accrues per block by advancing the liquidity
 *         index and borrow index of each pool.
 *
 *         Risk checks (health factor, borrow capacity, market hours) are enforced
 *         by delegating to HealthFactorEngine, MarketHoursPolicy, and
 *         IsolatedMarketController respectively.
 *
 *         The reserve share of accrued interest is forwarded to the InsuranceFund
 *         on each interest accrual event.
 *
 * @author Liquihood Protocol
 */
contract LendingPool is Ownable, ReentrancyGuard, ILendingPool {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct ReserveData {
        address asset;
        LHToken  lhToken;
        DebtToken debtToken;
        InterestRateModel irm;
        uint256 totalLiquidity;       // total underlying supplied (before fees)
        uint256 lastUpdateTimestamp;  // last interest accrual block timestamp
        bool    active;
        bool    borrowingEnabled;
        bool    isEquityAsset;        // true → equity hours restriction applies
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Protocol Modules
    // ─────────────────────────────────────────────────────────────────────────

    OracleRouter             public oracle;                    // mutable — has setOracle() admin function
    HealthFactorEngine       public immutable hfEngine;
    LiquidationManager       public immutable liquidationManager;
    IsolatedMarketController public immutable isolatedController;
    MarketHoursPolicy        public immutable marketHoursPolicy;
    InsuranceFund            public immutable insuranceFund;

    // ─────────────────────────────────────────────────────────────────────────
    // Reserve Registry
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Asset address → reserve data.
    mapping(address => ReserveData) public reserves;

    /// @notice Ordered list of all registered reserve asset addresses.
    address[] public reserveList;

    /// @notice User collateral per asset (user → asset → amount).
    mapping(address => mapping(address => uint256)) public userCollateral;

    /// @notice Assets supplied as collateral by a user (user → asset → enabled).
    mapping(address => mapping(address => bool)) public userCollateralEnabled;

    /// @notice Ordered list of collateral assets per user.
    mapping(address => address[]) public userCollateralList;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Liquidation(
        address indexed liquidator,
        address indexed borrower,
        address  debtAsset,
        address  collateralAsset,
        uint256  debtRepaid,
        uint256  collateralSeized
    );
    event ReserveAdded(address indexed asset, address lhToken, address debtToken);
    event InterestAccrued(address indexed asset, uint256 liquidityIndex, uint256 borrowIndex);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _owner              Protocol owner / governance.
     * @param _oracle             Deployed OracleRouter address.
     * @param _hfEngine           Deployed HealthFactorEngine address.
     * @param _liquidationManager Deployed LiquidationManager address.
     * @param _isolatedController Deployed IsolatedMarketController address.
     * @param _marketHoursPolicy  Deployed MarketHoursPolicy address.
     * @param _insuranceFund      Deployed InsuranceFund address.
     */
    constructor(
        address _owner,
        address _oracle,
        address _hfEngine,
        address _liquidationManager,
        address _isolatedController,
        address _marketHoursPolicy,
        address _insuranceFund
    ) Ownable(_owner) {
        require(_oracle != address(0), "LP: zero oracle");
        require(_hfEngine != address(0), "LP: zero hfEngine");
        require(_liquidationManager != address(0), "LP: zero liquidationManager");
        require(_isolatedController != address(0), "LP: zero isolatedController");
        require(_marketHoursPolicy != address(0), "LP: zero marketHoursPolicy");
        require(_insuranceFund != address(0), "LP: zero insuranceFund");

        oracle             = OracleRouter(_oracle);
        hfEngine           = HealthFactorEngine(_hfEngine);
        liquidationManager = LiquidationManager(_liquidationManager);
        isolatedController = IsolatedMarketController(_isolatedController);
        marketHoursPolicy  = MarketHoursPolicy(_marketHoursPolicy);
        insuranceFund      = InsuranceFund(_insuranceFund);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core User Operations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Supply `_amount` of `_asset` to the protocol and receive lhTokens.
     * @param  _asset   ERC-20 asset to supply.
     * @param  _amount  Amount in asset's native decimal precision.
     */
    // slither-disable-next-line reentrancy-no-eth,reentrancy-benign
    function supply(address _asset, uint256 _amount) external nonReentrant {
        require(_amount > 0, "LP: zero amount");
        ReserveData storage reserve = reserves[_asset];
        require(reserve.active, "LP: reserve not active");

        _accrueInterest(_asset);

        // CEI: Effects — update all state before external token interactions.
        reserve.totalLiquidity += _amount;
        if (!userCollateralEnabled[msg.sender][_asset]) {
            userCollateralEnabled[msg.sender][_asset] = true;
            userCollateralList[msg.sender].push(_asset);
        }
        userCollateral[msg.sender][_asset] += _amount;

        // Interactions — pull tokens then mint receipt tokens.
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        reserve.lhToken.mint(msg.sender, _amount);

        emit Supply(msg.sender, _asset, _amount);
    }

    /**
     * @notice Withdraw `_amount` of `_asset` from the protocol by burning lhTokens.
     * @param  _asset   ERC-20 asset to withdraw.
     * @param  _amount  Amount to withdraw.
     */
    // slither-disable-next-line reentrancy-no-eth,reentrancy-benign
    function withdraw(address _asset, uint256 _amount) external nonReentrant {
        require(_amount > 0, "LP: zero amount");
        ReserveData storage reserve = reserves[_asset];
        require(reserve.active, "LP: reserve not active");

        _accrueInterest(_asset);

        require(userCollateral[msg.sender][_asset] >= _amount, "LP: insufficient collateral");

        // Ensure withdrawal does not drop HF below 1.0.
        _requireHealthy(msg.sender, _asset, _amount, true);

        // CEI: Effects first — update state before any external interaction.
        userCollateral[msg.sender][_asset] -= _amount;
        reserve.totalLiquidity -= _amount;

        // Interactions — burn receipt tokens, then release underlying.
        reserve.lhToken.burn(msg.sender, _amount);
        IERC20(_asset).safeTransfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _asset, _amount);
    }

    /**
     * @notice Borrow `_amount` of `_asset` against supplied collateral.
     * @param  _asset   Asset to borrow.
     * @param  _amount  Amount to borrow.
     */
    // slither-disable-next-line reentrancy-no-eth
    function borrow(address _asset, uint256 _amount) external nonReentrant {
        require(_amount > 0, "LP: zero amount");
        ReserveData storage reserve = reserves[_asset];
        require(reserve.active, "LP: reserve not active");
        require(reserve.borrowingEnabled, "LP: borrowing disabled");

        // Enforce equity market hours.
        if (reserve.isEquityAsset) {
            marketHoursPolicy.requireMarketOpen();
        }

        _accrueInterest(_asset);

        // Health factor check: ensure borrow does not cause HF < 1.0.
        _requireBorrowAllowed(msg.sender, _asset, _amount);

        // Isolated market ceiling check.
        address isolatedCollateral = _getIsolatedCollateral(msg.sender);
        if (isolatedCollateral != address(0)) {
            uint256 borrowPriceUSD = oracle.getPrice(_asset);
            // debtUSD in 8-decimal: amount(18) × price(8) → 26-dec; normalise to 8-dec.
            uint256 debtUSD8 = (_amount * borrowPriceUSD) / 1e18;
            isolatedController.validateBorrow(isolatedCollateral, _asset, debtUSD8);
            isolatedController.increaseDebt(isolatedCollateral, debtUSD8);
        }

        // Mint DebtToken and transfer asset to borrower.
        reserve.debtToken.mint(msg.sender, _amount);
        IERC20(_asset).safeTransfer(msg.sender, _amount);

        emit Borrow(msg.sender, _asset, _amount);
    }

    /**
     * @notice Repay `_amount` of `_asset` debt.
     * @param  _asset   Debt asset to repay.
     * @param  _amount  Amount to repay. Use type(uint256).max to repay the full balance.
     */
    // slither-disable-next-line reentrancy-no-eth
    function repay(address _asset, uint256 _amount) external nonReentrant {
        require(_amount > 0, "LP: zero amount");
        ReserveData storage reserve = reserves[_asset];
        require(reserve.active, "LP: reserve not active");

        _accrueInterest(_asset);

        uint256 currentDebt = reserve.debtToken.balanceOf(msg.sender);
        require(currentDebt > 0, "LP: no debt");

        uint256 repayAmount = _amount > currentDebt ? currentDebt : _amount;

        IERC20(_asset).safeTransferFrom(msg.sender, address(this), repayAmount);
        reserve.debtToken.burn(msg.sender, repayAmount);

        // Update isolated debt tracker if applicable.
        address isolatedCollateral = _getIsolatedCollateral(msg.sender);
        if (isolatedCollateral != address(0) && isolatedController.isIsolated(isolatedCollateral)) {
            uint256 repaidPriceUSD = oracle.getPrice(_asset);
            uint256 repaidUSD8 = (repayAmount * repaidPriceUSD) / 1e18;
            isolatedController.decreaseDebt(isolatedCollateral, repaidUSD8);
        }

        emit Repay(msg.sender, _asset, repayAmount);
    }

    /**
     * @notice Liquidate an undercollateralised position.
     *
     * @param  _borrower          Address of the borrower to liquidate.
     * @param  _debtAsset         Asset the liquidator will repay on behalf of the borrower.
     * @param  _collateralAsset   Asset the liquidator will receive as a reward.
     * @param  _debtAmountToRepay Amount of debt to repay (capped at 50% of total debt).
     */
    // slither-disable-next-line reentrancy-no-eth
    function liquidate(
        address _borrower,
        address _debtAsset,
        address _collateralAsset,
        uint256 _debtAmountToRepay
    ) external nonReentrant {
        require(_borrower != msg.sender, "LP: cannot self-liquidate");
        require(_debtAmountToRepay > 0, "LP: zero repay amount");
        require(reserves[_debtAsset].active && reserves[_collateralAsset].active, "LP: reserve inactive");

        _accrueInterest(_debtAsset);
        _accrueInterest(_collateralAsset);
        require(_isLiquidatable(_borrower), "LP: position healthy");

        _executeLiquidation(_borrower, _debtAsset, _collateralAsset, _debtAmountToRepay);
    }

    /// @dev Internal liquidation execution — isolated to avoid stack-too-deep.
    function _executeLiquidation(
        address _borrower,
        address _debtAsset,
        address _collateralAsset,
        uint256 _debtAmountToRepay
    ) internal {
        // Cap repay at 50% close factor.
        uint256 totalDebt   = reserves[_debtAsset].debtToken.balanceOf(_borrower);
        uint256 repayAmount = _debtAmountToRepay > liquidationManager.maxRepayAmount(totalDebt)
            ? liquidationManager.maxRepayAmount(totalDebt)
            : _debtAmountToRepay;

        // Collateral to seize — first two return values (ltv, liqThreshold) intentionally unused.
        // slither-disable-next-line unused-return
        (, , uint256 liqBonus) = hfEngine.getAssetRiskParams(_collateralAsset);
        (uint256 toSeize, uint256 bonus) = liquidationManager.calculateCollateralToSeize(
            oracle.getPrice(_debtAsset),
            oracle.getPrice(_collateralAsset),
            liqBonus,
            repayAmount
        );

        // Cap at available collateral; compute bad debt if any.
        uint256 available = userCollateral[_borrower][_collateralAsset];
        uint256 badDebt   = 0;
        if (toSeize > available) {
            toSeize = available;
            badDebt = _computeBadDebt(repayAmount, toSeize, _debtAsset, _collateralAsset);
        }

        // CEI: Effects first — update all state before any external interaction.
        userCollateral[_borrower][_collateralAsset] -= toSeize;
        reserves[_collateralAsset].totalLiquidity   -= toSeize;

        // Interactions — external calls after all state is settled.
        IERC20(_debtAsset).safeTransferFrom(msg.sender, address(this), repayAmount);
        reserves[_debtAsset].debtToken.burn(_borrower, repayAmount);
        reserves[_collateralAsset].lhToken.burn(_borrower, toSeize);
        IERC20(_collateralAsset).safeTransfer(msg.sender, toSeize);

        liquidationManager.recordLiquidation(
            msg.sender, _borrower, _debtAsset, _collateralAsset, repayAmount, toSeize, bonus, badDebt
        );
        emit Liquidation(msg.sender, _borrower, _debtAsset, _collateralAsset, repayAmount, toSeize);
    }

    /// @dev Compute shortfall (bad debt) when collateral is insufficient to cover repaid debt.
    function _computeBadDebt(
        uint256 repayAmount,
        uint256 seizedCollateral,
        address debtAsset,
        address collateralAsset
    ) internal view returns (uint256) {
        uint256 debtUSD    = repayAmount      * oracle.getPrice(debtAsset);
        uint256 seizedUSD  = seizedCollateral * oracle.getPrice(collateralAsset);
        if (debtUSD <= seizedUSD) return 0;
        return (debtUSD - seizedUSD) / oracle.getPrice(debtAsset);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance — Reserve Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new asset reserve. Deploys lhToken and DebtToken automatically.
     *
     * @param  _asset          Underlying ERC-20 asset address.
     * @param  _irm            Interest rate model address.
     * @param  _isEquity       True if the asset is a tokenized equity (market-hours enforced).
     * @param  _lhName         lhToken name (e.g. "Liquihood USDG").
     * @param  _lhSymbol       lhToken symbol (e.g. "lhUSDG").
     * @param  _debtName       DebtToken name (e.g. "Liquihood Debt USDG").
     * @param  _debtSymbol     DebtToken symbol (e.g. "dUSDG").
     */
    function addReserve(
        address _asset,
        address _irm,
        bool    _isEquity,
        string  calldata _lhName,
        string  calldata _lhSymbol,
        string  calldata _debtName,
        string  calldata _debtSymbol
    ) external onlyOwner {
        require(_asset != address(0), "LP: zero asset");
        require(!reserves[_asset].active, "LP: reserve exists");

        LHToken   lhToken   = new LHToken(address(this), _asset, _lhName, _lhSymbol);
        DebtToken debtToken = new DebtToken(address(this), _asset, _debtName, _debtSymbol);

        reserves[_asset] = ReserveData({
            asset:               _asset,
            lhToken:             lhToken,
            debtToken:           debtToken,
            irm:                 InterestRateModel(_irm),
            totalLiquidity:      0,
            lastUpdateTimestamp: block.timestamp,
            active:              true,
            borrowingEnabled:    true,
            isEquityAsset:       _isEquity
        });
        reserveList.push(_asset);

        emit ReserveAdded(_asset, address(lhToken), address(debtToken));
    }

    /**
     * @notice Pause or unpause borrowing for a specific reserve. Only callable by owner.
     */
    function setBorrowingEnabled(address _asset, bool _enabled) external onlyOwner {
        reserves[_asset].borrowingEnabled = _enabled;
    }

    /**
     * @notice Pause or unpause a reserve entirely. Only callable by owner.
     */
    function setReserveActive(address _asset, bool _active) external onlyOwner {
        reserves[_asset].active = _active;
    }

    /**
     * @notice Update the OracleRouter address. Only callable by owner.
     * @dev    Used when upgrading to a new oracle contract (e.g. multi-keeper upgrade).
     * @param  _oracle  New OracleRouter address.
     */
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "LP: zero oracle");
        oracle = OracleRouter(_oracle);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interest Accrual (internal)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Advance the liquidity index and borrow index for `_asset` based on
     *         elapsed time since the last update.
     * @dev    Uses simple interest approximation per second to avoid compounding
     *         imprecision over long gaps:
     *           newIndex = oldIndex × (1 + annualRate × elapsedSeconds / SECONDS_PER_YEAR)
     */
    function _accrueInterest(address _asset) internal {
        ReserveData storage reserve = reserves[_asset];
        uint256 elapsed = block.timestamp - reserve.lastUpdateTimestamp;
        if (elapsed == 0) return; // slither-disable-line incorrect-equality

        uint256 RAY = 1e27;
        uint256 SECONDS_PER_YEAR = 365 days;

        uint256 totalDebtAmt = reserve.debtToken.totalDebt();
        uint256 totalLiq     = reserve.totalLiquidity;

        (uint256 borrowRate, uint256 supplyRate) = reserve.irm.getRates(totalDebtAmt, totalLiq);

        // Simple interest: index × (1 + rate × elapsed / SECONDS_PER_YEAR)
        uint256 borrowFactor = RAY + (borrowRate * elapsed) / SECONDS_PER_YEAR;
        uint256 supplyFactor = RAY + (supplyRate * elapsed) / SECONDS_PER_YEAR;

        uint256 newBorrowIndex = (reserve.debtToken.borrowIndex() * borrowFactor) / RAY;
        uint256 newLiquidityIndex = (reserve.lhToken.liquidityIndex() * supplyFactor) / RAY;

        // CEI: write timestamp (effect) before calling external token contracts.
        reserve.lastUpdateTimestamp = block.timestamp;
        reserve.debtToken.updateIndex(newBorrowIndex);
        reserve.lhToken.updateIndex(newLiquidityIndex);

        emit InterestAccrued(_asset, newLiquidityIndex, newBorrowIndex);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Health Factor Helpers (internal)
    // ─────────────────────────────────────────────────────────────────────────

    function _isLiquidatable(address _user) internal view returns (bool) {
        (
            address[] memory cAssets, uint256[] memory cAmounts, uint256[] memory cPrices,
            address[] memory dAssets, uint256[] memory dAmounts, uint256[] memory dPrices
        ) = _buildPositionArrays(_user);
        return hfEngine.isLiquidatable(cAssets, cAmounts, cPrices, dAssets, dAmounts, dPrices);
    }

    function _requireHealthy(
        address _user,
        address _withdrawAsset,
        uint256 _withdrawAmount,
        bool _isWithdraw
    ) internal view {
        // Temporarily reduce collateral amount to check post-withdrawal HF.
        (
            address[] memory cAssets, uint256[] memory cAmounts, uint256[] memory cPrices,
            address[] memory dAssets, uint256[] memory dAmounts, uint256[] memory dPrices
        ) = _buildPositionArrays(_user);

        if (_isWithdraw) {
            for (uint256 i = 0; i < cAssets.length; i++) {
                if (cAssets[i] == _withdrawAsset) {
                    cAmounts[i] = cAmounts[i] > _withdrawAmount
                        ? cAmounts[i] - _withdrawAmount
                        : 0;
                }
            }
        }

        uint256 hf = hfEngine.computeHealthFactor(cAssets, cAmounts, cPrices, dAssets, dAmounts, dPrices);
        require(hf >= 1e27, "LP: health factor too low");
    }

    function _requireBorrowAllowed(
        address _user,
        address _debtAsset,
        uint256 _borrowAmount
    ) internal view {
        (
            address[] memory cAssets, uint256[] memory cAmounts, uint256[] memory cPrices,
            address[] memory dAssets, uint256[] memory dAmounts, uint256[] memory dPrices
        ) = _buildPositionArrays(_user);

        // Temporarily add the new debt.
        address[] memory newDAssets  = new address[](dAssets.length + 1);
        uint256[] memory newDAmounts = new uint256[](dAmounts.length + 1);
        uint256[] memory newDPrices  = new uint256[](dPrices.length + 1);
        for (uint256 i = 0; i < dAssets.length; i++) {
            newDAssets[i]  = dAssets[i];
            newDAmounts[i] = dAmounts[i];
            newDPrices[i]  = dPrices[i];
        }
        newDAssets[dAssets.length]  = _debtAsset;
        newDAmounts[dAmounts.length] = _borrowAmount;
        newDPrices[dPrices.length]  = oracle.getPrice(_debtAsset);

        uint256 hf = hfEngine.computeHealthFactor(cAssets, cAmounts, cPrices, newDAssets, newDAmounts, newDPrices);
        require(hf >= 1e27, "LP: insufficient collateral");
    }

    function _buildPositionArrays(address _user)
        internal
        view
        returns (
            address[] memory cAssets,
            uint256[] memory cAmounts,
            uint256[] memory cPrices,
            address[] memory dAssets,
            uint256[] memory dAmounts,
            uint256[] memory dPrices
        )
    {
        address[] memory userCols = userCollateralList[_user];
        cAssets  = new address[](userCols.length);
        cAmounts = new uint256[](userCols.length);
        cPrices  = new uint256[](userCols.length);
        for (uint256 i = 0; i < userCols.length; i++) {
            cAssets[i]  = userCols[i];
            cAmounts[i] = userCollateral[_user][userCols[i]];
            cPrices[i]  = oracle.getPrice(userCols[i]);
        }

        // Count debt positions — cache array length to avoid repeated storage reads.
        uint256 reserveCount = reserveList.length;
        uint256 debtCount = 0;
        for (uint256 i = 0; i < reserveCount; i++) {
            if (reserves[reserveList[i]].debtToken.balanceOf(_user) > 0) debtCount++;
        }
        dAssets  = new address[](debtCount);
        dAmounts = new uint256[](debtCount);
        dPrices  = new uint256[](debtCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < reserveCount; i++) {
            uint256 debt = reserves[reserveList[i]].debtToken.balanceOf(_user);
            if (debt > 0) {
                dAssets[idx]  = reserveList[i];
                dAmounts[idx] = debt;
                dPrices[idx]  = oracle.getPrice(reserveList[i]);
                idx++;
            }
        }
    }

    function _getIsolatedCollateral(address _user) internal view returns (address) {
        address[] memory cols = userCollateralList[_user];
        for (uint256 i = 0; i < cols.length; i++) {
            if (isolatedController.isIsolated(cols[i]) &&
                userCollateral[_user][cols[i]] > 0) {
                return cols[i];
            }
        }
        return address(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Return the health factor of a user's position in ray.
     */
    function getHealthFactor(address _user) external view returns (uint256) {
        (
            address[] memory cAssets, uint256[] memory cAmounts, uint256[] memory cPrices,
            address[] memory dAssets, uint256[] memory dAmounts, uint256[] memory dPrices
        ) = _buildPositionArrays(_user);
        return hfEngine.computeHealthFactor(cAssets, cAmounts, cPrices, dAssets, dAmounts, dPrices);
    }

    /**
     * @notice Return all registered reserve asset addresses.
     */
    function getReserveList() external view returns (address[] memory) {
        return reserveList;
    }

    /**
     * @notice Return user's collateral amount for a given asset.
     */
    function getUserCollateral(address _user, address _asset) external view returns (uint256) {
        return userCollateral[_user][_asset];
    }

    /**
     * @notice Return user's debt for a given asset.
     */
    function getUserDebt(address _user, address _asset) external view returns (uint256) {
        return reserves[_asset].debtToken.balanceOf(_user);
    }

    /**
     * @notice Return total liquidity and total debt for a reserve.
     */
    function getReserveStats(address _asset)
        external
        view
        returns (uint256 totalLiquidity, uint256 totalDebt, uint256 utilizationRate)
    {
        ReserveData storage reserve = reserves[_asset];
        totalLiquidity  = reserve.totalLiquidity;
        totalDebt       = reserve.debtToken.totalDebt();
        utilizationRate = reserve.irm.getUtilization(totalDebt, totalLiquidity);
    }
}
