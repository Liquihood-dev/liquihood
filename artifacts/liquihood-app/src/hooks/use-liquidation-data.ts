/**
 * use-liquidation-data.ts
 *
 * Fetches live liquidation data directly from Robinhood Chain via getLogs + multicall.
 * No indexer required — reads straight from the LendingPool contract events.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem, formatUnits } from 'viem';
import { CONTRACTS, ASSET_TOKEN_ADDRESS } from '@/lib/contracts';
import { LENDING_POOL_ABI } from '@/lib/abis';

// Reverse map: token address (lowercase) → asset ID
const ADDRESS_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ASSET_TOKEN_ADDRESS).map(([id, addr]) => [addr.toLowerCase(), id])
);

// Symbol lookup by asset ID
const ASSET_SYMBOLS: Record<string, string> = {
  'usd-g':  'USDG',
  'weth':   'WETH',
  'virtual':'VIRTUAL',
  'usde':   'USDe',
  'aapl':   'AAPL',
  'amzn':   'AMZN',
  'nvda':   'NVDA',
  'tsla':   'TSLA',
  'mstr':   'MSTR',
};

export interface LiquidationEvent {
  txHash: string;
  blockNumber: bigint;
  liquidator: string;
  borrower: string;
  debtAsset: string;
  collateralAsset: string;
  debtSymbol: string;
  collateralSymbol: string;
  debtRepaid: number;
  collateralSeized: number;
}

export interface AtRiskPosition {
  user: string;
  healthFactor: number;
  isLiquidatable: boolean;
}

export interface LiquidationData {
  loading: boolean;
  liquidationEvents: LiquidationEvent[];
  atRiskPositions: AtRiskPosition[];
  totalLiquidations: number;
  lastRefresh: number;
  refresh: () => void;
}

const RAY = 1e27;

function addrToSymbol(addr: string): string {
  const id = ADDRESS_TO_ID[addr.toLowerCase()];
  return id ? (ASSET_SYMBOLS[id] ?? id.toUpperCase()) : addr.slice(0, 6) + '…';
}

export function useLiquidationData(): LiquidationData {
  const publicClient = usePublicClient();

  const [state, setState] = useState<Omit<LiquidationData, 'refresh'>>({
    loading: true,
    liquidationEvents: [],
    atRiskPositions: [],
    totalLiquidations: 0,
    lastRefresh: 0,
  });

  const fetchAll = useCallback(async () => {
    if (!publicClient) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
      // ── 1. Liquidation events ───────────────────────────────────────────────
      const liquidationLogs = await publicClient.getLogs({
        address: CONTRACTS.LENDING_POOL,
        event: parseAbiItem(
          'event Liquidation(address indexed liquidator, address indexed borrower, address debtAsset, address collateralAsset, uint256 debtRepaid, uint256 collateralSeized)'
        ),
        fromBlock: 0n,
        toBlock: 'latest',
      });

      const liquidationEvents: LiquidationEvent[] = [...liquidationLogs]
        .reverse()
        .map(log => ({
          txHash:           log.transactionHash ?? '',
          blockNumber:      log.blockNumber     ?? 0n,
          liquidator:       (log.args.liquidator       as string) ?? '',
          borrower:         (log.args.borrower         as string) ?? '',
          debtAsset:        (log.args.debtAsset        as string) ?? '',
          collateralAsset:  (log.args.collateralAsset  as string) ?? '',
          debtSymbol:       addrToSymbol((log.args.debtAsset       as string) ?? ''),
          collateralSymbol: addrToSymbol((log.args.collateralAsset as string) ?? ''),
          debtRepaid:       parseFloat(formatUnits((log.args.debtRepaid       as bigint) ?? 0n, 18)),
          collateralSeized: parseFloat(formatUnits((log.args.collateralSeized as bigint) ?? 0n, 18)),
        }));

      // ── 2. Collect active users from Supply + Borrow events ─────────────────
      const [supplyLogs, borrowLogs] = await Promise.all([
        publicClient.getLogs({
          address: CONTRACTS.LENDING_POOL,
          event: parseAbiItem('event Supply(address indexed user, address indexed asset, uint256 amount)'),
          fromBlock: 0n,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: CONTRACTS.LENDING_POOL,
          event: parseAbiItem('event Borrow(address indexed user, address indexed asset, uint256 amount)'),
          fromBlock: 0n,
          toBlock: 'latest',
        }),
      ]);

      const userSet = new Set<string>();
      [...supplyLogs, ...borrowLogs].forEach(log => {
        if (log.args.user) userSet.add((log.args.user as string).toLowerCase());
      });
      const users = [...userSet];

      // ── 3. Health factor for all active users (individual calls — chain has no multicall3) ──
      const atRisk: AtRiskPosition[] = [];

      if (users.length > 0) {
        const hfResults = await Promise.all(
          users.map(user =>
            publicClient.readContract({
              address: CONTRACTS.LENDING_POOL as `0x${string}`,
              abi: LENDING_POOL_ABI,
              functionName: 'getHealthFactor',
              args: [user as `0x${string}`],
            }).catch(() => null)
          )
        );

        users.forEach((user, i) => {
          const result = hfResults[i];
          if (result == null) return;
          const raw = Number(result as bigint) / RAY;
          if (raw <= 0) return;
          const hf = raw > 1_000_000 ? Infinity : raw;
          if (hf < 2.0) {
            atRisk.push({ user, healthFactor: hf, isLiquidatable: hf < 1.0 });
          }
        });

        atRisk.sort((a, b) => a.healthFactor - b.healthFactor);
      }

      setState({
        loading: false,
        liquidationEvents,
        atRiskPositions: atRisk,
        totalLiquidations: liquidationLogs.length,
        lastRefresh: Date.now(),
      });
    } catch (err) {
      console.error('[useLiquidationData]', err);
      setState(prev => ({ ...prev, loading: false, lastRefresh: Date.now() }));
    }
  }, [publicClient]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { ...state, refresh: fetchAll };
}
