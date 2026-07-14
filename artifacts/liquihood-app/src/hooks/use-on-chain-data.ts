/**
 * use-on-chain-data.ts
 *
 * Wagmi hooks that read REAL on-chain state from Robinhood Chain.
 * All user positions, reserve stats, balances, and health factors
 * come directly from the deployed contracts — no mock data.
 */

import { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, ASSET_TOKEN_ADDRESS, PROTOCOL_CONFIGURED, REAL_MARKET_IDS, LHOOD_TOKEN } from '@/lib/contracts';
import { LENDING_POOL_ABI, ERC20_ABI } from '@/lib/abis';
import { formatUnits } from 'viem';
import type { UserPosition } from '@/lib/protocol';

const LENDING_POOL = { address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI } as const;

// ─── Asset IDs in stable order ────────────────────────────────────────────────
// Derived once at module level — ASSET_TOKEN_ADDRESS is a compile-time constant.
const ASSET_IDS = Object.keys(ASSET_TOKEN_ADDRESS);

// ─── Wallet token balance ─────────────────────────────────────────────────────

export function useWalletTokenBalance(assetId: string, userAddress?: `0x${string}`) {
  const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
  const enabled = !!tokenAddress && !!userAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled, refetchInterval: 10_000 },
  });

  return {
    balance: data != null ? parseFloat(formatUnits(data as bigint, 18)) : null,
    isLoading,
    refetch,
  };
}

// ─── Single asset: user position (on-chain) ───────────────────────────────────

export function useOnChainPosition(assetId: string, userAddress?: `0x${string}`) {
  const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
  const enabled = !!tokenAddress && !!userAddress && PROTOCOL_CONFIGURED;

  const { data: collateral, refetch: refetchCol } = useReadContract({
    ...LENDING_POOL,
    functionName: 'getUserCollateral',
    args: userAddress && tokenAddress ? [userAddress, tokenAddress] : undefined,
    query: { enabled, refetchInterval: 10_000 },
  });

  const { data: debt, refetch: refetchDebt } = useReadContract({
    ...LENDING_POOL,
    functionName: 'getUserDebt',
    args: userAddress && tokenAddress ? [userAddress, tokenAddress] : undefined,
    query: { enabled, refetchInterval: 10_000 },
  });

  return {
    supplied: collateral ? parseFloat(formatUnits(collateral as bigint, 18)) : null,
    borrowed:  debt      ? parseFloat(formatUnits(debt      as bigint, 18)) : null,
    refetch: () => { refetchCol(); refetchDebt(); },
  };
}

// ─── ALL user positions (batched — single multicall) ─────────────────────────
// Replaces localStorage-backed positions in use-protocol.tsx.
// Returns a UserPosition[] with only assets that have non-zero balance.

export function useAllOnChainPositions(userAddress?: `0x${string}`) {
  const enabled = !!userAddress && ASSET_IDS.length > 0 && PROTOCOL_CONFIGURED;

  // Interleave getUserCollateral + getUserDebt for each asset in one batch
  const contracts = useMemo(() => {
    if (!userAddress) return [];
    return ASSET_IDS.flatMap(id => [
      {
        ...LENDING_POOL,
        functionName: 'getUserCollateral' as const,
        args: [userAddress, ASSET_TOKEN_ADDRESS[id]] as [`0x${string}`, `0x${string}`],
      },
      {
        ...LENDING_POOL,
        functionName: 'getUserDebt' as const,
        args: [userAddress, ASSET_TOKEN_ADDRESS[id]] as [`0x${string}`, `0x${string}`],
      },
    ]);
  }, [userAddress]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    query: { enabled, refetchInterval: 8_000 },
  });

  const positions = useMemo((): UserPosition[] => {
    if (!data) return [];
    return ASSET_IDS.flatMap((id, i) => {
      const colResult  = data[i * 2];
      const debtResult = data[i * 2 + 1];
      const supplied = colResult?.status === 'success' && colResult.result != null
        ? parseFloat(formatUnits(colResult.result as bigint, 18)) : 0;
      const borrowed = debtResult?.status === 'success' && debtResult.result != null
        ? parseFloat(formatUnits(debtResult.result as bigint, 18)) : 0;
      // Skip zero positions (no on-chain activity for this asset)
      if (supplied === 0 && borrowed === 0) return [];
      return [{ assetId: id, supplied, borrowed, useAsCollateral: true }];
    });
  }, [data]);

  return {
    positions,
    isLoading: enabled && isLoading,
    refetch,
  };
}

// ─── Health factor (on-chain) ─────────────────────────────────────────────────

export function useOnChainHealthFactor(userAddress?: `0x${string}`) {
  const { data, refetch } = useReadContract({
    ...LENDING_POOL,
    functionName: 'getHealthFactor',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress && PROTOCOL_CONFIGURED, refetchInterval: 10_000 },
  });

  // Contract returns health factor in ray (1e27 = 1.0). Convert to float.
  const RAY = 1e27;
  const hf  = data ? Number(data as bigint) / RAY : null;

  return {
    healthFactor: hf === null ? null : hf > 1e6 ? Infinity : hf,
    refetch,
  };
}

// ─── Single asset reserve stats (on-chain) ────────────────────────────────────

export function useOnChainReserveStats(assetId: string) {
  const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
  const enabled = !!tokenAddress && PROTOCOL_CONFIGURED;

  const { data, refetch } = useReadContract({
    ...LENDING_POOL,
    functionName: 'getReserveStats',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled, refetchInterval: 15_000 },
  });

  if (!data) return { totalSupplied: null, totalBorrowed: null, utilization: null, refetch };

  const [totalLiq, totalDebt, utilRay] = data as [bigint, bigint, bigint];
  const RAY = 1e27;

  return {
    totalSupplied: parseFloat(formatUnits(totalLiq, 18)),
    totalBorrowed: parseFloat(formatUnits(totalDebt, 18)),
    utilization:   Number(utilRay) / RAY,
    refetch,
  };
}

// ─── ALL reserve stats (batched — single multicall) ───────────────────────────
// Returns a map of assetId → { totalSupplied, totalBorrowed, utilization }.
// Drives real TVL, Total Borrowed, and APY/APR on the Markets page.

export function useAllReserveStats() {
  const enabled = ASSET_IDS.length > 0 && PROTOCOL_CONFIGURED;

  const contracts = useMemo(() => ASSET_IDS.map(id => ({
    ...LENDING_POOL,
    functionName: 'getReserveStats' as const,
    args: [ASSET_TOKEN_ADDRESS[id]] as [`0x${string}`],
  })), []);

  const { data, refetch } = useReadContracts({
    contracts,
    query: { enabled, refetchInterval: 15_000 },
  });

  const stats = useMemo(() => {
    const out: Record<string, { totalSupplied: number; rawTotalSupplied: number; totalBorrowed: number; utilization: number }> = {};
    if (!data) return out;
    const RAY = 1e27;
    ASSET_IDS.forEach((id, i) => {
      const r = data[i];
      if (r?.status === 'success' && r.result != null) {
        const [liq, debt, utilRay] = r.result as [bigint, bigint, bigint];
        // totalSupplied for custom-token markets (e.g. USDG) reflects deployer
        // seed liquidity only — hide it from TVL to avoid misleading display.
        // totalBorrowed is ALWAYS real user activity — never suppress it.
        const isReal = REAL_MARKET_IDS.has(id);
        const rawSupplied = parseFloat(formatUnits(liq, 18));
        const supplied = isReal ? rawSupplied : 0;
        const borrowed = parseFloat(formatUnits(debt, 18)); // always real
        out[id] = {
          totalSupplied:    supplied,
          rawTotalSupplied: rawSupplied, // unfiltered — use for solvency checks only
          totalBorrowed:    borrowed,
          utilization:      Number(utilRay) / RAY,
        };
      }
    });
    return out;
  }, [data]);

  return { stats, refetch };
}

// ─── ERC-20 allowance check ───────────────────────────────────────────────────

export function useTokenAllowance(
  assetId: string,
  userAddress?: `0x${string}`,
  spender?: `0x${string}`,
) {
  const tokenAddress = ASSET_TOKEN_ADDRESS[assetId];
  const enabled = !!tokenAddress && !!userAddress && !!spender;

  const { data, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && spender ? [userAddress, spender] : undefined,
    query: { enabled, refetchInterval: 5_000 },
  });

  return {
    allowance: data ? (data as bigint) : 0n,
    refetch,
  };
}

// ─── All asset wallet balances (batch) ───────────────────────────────────────

export function useAllWalletBalances(userAddress?: `0x${string}`) {
  const enabled = !!userAddress && ASSET_IDS.length > 0;

  const contracts = useMemo(() => ASSET_IDS.map(id => ({
    address: ASSET_TOKEN_ADDRESS[id],
    abi: ERC20_ABI,
    functionName: 'balanceOf' as const,
    args: [userAddress!] as [`0x${string}`],
  })), [userAddress]);

  const { data, refetch } = useReadContracts({
    contracts,
    query: { enabled, refetchInterval: 10_000 },
  });

  const balances: Record<string, number> = {};
  if (data) {
    ASSET_IDS.forEach((id, i) => {
      const result = data[i];
      if (result?.status === 'success' && result.result != null) {
        balances[id] = parseFloat(formatUnits(result.result as bigint, 18));
      } else {
        balances[id] = 0;
      }
    });
  }

  return { balances, refetch };
}

// ─── $LHOOD governance token balance ──────────────────────────────────────────

export function useLHOODBalance(userAddress?: `0x${string}`) {
  const { data } = useReadContract({
    address: LHOOD_TOKEN,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: 15_000 },
  });
  return data != null ? parseFloat(formatUnits(data as bigint, 18)) : null;
}

export function useLHOODTotalSupply() {
  const { data } = useReadContract({
    address: LHOOD_TOKEN,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    query: { refetchInterval: 60_000 },
  });
  return data != null ? parseFloat(formatUnits(data as bigint, 18)) : null;
}
