---
name: Flash liquidator design
description: Architecture and constraints for the FlashLiquidator contract + bot integration on Robinhood Chain.
---

# Flash Liquidator

## Deployed address
Read from `contracts/deployments/flash-liquidator.json` at runtime. Do not hardcode.

## Critical: repay with the OTHER token (WETH), not the borrowed token (USDG)
UniswapV2 pairs are reentrancy-locked during `swap()`. The original design borrowed USDG from WETH/USDG and then tried to swap seized WETH back to USDG via the same pair — this always reverts (locked pair).

**Correct design:** Borrow USDG from WETH/USDG pair but **repay in WETH** (the other token). The K-invariant math permits repayment in either token. This means:
- WETH collateral → repay WETH directly (no swap needed, collateral IS repayToken)
- CASHCAT collateral → swap CASHCAT→WETH via CASHCAT/WETH pair (NOT locked) → repay WETH
- VIRTUAL collateral → swap VIRTUAL→WETH via VIRTUAL/WETH pair (NOT locked) → repay WETH

**Why:** Any swap that routes through the flash pair inside `uniswapV2Call` will revert because the pair is locked. The swapPath must never include the flash pair — enforced by `require(swapPath[0] != debtAsset)`.

## Repayment math
`repayMin = ceil( R_repay × flash × 1000 / (997 × (R_debt − flash)) )`
- `R_repay` = pre-swap WETH reserve, `R_debt` = pre-swap USDG reserve
- `getReserves()` returns stored (pre-`_update`) values during the callback — these are the pre-flash values ✓

## Security pattern: _pendingPair guard
`uniswapV2Call()` verifies `msg.sender == _pendingPair`. The slot is set immediately before `pair.swap()` and cleared after it returns.

**Why:** Using only `abi.decode(data).flashPair` to verify the caller would allow a malicious contract to invoke the callback with forged data.

## Stack-depth design (Solidity)
`flashLiquidate` accepts `FlashParams calldata p` (a struct = 1 stack slot) instead of 7 individual parameters. This keeps the function under the EVM's 16-slot accessible-stack limit. Decoding in `uniswapV2Call` uses `CallbackData memory p` (1 stack slot pointer). Internal helpers receive the struct by pointer, reading fields via MLOAD.

**Why:** `via_ir = true` solves stack-too-deep but makes forge build time prohibitive (>5 min). Struct-based calling convention avoids the issue entirely at ~0 extra cost.

## Flash path availability
- Only **USDG debt** is currently supported (borrows USDG from WETH/USDG pair).
- CASHCAT and VIRTUAL collateral paths require their respective pairs (CASHCAT/WETH, VIRTUAL/WETH) to have liquidity. These were seeded as part of the DEX setup task.
- Non-USDG debt (stock tokens) has no flash pair — bot holds seized collateral in that case.

**How to apply:** When extending to other debt assets, add a flash source pair for that asset and update `getFlashPath()` in `liquidation-bot.ts`. The contract itself is already generic — the path is passed by the caller.

## Bot routing
In `attemptLiquidation()`:
1. Compute `maxByCloseFactor` (50% of borrower's debt).
2. Check `botDebtBalance` (direct ERC-20 balance).
3. If `botDebtBalance < maxByCloseFactor` AND FlashLiquidator AND a flash path exists → call `flashLiquidate({...})` as a tuple (FlashParams struct).
4. On flash failure → fall back to direct liquidation with available balance.
5. If both fail → skip and log warning.
