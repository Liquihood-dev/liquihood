import React, { useState, useMemo, useCallback } from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatUsd, formatPercent, formatToken } from '@/lib/utils';
import { ActionModal } from '@/components/shared/ActionModal';
import { RiskSimulatorDrawer } from '@/components/shared/RiskSimulatorDrawer';
import { PositionAlertPanel, PnLBadge } from '@/components/shared/PositionAlertPanel';
import {
  Wallet, Info, TrendingDown, FlaskConical,
  ArrowDownToLine, ArrowUpFromLine,
  Banknote, Plus, ChevronRight, ArrowRight, CornerUpLeft, ShieldPlus,
  LayoutDashboard, Coins, TrendingUp, Loader2, LogOut,
} from 'lucide-react';
import { AssetIcon } from '@/components/shared/AssetIcon';
import { calculateRates } from '@/lib/protocol';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SparklineChart } from '@/components/shared/SparklineChart';
import { Link } from 'wouter';

export default function DashboardPage() {
  const {
    positions, assets, walletAddress, connectWallet,
    isMarketOpen, transactions, toggleCollateral, isLoadingPositions, withdrawAll,
  } = useProtocol();

  const [modal, setModal]              = useState<{ assetId: string; type: any } | null>(null);
  const [riskOpen, setRiskOpen]        = useState(false);
  const [isWithdrawingAll, setIsWithdrawingAll] = useState(false);
  const [confirmWithdrawAll, setConfirmWithdrawAll] = useState(false);

  const handleWithdrawAll = useCallback(async () => {
    if (!confirmWithdrawAll) { setConfirmWithdrawAll(true); return; }
    setIsWithdrawingAll(true);
    setConfirmWithdrawAll(false);
    try { await withdrawAll(); } finally { setIsWithdrawingAll(false); }
  }, [confirmWithdrawAll, withdrawAll]);

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const { totalCollateral, totalDebt, totalNetWorth, availableBorrow, hf } = useMemo(() => {
    let collLiqThreshold = 0, collLtv = 0, debt = 0;
    positions.forEach(p => {
      const a = assets.find(x => x.id === p.assetId);
      if (!a || a.isolated) return;
      if (p.supplied > 0 && p.useAsCollateral) {
        const valid = !a.isEquity || isMarketOpen;
        if (valid) {
          collLiqThreshold += p.supplied * a.priceUsd * a.liquidationThreshold;
          collLtv          += p.supplied * a.priceUsd * a.ltv;
        }
      }
      if (p.borrowed > 0) debt += p.borrowed * a.priceUsd;
    });
    const hf    = debt === 0 ? 999 : collLiqThreshold / debt;
    const avail = Math.max(0, collLtv - debt);
    const netWorth = positions.reduce((s, p) => {
      const a = assets.find(x => x.id === p.assetId);
      if (!a) return s;
      return s + p.supplied * a.priceUsd - p.borrowed * a.priceUsd;
    }, 0);
    return { totalCollateral: collLiqThreshold, totalDebt: debt, totalNetWorth: netWorth, availableBorrow: avail, hf };
  }, [positions, assets, isMarketOpen]);

  // HF sparkline — only real confirmed txs (0x hash)
  const sparkData = useMemo(() => {
    const realTxs = transactions.filter(t => t.id.startsWith('0x') && t.resultingHf < 900);
    if (realTxs.length === 0) return [];
    const sorted = [...realTxs].sort((a, b) => a.timestamp - b.timestamp);
    const pts: { day: number; hf: number }[] = [];
    for (let i = 0; i <= 30; i++) {
      const dayTs = Date.now() - (30 - i) * 86_400_000;
      const latest = sorted.filter(t => t.timestamp <= dayTs);
      if (latest.length > 0) pts.push({ day: i, hf: Math.min(latest[latest.length - 1].resultingHf, 2.5) });
    }
    return pts;
  }, [transactions]);

  // Interest earned — only when a real Supply tx exists
  const interestByAsset = useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach(p => {
      const assetTxs    = transactions.filter(t => t.assetId === p.assetId && t.id.startsWith('0x'));
      const hasSupplyTx = assetTxs.some(t => t.type === 'Supply');
      if (!hasSupplyTx) { map[p.assetId] = 0; return; }
      const netDep = assetTxs.reduce((acc, t) => {
        if (t.type === 'Supply')   return acc + t.amount;
        if (t.type === 'Withdraw') return acc - t.amount;
        return acc;
      }, 0);
      map[p.assetId] = Math.max(0, p.supplied - netDep);
    });
    return map;
  }, [positions, transactions]);

  const getHfColor = (h: number) => {
    if (h > 99 || h >= 2) return 'text-primary';
    if (h >= 1.3) return 'text-primary/80';
    if (h > 1.0)  return 'text-yellow-400';
    return 'text-destructive';
  };
  const getHfStroke = (h: number) => {
    if (h >= 2)   return '#D0EF19';
    if (h >= 1.3) return '#A8C200';
    if (h > 1.0)  return '#FFB224';
    return '#FF4D4D';
  };

  const USD_DUST = 0.01;
  const isActivePos = (p: { supplied: number; borrowed: number; assetId: string }) => {
    const a = assets.find(x => x.id === p.assetId);
    if (!a) return false;
    return p.supplied * a.priceUsd > USD_DUST || p.borrowed * a.priceUsd > USD_DUST;
  };
  const activePositions   = positions.filter(isActivePos);
  const mainPositions     = activePositions.filter(p => !assets.find(a => a.id === p.assetId)?.isolated);
  const collateralPos     = mainPositions.filter(p => {
    const a = assets.find(x => x.id === p.assetId);
    return a ? p.supplied * a.priceUsd > USD_DUST : false;
  });
  const borrowPos         = mainPositions.filter(p => {
    const a = assets.find(x => x.id === p.assetId);
    return a ? p.borrowed * a.priceUsd > USD_DUST : false;
  });
  const isolatedPositions = activePositions.filter(p => assets.find(a => a.id === p.assetId)?.isolated);

  // ── Guard: no wallet ──────────────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <Wallet className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-3xl font-bold tracking-tight">Connect your wallet</h1>
          <p className="text-muted-foreground">Access your decentralized credit line, supply assets, and monitor your Health Factor on Robinhood Chain.</p>
        </div>
        <Button onClick={connectWallet} size="lg" className="text-lg h-12 px-8 bg-primary text-black hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(208,239,25,0.3)] gap-2">
          <Wallet className="h-5 w-5" /> Connect Wallet
        </Button>
      </div>
    );
  }

  // ── Guard: loading from chain ─────────────────────────────────────────────────
  if (isLoadingPositions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 animate-pulse">
          <LayoutDashboard className="h-7 w-7 text-primary" />
        </div>
        <p className="text-muted-foreground text-sm">Loading your positions from Robinhood Chain…</p>
      </div>
    );
  }

  // ── Guard: no positions yet ───────────────────────────────────────────────────
  if (activePositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <LayoutDashboard className="h-9 w-9 text-primary/60" />
        </div>
        <div className="space-y-2 max-w-lg">
          <h1 className="text-2xl font-bold tracking-tight">No positions yet</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your dashboard will show your real positions, Health Factor, and P&amp;L once you supply assets or borrow on Robinhood Chain.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md w-full">
          <Link href="/markets">
            <div className="cursor-pointer rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all p-5 text-left space-y-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="font-semibold text-sm">Supply Assets</div>
              <div className="text-xs text-muted-foreground">Deposit crypto or tokenized stocks as collateral to start borrowing.</div>
              <div className="flex items-center gap-1 text-xs text-primary font-medium">Browse Markets <ChevronRight className="h-3.5 w-3.5" /></div>
            </div>
          </Link>
          <Link href="/earn">
            <div className="cursor-pointer rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all p-5 text-left space-y-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <div className="font-semibold text-sm">Earn Yield</div>
              <div className="text-xs text-muted-foreground">Supply USDG, ETH, or WETH to pools and earn interest from borrowers.</div>
              <div className="flex items-center gap-1 text-xs text-primary font-medium">View Earn pools <ChevronRight className="h-3.5 w-3.5" /></div>
            </div>
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground/40 font-mono">
          {walletAddress.substring(0, 10)}…{walletAddress.slice(-6)}
        </p>
      </div>
    );
  }

  // ── Full dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* P&L + HF alert strip */}
      <PositionAlertPanel
        positions={positions}
        assets={assets}
        hf={hf}
        totalCollateral={totalCollateral}
        totalDebt={totalDebt}
        isMarketOpen={isMarketOpen}
        onRepay={assetId => setModal({ assetId, type: 'Repay' })}
        onAddCollateral={assetId => setModal({ assetId, type: 'Supply' })}
      />

      {/* ── Stat tiles + HF gauge ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">

        {/* 4 stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 rounded-xl border border-border bg-card overflow-hidden">
          {[
            { label: 'Net Worth',           sub: 'Total value',     value: formatUsd(totalNetWorth),   color: '' },
            { label: 'Collateral',          sub: 'Assets supplied', value: formatUsd(totalCollateral), color: '' },
            { label: 'Debt',                sub: 'Amount borrowed', value: formatUsd(totalDebt),       color: totalDebt > 0 ? 'text-destructive' : '' },
            { label: 'To Borrow',           sub: 'Power left',      value: formatUsd(availableBorrow), color: 'text-primary' },
          ].map((item, i) => (
            <div key={item.label}
              className={`px-3 py-3 sm:px-5 sm:py-4 flex flex-col gap-0.5 ${i < 3 ? 'border-r border-border/50' : ''}`}>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{item.label}</div>
              <div className={`text-lg sm:text-2xl font-mono font-semibold leading-tight truncate ${item.color}`}>{item.value}</div>
              <div className="hidden sm:block text-[11px] text-muted-foreground/50 mt-0.5">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* HF gauge */}
        <Card className="bg-card flex flex-col items-center justify-center px-6 py-5 min-w-[150px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3 cursor-help">
                Health Factor <Info className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              HF = (Collateral × Liquidation Threshold) / Total Debt. Below 1.0 triggers liquidation.
            </TooltipContent>
          </Tooltip>

          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1f1f1f" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none"
                stroke={getHfStroke(hf)} strokeWidth="8"
                strokeDasharray={`${Math.min((hf > 99 ? 3 : hf) / 3, 1) * 251.3} 251.3`}
                strokeLinecap="round" opacity="0.9"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-mono font-bold leading-none ${getHfColor(hf)}`}>
                {hf > 99 ? '∞' : hf.toFixed(2)}
              </span>
            </div>
          </div>

          {hf < 999 && (
            <div className="mt-2 text-[10px] font-mono text-muted-foreground/50 text-center">
              Buffer {formatUsd(Math.max(0, totalCollateral - totalDebt), true)}
            </div>
          )}
        </Card>
      </div>

      {/* HF sparkline — only when real tx history exists */}
      {sparkData.length > 0 ? (
        <Card className="bg-card">
          <CardContent className="p-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Health Factor · Last 30 Days</div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setRiskOpen(true)}>
                <FlaskConical className="h-3.5 w-3.5" /> Risk Simulator
              </Button>
            </div>
            <SparklineChart data={sparkData} color={getHfStroke(hf)} />
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setRiskOpen(true)}>
            <FlaskConical className="h-3.5 w-3.5" /> Risk Simulator
          </Button>
        </div>
      )}

      {/* ── Collateral + Borrows ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Collateral panel */}
        <Card className="bg-card">
          <div className="px-5 pt-4 pb-3 border-b border-border/50 flex items-center justify-between">
            <div className="font-semibold text-sm">Your Collateral</div>
            {collateralPos.length > 0 && (
              <Button
                variant={confirmWithdrawAll ? 'destructive' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleWithdrawAll}
                disabled={isWithdrawingAll}
              >
                {isWithdrawingAll
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Withdrawing…</>
                  : confirmWithdrawAll
                    ? <><LogOut className="h-3 w-3" /> Confirm: Withdraw All</>
                    : <><LogOut className="h-3 w-3" /> Withdraw All</>}
              </Button>
            )}
          </div>
          <div className="divide-y divide-border/40">
            {collateralPos.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No collateral supplied yet.
                <div className="mt-3">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link href="/markets">Browse Markets <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </div>
            )}
            {collateralPos.map(p => {
              const asset    = assets.find(a => a.id === p.assetId)!;
              const isEquity = asset.isEquity;
              const value    = p.supplied * asset.priceUsd;
              const daily24h = p.supplied * asset.priceUsd * asset.priceChange24h;
              const { supplyApy } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
              const interest = interestByAsset[p.assetId] ?? 0;
              return (
                <div key={p.assetId} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/20 transition-colors">
                  <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xs text-primary font-bold border border-primary/20 shrink-0 overflow-hidden" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-sm font-semibold leading-tight flex-wrap">
                      {asset.symbol}
                      {isEquity && (
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 border-transparent leading-none ${isMarketOpen ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {isMarketOpen ? 'NYSE' : 'Closed'}
                        </Badge>
                      )}
                      <PnLBadge change24h={asset.priceChange24h} size="xs" />
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{formatToken(p.supplied, 4)}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-mono text-primary/70">APY {formatPercent(supplyApy)}</span>
                      {interest > 0.0001 && (
                        <span className="text-[10px] font-mono text-primary">+{formatToken(interest, 4)} earned</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 hidden xs:block">
                    <div className="font-mono text-sm font-medium">{formatUsd(value)}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${daily24h >= 0 ? 'text-primary' : 'text-red-400'}`}>
                      {daily24h >= 0 ? '+' : ''}{formatUsd(daily24h)}
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className="text-[10px] text-muted-foreground">Coll.</span>
                      <Switch
                        checked={p.useAsCollateral}
                        onCheckedChange={() => toggleCollateral(asset.id)}
                        className="h-3.5 w-6 scale-[0.7] origin-right"
                      />
                    </div>
                  </div>

                  {/* Mobile: value + collateral toggle stacked */}
                  <div className="text-right shrink-0 xs:hidden">
                    <div className="font-mono text-xs font-medium">{formatUsd(value)}</div>
                    <Switch
                      checked={p.useAsCollateral}
                      onCheckedChange={() => toggleCollateral(asset.id)}
                      className="h-3.5 w-6 scale-[0.7] origin-right mt-0.5"
                    />
                  </div>

                  {/* Action buttons: icon-only on mobile, labelled on sm+ */}
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 w-7 sm:w-auto sm:px-2.5 p-0 sm:gap-1"
                      onClick={() => setModal({ assetId: asset.id, type: 'Withdraw' })}>
                      <ArrowUpFromLine className="h-3 w-3" />
                      <span className="hidden sm:inline text-xs">Withdraw</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 sm:w-auto sm:px-2.5 p-0 sm:gap-1"
                      onClick={() => setModal({ assetId: asset.id, type: 'Supply' })}>
                      <ArrowDownToLine className="h-3 w-3" />
                      <span className="hidden sm:inline text-xs">Deposit</span>
                    </Button>
                  </div>

                  <Link href={`/markets/${asset.id}`}>
                    <button className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors shrink-0">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Borrows panel */}
        <Card className="bg-card">
          <div className="px-5 pt-4 pb-3 border-b border-border/50">
            <div className="font-semibold text-sm">Your Borrows</div>
          </div>
          <div className="divide-y divide-border/40">
            {borrowPos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No active borrows.
                <div className="mt-3">
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setModal({ assetId: 'usd-g', type: 'Borrow' })}>
                    <Banknote className="h-3.5 w-3.5" /> Borrow USDG
                  </Button>
                </div>
              </div>
            )}
            {borrowPos.map(p => {
              const asset = assets.find(a => a.id === p.assetId)!;
              const { borrowApr } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
              const daily24h = -(p.borrowed * asset.priceUsd * asset.priceChange24h);
              return (
                <div key={p.assetId} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/20 transition-colors">
                  <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xs text-primary font-bold border border-primary/20 shrink-0 overflow-hidden" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-sm font-semibold leading-tight">
                      {asset.symbol}
                      <PnLBadge change24h={-asset.priceChange24h} size="xs" />
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{formatToken(p.borrowed, 4)} debt</div>
                    <div className="text-[10px] text-muted-foreground">{formatPercent(borrowApr)} APR</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-medium text-destructive">{formatUsd(p.borrowed * asset.priceUsd)}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${daily24h >= 0 ? 'text-primary' : 'text-red-400'}`}>
                      {daily24h >= 0 ? '+' : ''}{formatUsd(daily24h)}
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 sm:w-auto sm:px-2.5 p-0 sm:gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setModal({ assetId: asset.id, type: 'Repay' })}>
                      <CornerUpLeft className="h-3 w-3" />
                      <span className="hidden sm:inline text-xs">Repay</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 sm:w-auto sm:px-2.5 p-0 sm:gap-1"
                      onClick={() => setModal({ assetId: asset.id, type: 'Borrow' })}>
                      <Plus className="h-3 w-3" />
                      <span className="hidden sm:inline text-xs">More</span>
                    </Button>
                  </div>

                  <Link href={`/markets/${asset.id}`}>
                    <button className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors shrink-0">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Isolated Positions — only when user has them ──────────────────────── */}
      {isolatedPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-yellow-400">Isolated Positions</h2>
              <span className="text-xs text-muted-foreground/60">Risk ring-fenced from Main Market</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground" asChild>
              <Link href="/markets">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isolatedPositions.map(p => {
              const asset = assets.find(a => a.id === p.assetId)!;
              const isoHf = p.borrowed > 0.001
                ? (p.supplied * asset.liquidationThreshold) / p.borrowed
                : 999;
              const isoHfColor = isoHf >= 2 ? '#D0EF19' : isoHf >= 1.3 ? '#A8C200' : isoHf > 1 ? '#FFB224' : '#FF4D4D';

              return (
                <Card key={p.assetId} className="bg-card border-yellow-400/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-9 h-9 rounded-full bg-yellow-400/10 flex items-center justify-center font-mono text-xs text-yellow-400 font-bold border border-yellow-400/20 shrink-0 overflow-hidden" />
                        <div>
                          <div className="font-semibold text-sm">{asset.symbol}</div>
                          <div className="text-xs text-muted-foreground">{asset.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Isolated HF</div>
                        <div className="text-2xl font-mono font-bold leading-none" style={{ color: isoHfColor }}>
                          {isoHf > 99 ? '∞' : isoHf.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3 pt-3 border-t border-border/40">
                      <div><div className="text-muted-foreground text-xs mb-0.5">Collateral</div><div className="font-mono text-sm">{formatUsd(p.supplied * asset.priceUsd)}</div></div>
                      <div><div className="text-muted-foreground text-xs mb-0.5">Debt</div><div className="font-mono text-sm text-destructive/80">{formatUsd(p.borrowed * asset.priceUsd)}</div></div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-7 text-xs gap-1.5"
                        onClick={() => setModal({ assetId: asset.id, type: 'Supply' })}>
                        <ShieldPlus className="h-3.5 w-3.5" /> Add Collateral
                      </Button>
                      <Button variant="outline" size="sm"
                        className="flex-1 h-7 text-xs gap-1.5 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
                        onClick={() => setModal({ assetId: asset.id, type: 'Repay' })}>
                        <CornerUpLeft className="h-3.5 w-3.5" /> Repay
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Liquidation notice — real txs only */}
      {transactions.some(t => t.type === 'Liquidation' && t.id.startsWith('0x')) && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingDown className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-destructive">Liquidation Occurred</p>
              <p className="text-xs text-muted-foreground mt-1">Part of your collateral was sold to repay debt. Check History for details.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {modal && (
        <ActionModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          asset={assets.find(a => a.id === modal.assetId)!}
          actionType={modal.type}
        />
      )}
      <RiskSimulatorDrawer open={riskOpen} onClose={() => setRiskOpen(false)} />
    </div>
  );
}
