import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useProtocol } from '@/hooks/use-protocol';
import { useAllReserveStats } from '@/hooks/use-on-chain-data';
import { useLiquidationData } from '@/hooks/use-liquidation-data';
import {
  Zap, ShieldCheck, Info, AlertTriangle, ExternalLink,
  RefreshCw, Activity, Users, TrendingDown,
} from 'lucide-react';
import { formatPercent } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function hfColor(hf: number): string {
  if (hf === Infinity) return 'text-primary';
  if (hf < 1.0) return 'text-destructive';
  if (hf < 1.2) return 'text-red-400';
  if (hf < 1.5) return 'text-amber-400';
  return 'text-primary';
}

function hfLabel(hf: number): string {
  if (hf === Infinity) return '∞';
  return hf.toFixed(3);
}

function hfStatus(hf: number): { label: string; cls: string } {
  if (hf === Infinity) return { label: 'Safe',         cls: 'text-primary bg-primary/10 border-primary/20' };
  if (hf < 1.0)        return { label: 'Liquidatable', cls: 'text-destructive bg-destructive/10 border-destructive/20' };
  if (hf < 1.2)        return { label: 'High Risk',    cls: 'text-red-400 bg-red-400/10 border-red-400/20' };
  if (hf < 1.5)        return { label: 'At Risk',      cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
  return { label: 'Watching', cls: 'text-muted-foreground bg-muted/30 border-border' };
}

function formatAmount(n: number): string {
  if (n === 0) return '0';
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiquidationsPage() {
  const { assets } = useProtocol();
  const { stats }  = useAllReserveStats();
  const {
    loading, liquidationEvents, atRiskPositions,
    totalLiquidations, lastRefresh, refresh,
  } = useLiquidationData();

  // Use rawTotalSupplied (unfiltered) so display-suppressed markets (USDG) don't
  // falsely trigger "Bad Debt" just because their filtered supplied amount is 0.
  const hasAnyBadDebt = assets.some(a => {
    const s = stats[a.id];
    return s && s.totalBorrowed > (s.rawTotalSupplied ?? s.totalSupplied);
  });

  const liquidatableCount = atRiskPositions.filter(p => p.isLiquidatable).length;
  const atRiskCount       = atRiskPositions.filter(p => !p.isLiquidatable).length;

  const lastRefreshStr = lastRefresh
    ? new Date(lastRefresh).toLocaleTimeString()
    : '—';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <Zap className="h-6 w-6 text-destructive" />
            Liquidation Explorer
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Live on-chain data — no indexer required. Events and health factors
            are read directly from the LendingPool contract on Robinhood Chain.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total Liquidations */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" />
              Total Liquidations
            </div>
            {loading
              ? <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
              : <div className="text-3xl font-mono font-semibold text-foreground">{totalLiquidations}</div>
            }
            <div className="text-[11px] text-muted-foreground/60 mt-1">All time · live from chain</div>
          </CardContent>
        </Card>

        {/* Liquidatable now */}
        <Card className={`border ${liquidatableCount > 0 ? 'border-destructive/40 bg-destructive/5' : 'bg-card border-border'}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              Liquidatable Now
            </div>
            {loading
              ? <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
              : <div className={`text-3xl font-mono font-semibold ${liquidatableCount > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {liquidatableCount}
                </div>
            }
            <div className="text-[11px] text-muted-foreground/60 mt-1">HF &lt; 1.0 · open positions</div>
          </CardContent>
        </Card>

        {/* At Risk */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5 text-amber-400" />
              At Risk
            </div>
            {loading
              ? <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
              : <div className="text-3xl font-mono font-semibold text-amber-400">{atRiskCount}</div>
            }
            <div className="text-[11px] text-muted-foreground/60 mt-1">HF 1.0–2.0 · being watched</div>
          </CardContent>
        </Card>

        {/* Pool Health */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pool Health
            </div>
            <div className={`text-3xl font-mono font-semibold ${hasAnyBadDebt ? 'text-destructive' : 'text-primary'}`}>
              {hasAnyBadDebt ? 'Bad Debt' : 'Solvent'}
            </div>
            <div className="text-[11px] text-muted-foreground/60 mt-1">
              {hasAnyBadDebt ? 'Reserve(s) underwater' : 'All reserves fully collateralised'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Positions */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-400" />
              Active Positions — Health Monitor
            </span>
            {lastRefresh > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                Updated {lastRefreshStr}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            All wallets that have ever supplied or borrowed are tracked. Health factors
            are read on-chain every 30 seconds. Positions with HF &lt; 1.0 are open for liquidation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : atRiskPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">No positions found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No wallets have active borrow positions yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="py-2 text-left font-medium">Borrower</th>
                    <th className="py-2 text-right font-medium">Health Factor</th>
                    <th className="py-2 text-right font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {atRiskPositions.map(pos => {
                    const status = hfStatus(pos.healthFactor);
                    return (
                      <tr key={pos.user} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 font-mono text-xs text-foreground">
                          {shortAddr(pos.user)}
                        </td>
                        <td className={`py-2.5 text-right font-mono font-semibold ${hfColor(pos.healthFactor)}`}>
                          {hfLabel(pos.healthFactor)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-medium ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <a
                            href={`https://explorer.robinhoodchain.com/address/${pos.user}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liquidation History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Liquidation History</CardTitle>
          <CardDescription>
            All liquidation events emitted by the LendingPool contract since genesis.
            Read directly via <code className="text-xs bg-muted px-1 rounded">eth_getLogs</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : liquidationEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">No liquidations yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  The protocol is live and solvent. Liquidation events will appear here
                  automatically as they happen on-chain.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase">
                    <th className="py-2 text-left font-medium">Block</th>
                    <th className="py-2 text-left font-medium">Liquidator</th>
                    <th className="py-2 text-left font-medium">Borrower</th>
                    <th className="py-2 text-right font-medium">Debt Repaid</th>
                    <th className="py-2 text-right font-medium">Collateral Seized</th>
                    <th className="py-2 text-right font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {liquidationEvents.map((ev, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2 font-mono text-muted-foreground">
                        #{ev.blockNumber.toString()}
                      </td>
                      <td className="py-2 font-mono">{shortAddr(ev.liquidator)}</td>
                      <td className="py-2 font-mono">{shortAddr(ev.borrower)}</td>
                      <td className="py-2 text-right font-mono">
                        {formatAmount(ev.debtRepaid)}{' '}
                        <span className="text-muted-foreground">{ev.debtSymbol}</span>
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatAmount(ev.collateralSeized)}{' '}
                        <span className="text-muted-foreground">{ev.collateralSymbol}</span>
                      </td>
                      <td className="py-2 text-right">
                        {ev.txHash ? (
                          <a
                            href={`https://explorer.robinhoodchain.com/tx/${ev.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {ev.txHash.slice(0, 8)}… <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk params table + How Liquidations Work */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> How Liquidations Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Trigger</p>
              <p>When a borrower's <strong className="text-foreground">Health Factor</strong> falls below 1.0, their position becomes eligible for liquidation. This happens when collateral value drops or debt value rises.</p>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Execution</p>
              <p>Any address can call the liquidation function. The liquidator repays up to <strong className="text-foreground">50% of the outstanding debt</strong> and receives the equivalent collateral plus a <strong className="text-foreground">Liquidation Bonus</strong>.</p>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Partial Liquidations</p>
              <p>No position is fully liquidated in a single transaction. Partial liquidations allow borrowers to recover after replenishing collateral or repaying debt.</p>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Insurance Fund</p>
              <p>A 10% reserve factor accumulates in the Insurance Fund to cover bad debt in the event of a catastrophic shortfall, protecting liquidity providers.</p>
            </div>
          </div>

          {/* Per-asset risk params */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase">
                  <th className="py-2 text-left font-medium">Asset</th>
                  <th className="py-2 text-right font-medium">LTV</th>
                  <th className="py-2 text-right font-medium">Liq Threshold</th>
                  <th className="py-2 text-right font-medium">Liq Bonus</th>
                  <th className="py-2 text-right font-medium">Close Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {assets.map(a => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 font-medium text-foreground">
                      {a.symbol}
                      {a.isolated && <span className="ml-1 text-yellow-400 text-[10px]">ISOLATED</span>}
                    </td>
                    <td className="py-2 text-right font-mono">{formatPercent(a.ltv ?? 0)}</td>
                    <td className="py-2 text-right font-mono">{formatPercent(a.liquidationThreshold)}</td>
                    <td className="py-2 text-right font-mono text-primary">{formatPercent(a.liquidationBonus)}</td>
                    <td className="py-2 text-right font-mono">50%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
