/**
 * use-on-chain-write.ts
 *
 * Wagmi hooks for real on-chain write operations: supply, withdraw, borrow, repay.
 * Each operation that requires a token transfer first checks allowance and,
 * if insufficient, sends an approve tx before the main action.
 *
 * Usage:
 *   const { supply, isPending, txHash, error } = useSupply();
 *   await supply(assetId, amountUnits);
 */

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { CONTRACTS, ASSET_TOKEN_ADDRESS, PROTOCOL_CONFIGURED } from '@/lib/contracts';
import { LENDING_POOL_ABI, ERC20_ABI } from '@/lib/abis';

type TxStatus = 'idle' | 'approving' | 'pending' | 'success' | 'error';

function useTxState() {
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const reset = () => { setStatus('idle'); setTxHash(undefined); setError(undefined); };

  return { status, setStatus, txHash, setTxHash, error, setError, reset };
}

/** Approve the LendingPool to spend `amount` of `tokenAddress`. Returns tx hash. */
async function ensureAllowance(
  writeContractAsync: ReturnType<typeof useWriteContract>['writeContractAsync'],
  publicClient: ReturnType<typeof usePublicClient>,
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  amount: bigint,
) {
  // Check current allowance
  const allowance = await publicClient!.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, CONTRACTS.LENDING_POOL],
  }) as bigint;

  if (allowance >= amount) return;

  // Approve max so user doesn't need to approve repeatedly
  const hash = await writeContractAsync({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CONTRACTS.LENDING_POOL, maxUint256],
  });
  await publicClient!.waitForTransactionReceipt({ hash });
}

// ─── useSupply ────────────────────────────────────────────────────────────────

export function useSupply() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const state = useTxState();

  const supply = useCallback(async (
    assetId: string,
    amount: number,
    userAddress: `0x${string}`,
  ) => {
    const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
    if (!tokenAddress || !PROTOCOL_CONFIGURED) throw new Error('Protocol not configured');

    state.setStatus('approving');
    state.setError(undefined);
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      await ensureAllowance(writeContractAsync, publicClient, tokenAddress, userAddress, amountWei);

      state.setStatus('pending');
      const hash = await writeContractAsync({
        address: CONTRACTS.LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: 'supply',
        args: [tokenAddress, amountWei],
      });
      state.setTxHash(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
      state.setStatus('success');
      return hash;
    } catch (e: any) {
      state.setStatus('error');
      state.setError(e?.shortMessage || e?.message || 'Transaction failed');
      throw e;
    }
  }, [writeContractAsync, publicClient]);

  return { supply, ...state };
}

// ─── useWithdraw ──────────────────────────────────────────────────────────────

export function useWithdraw() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const state = useTxState();

  const withdraw = useCallback(async (assetId: string, amount: number) => {
    const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
    if (!tokenAddress || !PROTOCOL_CONFIGURED) throw new Error('Protocol not configured');

    state.setStatus('pending');
    state.setError(undefined);
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      const hash = await writeContractAsync({
        address: CONTRACTS.LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: 'withdraw',
        args: [tokenAddress, amountWei],
      });
      state.setTxHash(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
      state.setStatus('success');
      return hash;
    } catch (e: any) {
      state.setStatus('error');
      state.setError(e?.shortMessage || e?.message || 'Transaction failed');
      throw e;
    }
  }, [writeContractAsync, publicClient]);

  return { withdraw, ...state };
}

// ─── useBorrow ────────────────────────────────────────────────────────────────

export function useBorrow() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const state = useTxState();

  const borrow = useCallback(async (assetId: string, amount: number) => {
    const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
    if (!tokenAddress || !PROTOCOL_CONFIGURED) throw new Error('Protocol not configured');

    state.setStatus('pending');
    state.setError(undefined);
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      const hash = await writeContractAsync({
        address: CONTRACTS.LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: 'borrow',
        args: [tokenAddress, amountWei],
      });
      state.setTxHash(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
      state.setStatus('success');
      return hash;
    } catch (e: any) {
      state.setStatus('error');
      state.setError(e?.shortMessage || e?.message || 'Transaction failed');
      throw e;
    }
  }, [writeContractAsync, publicClient]);

  return { borrow, ...state };
}

// ─── useRepay ─────────────────────────────────────────────────────────────────

export function useRepay() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const state = useTxState();

  const repay = useCallback(async (
    assetId: string,
    amount: number,
    userAddress: `0x${string}`,
  ) => {
    const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
    if (!tokenAddress || !PROTOCOL_CONFIGURED) throw new Error('Protocol not configured');

    state.setStatus('approving');
    state.setError(undefined);
    try {
      const amountWei = parseUnits(amount.toString(), 18);
      await ensureAllowance(writeContractAsync, publicClient, tokenAddress, userAddress, amountWei);

      state.setStatus('pending');
      const hash = await writeContractAsync({
        address: CONTRACTS.LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: 'repay',
        args: [tokenAddress, amountWei],
      });
      state.setTxHash(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
      state.setStatus('success');
      return hash;
    } catch (e: any) {
      state.setStatus('error');
      state.setError(e?.shortMessage || e?.message || 'Transaction failed');
      throw e;
    }
  }, [writeContractAsync, publicClient]);

  return { repay, ...state };
}

