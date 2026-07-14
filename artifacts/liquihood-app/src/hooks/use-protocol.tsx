/**
 * use-protocol.tsx
 *
 * Protocol context — ALL state sourced from Robinhood Chain contracts.
 *
 * Real on-chain (wagmi):
 *   • User positions      → useAllOnChainPositions  (getUserCollateral / getUserDebt batch)
 *   • Reserve stats       → useAllReserveStats       (getReserveStats batch → TVL, borrowed, utilization)
 *   • Health factor       → useOnChainHealthFactor   (getHealthFactor)
 *   • Asset prices        → CoinGecko + Yahoo Finance via API server (60 s interval)
 *
 * Still in localStorage (no on-chain event indexer needed):
 *   • Transaction history  (tx hashes + metadata)
 *   • Notifications
 *   • Per-wallet collateral toggle preferences
 */

import React, {
  createContext, useContext, useState, useEffect,
  useMemo, useCallback, useRef,
} from 'react';
import { useAccount, useDisconnect, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import {
  MarketState, UserPosition, Transaction, INITIAL_ASSETS,
} from '../lib/protocol';
import { fetchLivePrices } from '../lib/prices';
import { checkMarketOpen } from '../lib/utils';
import { toast } from '@/hooks/use-toast';
import { CONTRACTS, ASSET_TOKEN_ADDRESS, PROTOCOL_CONFIGURED } from '@/lib/contracts';
import { LENDING_POOL_ABI, ERC20_ABI } from '@/lib/abis';
import {
  useAllOnChainPositions,
  useAllReserveStats,
} from './use-on-chain-data';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: number;
  read: boolean;
}

interface ProtocolState {
  assets: MarketState[];
  positions: UserPosition[];
  transactions: Transaction[];
  notifications: Notification[];
  walletAddress: string | null;
  marketOverride: 'open' | 'closed' | undefined;
  isMarketOpen: boolean;
  pricesUpdatedAt: number;
  /** true while initial chain position read is in flight */
  isLoadingPositions: boolean;
  showConnectModal: boolean;
  /** $LHOOD governance token live price */
  lhoodPrice: number;
  lhoodChange24h: number;
  setShowConnectModal: (v: boolean) => void;
  connectWallet: () => void;
  disconnectWallet: () => void;
  setMarketOverride: (o: 'open' | 'closed' | undefined) => void;
  executeTransaction: (tx: Omit<Transaction, 'id' | 'timestamp' | 'status' | 'resultingHf'>) => Promise<void>;
  /** Withdraw ALL collateral positions using exact on-chain bigint amounts */
  withdrawAll: () => Promise<void>;
  /** UI-side HF preview for a proposed action (uses live price + real positions) */
  simulateHf: (assetId: string, amount: number, type: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay', isolated?: boolean) => number;
  toggleCollateral: (assetId: string) => void;
  markNotificationRead: (id: string) => void;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

type StorageKind = 'transactions' | 'notifications' | 'collateralPrefs';

function storageKey(wallet: string, kind: StorageKind) {
  return `liquihood_${kind}_${wallet.toLowerCase()}`;
}
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}
function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProtocolContext = createContext<ProtocolState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAccount();
  const { disconnect }           = useDisconnect();
  const { writeContractAsync }   = useWriteContract();
  const publicClient             = usePublicClient();

  // ── Asset list (metadata) — seeded from constants, updated with live data ──
  const [assets, setAssets]     = useState<MarketState[]>(INITIAL_ASSETS);
  const assetsRef               = useRef<MarketState[]>(INITIAL_ASSETS);
  useEffect(() => { assetsRef.current = assets; }, [assets]);

  const [lhoodPrice, setLhoodPrice]       = useState(0.10);
  const [lhoodChange24h, setLhoodChange24h] = useState(0);

  // ── localStorage-backed state ──────────────────────────────────────────────
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // collateralPrefs: per-wallet, per-asset toggle stored in localStorage
  const [collateralPrefs, setCollateralPrefs] = useState<Record<string, boolean>>({});

  // ── UI state ───────────────────────────────────────────────────────────────
  const [marketOverride, setMarketOverride]   = useState<'open' | 'closed' | undefined>();
  const [isMarketOpen, setIsMarketOpen]       = useState(() => checkMarketOpen());
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState(0);

  const walletAddress = isConnected ? (address ?? null) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL ON-CHAIN READS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── User positions from chain (getUserCollateral + getUserDebt batch) ──────
  const {
    positions: chainPositions,
    isLoading: isLoadingPositions,
    refetch:   refetchPositions,
  } = useAllOnChainPositions(walletAddress as `0x${string}` | undefined);

  // ── Reserve stats from chain (getReserveStats batch) → TVL, borrowings ────
  const { stats: reserveStats, refetch: refetchStats } = useAllReserveStats();

  // ── Apply real reserve stats to assets whenever chain data arrives ─────────
  useEffect(() => {
    if (Object.keys(reserveStats).length === 0) return;
    setAssets(prev => prev.map(a => {
      const s = reserveStats[a.id];
      if (!s) return a;
      return { ...a, totalSupplied: s.totalSupplied, totalBorrowed: s.totalBorrowed };
    }));
  }, [reserveStats]);

  // ── Merge collateral preferences into chain positions ─────────────────────
  // Chain gives us raw amounts; localStorage stores the user's toggle choice.
  const positions: UserPosition[] = useMemo(() =>
    chainPositions.map(p => ({
      ...p,
      useAsCollateral: collateralPrefs[p.assetId] ?? true,
    })),
    [chainPositions, collateralPrefs],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE PRICES (real-time from API server → CoinGecko + Yahoo Finance)
  // ═══════════════════════════════════════════════════════════════════════════

  const applyPrices = useCallback((livePrices: {
    prices: Record<string, number>;
    change24h: Record<string, number>;
    updatedAt: number;
  }) => {
    setAssets(prev => prev.map(a => {
      const p = livePrices.prices[a.id];
      const c = livePrices.change24h[a.id];
      return {
        ...a,
        priceUsd:       typeof p === 'number' && p > 0    ? p : a.priceUsd,
        priceChange24h: typeof c === 'number' && isFinite(c) ? c : a.priceChange24h,
      };
    }));
    const lp = livePrices.prices['lhood'];
    const lc = livePrices.change24h['lhood'];
    if (typeof lp === 'number' && lp > 0) setLhoodPrice(lp);
    if (typeof lc === 'number' && isFinite(lc)) setLhoodChange24h(lc);
    setPricesUpdatedAt(livePrices.updatedAt || Date.now());
  }, []);

  useEffect(() => {
    fetchLivePrices().then(applyPrices);
    const id = setInterval(() => fetchLivePrices().then(applyPrices), 60_000);
    return () => clearInterval(id);
  }, [applyPrices]);

  // ═══════════════════════════════════════════════════════════════════════════
  // WALLET CONNECT / DISCONNECT
  // ═══════════════════════════════════════════════════════════════════════════

  const prevAddress = useRef<string | null>(null);

  useEffect(() => {
    if (walletAddress && walletAddress !== prevAddress.current) {
      // Load per-wallet non-chain state from localStorage
      const savedTxs   = loadFromStorage<Transaction[]>(storageKey(walletAddress, 'transactions'), []);
      const savedNots  = loadFromStorage<Notification[]>(storageKey(walletAddress, 'notifications'), []);
      const savedPrefs = loadFromStorage<Record<string, boolean>>(storageKey(walletAddress, 'collateralPrefs'), {});
      setTransactions(savedTxs);
      setNotifications(savedNots);
      setCollateralPrefs(savedPrefs);
      prevAddress.current = walletAddress;
      setShowConnectModal(false);
      toast({
        title: 'Wallet connected',
        description: `${walletAddress.substring(0, 6)}…${walletAddress.slice(-4)} on Robinhood Chain.`,
      });
    }
    if (!walletAddress && prevAddress.current) {
      setTransactions([]);
      setNotifications([]);
      setCollateralPrefs({});
      prevAddress.current = null;
    }
  }, [walletAddress]);

  // Persist non-chain state to localStorage
  useEffect(() => {
    if (walletAddress) saveToStorage(storageKey(walletAddress, 'transactions'), transactions);
  }, [transactions, walletAddress]);
  useEffect(() => {
    if (walletAddress) saveToStorage(storageKey(walletAddress, 'notifications'), notifications);
  }, [notifications, walletAddress]);
  useEffect(() => {
    if (walletAddress) saveToStorage(storageKey(walletAddress, 'collateralPrefs'), collateralPrefs);
  }, [collateralPrefs, walletAddress]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET HOURS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    setIsMarketOpen(checkMarketOpen(marketOverride));
    const id = setInterval(() => setIsMarketOpen(checkMarketOpen(marketOverride)), 30_000);
    return () => clearInterval(id);
  }, [marketOverride]);

  const connectWallet    = useCallback(() => setShowConnectModal(true), []);
  const disconnectWallet = useCallback(() => {
    disconnect();
    setTransactions([]);
    setNotifications([]);
    setCollateralPrefs({});
  }, [disconnect]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH FACTOR SIMULATION
  // Used for UI preview (shows projected HF before the user confirms a tx).
  // Bases the projection on real on-chain positions + live prices.
  // ═══════════════════════════════════════════════════════════════════════════

  const calculateHf = useCallback((
    currentPositions: UserPosition[],
    currentAssets: MarketState[],
    marketOpen: boolean,
    isolated = false,
  ): number => {
    let collateral = 0, debt = 0;
    currentPositions.forEach(p => {
      const asset = currentAssets.find(a => a.id === p.assetId);
      if (!asset || asset.isolated !== isolated) return;
      if (p.useAsCollateral && p.supplied > 0) {
        const valid = !asset.isEquity || marketOpen;
        if (valid) collateral += p.supplied * asset.priceUsd * asset.liquidationThreshold;
      }
      if (p.borrowed > 0) debt += p.borrowed * asset.priceUsd;
    });
    return debt === 0 ? 999 : collateral / debt;
  }, []);

  const simulateHf = useCallback((
    assetId: string,
    amount: number,
    type: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay',
    isolated = false,
  ): number => {
    // Clone real on-chain positions, apply proposed change, compute HF
    const sim = positions.map(p => ({ ...p }));
    const idx = sim.findIndex(p => p.assetId === assetId);
    if (idx >= 0) {
      if (type === 'Supply')   sim[idx].supplied += amount;
      if (type === 'Withdraw') sim[idx].supplied  = Math.max(0, sim[idx].supplied - amount);
      if (type === 'Borrow')   sim[idx].borrowed += amount;
      if (type === 'Repay')    sim[idx].borrowed  = Math.max(0, sim[idx].borrowed - amount);
    } else {
      sim.push({
        assetId,
        supplied:        type === 'Supply' ? amount : 0,
        borrowed:        type === 'Borrow' ? amount : 0,
        useAsCollateral: true,
      });
    }
    return calculateHf(sim, assets, isMarketOpen, isolated);
  }, [positions, assets, isMarketOpen, calculateHf]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLATERAL TOGGLE
  // Stored in localStorage per-wallet; merged into chain positions.
  // ═══════════════════════════════════════════════════════════════════════════

  const toggleCollateral = useCallback((assetId: string) => {
    setCollateralPrefs(prev => ({
      ...prev,
      [assetId]: !(prev[assetId] ?? true),
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTE TRANSACTION — real on-chain when protocol is configured
  // ═══════════════════════════════════════════════════════════════════════════

  const executeTransaction = useCallback(async (
    tx: Omit<Transaction, 'id' | 'timestamp' | 'status' | 'resultingHf'>
  ) => {
    if (!walletAddress) {
      toast({ title: 'Wallet not connected', description: 'Connect your wallet before transacting.' });
      return;
    }

    const tokenAddress = ASSET_TOKEN_ADDRESS[tx.assetId];
    const asset        = assetsRef.current.find(a => a.id === tx.assetId);
    const isolated     = asset?.isolated ?? false;
    const simType      = tx.type === 'Liquidation' ? 'Repay' : tx.type as 'Supply' | 'Withdraw' | 'Borrow' | 'Repay';

    // ── REAL on-chain path ────────────────────────────────────────────────────
    if (PROTOCOL_CONFIGURED && tokenAddress && publicClient) {
      // Compute projected HF before tx (for transaction record)
      const predictedHf = simulateHf(tx.assetId, tx.amount, simType, isolated);

      try {
        const amountWei = parseUnits(tx.amount.toFixed(18), 18);
        let txHash: `0x${string}`;

        if (tx.type === 'Supply') {
          const allowance = await publicClient.readContract({
            address: tokenAddress, abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress as `0x${string}`, CONTRACTS.LENDING_POOL],
          }) as bigint;
          if (allowance < amountWei) {
            toast({ title: 'Approve token', description: 'Approving token transfer…' });
            const approveHash = await writeContractAsync({
              address: tokenAddress, abi: ERC20_ABI,
              functionName: 'approve', args: [CONTRACTS.LENDING_POOL, maxUint256],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
          txHash = await writeContractAsync({
            address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
            functionName: 'supply', args: [tokenAddress, amountWei],
          });

        } else if (tx.type === 'Borrow') {
          txHash = await writeContractAsync({
            address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
            functionName: 'borrow', args: [tokenAddress, amountWei],
          });

        } else if (tx.type === 'Repay') {
          const allowance = await publicClient.readContract({
            address: tokenAddress, abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress as `0x${string}`, CONTRACTS.LENDING_POOL],
          }) as bigint;
          if (allowance < amountWei) {
            toast({ title: 'Approve token', description: 'Approving repayment…' });
            const approveHash = await writeContractAsync({
              address: tokenAddress, abi: ERC20_ABI,
              functionName: 'approve', args: [CONTRACTS.LENDING_POOL, maxUint256],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
          txHash = await writeContractAsync({
            address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
            functionName: 'repay', args: [tokenAddress, amountWei],
          });

        } else {
          // Withdraw — query exact bigint from chain to avoid float precision mismatch
          const exactOnChain = await publicClient.readContract({
            address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
            functionName: 'getUserCollateral',
            args: [walletAddress as `0x${string}`, tokenAddress],
          }) as bigint;
          // If user typed "max", use exact chain amount; otherwise use their amount
          const useAmount = amountWei >= exactOnChain ? exactOnChain : amountWei;
          txHash = await writeContractAsync({
            address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
            functionName: 'withdraw', args: [tokenAddress, useAmount],
          });
        }

        // Wait for on-chain confirmation
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        // ── Refetch from chain — positions + reserve stats update ────────────
        // Both refetches are fire-and-forget; wagmi will update React state
        // via its query cache and trigger a re-render when data arrives.
        void refetchPositions();
        void refetchStats();

        const newTx: Transaction = {
          ...tx,
          id:          txHash,
          timestamp:   Date.now(),
          status:      'Completed',
          resultingHf: predictedHf,
        };
        setTransactions(prev => [newTx, ...prev]);
        toast({
          title:       `${tx.type} Confirmed`,
          description: `Tx: ${txHash.slice(0, 10)}… on Robinhood Chain`,
        });
        return;

      } catch (e: any) {
        const msg = e?.shortMessage || e?.message || 'Transaction failed';
        toast({ title: 'Transaction Failed', description: msg, variant: 'destructive' });
        throw e;
      }
    }

    // ── Simulation fallback (PROTOCOL_CONFIGURED = false — no contracts yet) ─
    await new Promise(r => setTimeout(r, 1500));
    const newHf = simulateHf(tx.assetId, tx.amount, simType, isolated);
    const newTx: Transaction = {
      ...tx,
      id:          Math.random().toString(36).substring(7),
      timestamp:   Date.now(),
      status:      'Completed',
      resultingHf: newHf,
    };
    setTransactions(prev => [newTx, ...prev]);
    toast({
      title:       `${tx.type} Successful`,
      description: `${tx.amount} ${assetsRef.current.find(a => a.id === tx.assetId)?.symbol}`,
    });
  }, [
    walletAddress, simulateHf, writeContractAsync,
    publicClient, refetchPositions, refetchStats,
  ]);

  // ─────────────────────────────────────────────────────────────────────────

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // WITHDRAW ALL — reads exact bigint from chain before each withdraw
  // No float conversion → no precision mismatch → no revert
  // ═══════════════════════════════════════════════════════════════════════════

  const withdrawAll = useCallback(async () => {
    if (!walletAddress || !publicClient || !PROTOCOL_CONFIGURED) return;

    const current = assetsRef.current;
    const withSupply = chainPositions.filter(p => p.supplied > 0);

    for (const p of withSupply) {
      const tokenAddress = ASSET_TOKEN_ADDRESS[p.assetId];
      if (!tokenAddress) continue;

      try {
        // Read exact on-chain bigint — avoids float→wei conversion errors
        const exactBalance = await publicClient.readContract({
          address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
          functionName: 'getUserCollateral',
          args: [walletAddress as `0x${string}`, tokenAddress],
        }) as bigint;

        if (exactBalance === 0n) continue;

        const symbol = current.find(a => a.id === p.assetId)?.symbol ?? p.assetId;
        toast({ title: `Withdrawing ${symbol}…`, description: 'Sign the transaction in your wallet.' });

        const hash = await writeContractAsync({
          address: CONTRACTS.LENDING_POOL, abi: LENDING_POOL_ABI,
          functionName: 'withdraw', args: [tokenAddress, exactBalance],
        });

        await publicClient.waitForTransactionReceipt({ hash });
        toast({ title: `${symbol} withdrawn`, description: `Tx: ${hash.slice(0, 10)}…` });

      } catch (e: any) {
        const sym = current.find(a => a.id === p.assetId)?.symbol ?? p.assetId;
        toast({
          title: `${sym} withdraw failed`,
          description: e?.shortMessage || e?.message || 'Transaction rejected',
          variant: 'destructive',
        });
        // Continue to next asset instead of aborting
      }
    }

    void refetchPositions();
    void refetchStats();
  }, [walletAddress, publicClient, writeContractAsync, chainPositions, refetchPositions, refetchStats]);

  const value = useMemo<ProtocolState>(() => ({
    assets, positions, transactions, notifications,
    walletAddress, marketOverride, isMarketOpen, pricesUpdatedAt, isLoadingPositions,
    lhoodPrice, lhoodChange24h,
    showConnectModal, setShowConnectModal,
    connectWallet, disconnectWallet, setMarketOverride,
    executeTransaction, withdrawAll, simulateHf, toggleCollateral, markNotificationRead,
  }), [
    assets, positions, transactions, notifications,
    walletAddress, marketOverride, isMarketOpen, pricesUpdatedAt, isLoadingPositions,
    lhoodPrice, lhoodChange24h,
    showConnectModal,
    connectWallet, disconnectWallet, setMarketOverride,
    executeTransaction, withdrawAll, simulateHf, toggleCollateral, markNotificationRead,
  ]);

  return <ProtocolContext.Provider value={value}>{children}</ProtocolContext.Provider>;
};

// ─────────────────────────────────────────────────────────────────────────────

export const useProtocol = () => {
  const ctx = useContext(ProtocolContext);
  if (!ctx) throw new Error('useProtocol must be inside ProtocolProvider');
  return ctx;
};
