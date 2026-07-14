import React, { useState } from 'react';
import { AssetIcon } from '@/components/shared/AssetIcon';
import { useProtocol } from '@/hooks/use-protocol';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatUsd, formatPercent, formatToken } from '@/lib/utils';
import { Search, X, Info, Lock, ArrowUpRight, DollarSign, ChevronRight, ChevronDown, ArrowDownToLine, Banknote, ExternalLink, ShieldAlert } from 'lucide-react';
import { Link } from 'wouter';
import { calculateRates } from '@/lib/protocol';
import { ActionModal } from '@/components/shared/ActionModal';
import { REAL_MARKET_IDS } from '@/lib/contracts';

const TIER_COLORS: Record<string, string> = {
  Stablecoin: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  Crypto:     'bg-primary/10 text-primary border-primary/20',
  Equity:     'bg-purple-400/10 text-purple-400 border-purple-400/20',
  Speculative:'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
};

type TierFilter = 'All' | 'Stablecoin' | 'Crypto' | 'Equity';
const TIER_TABS: TierFilter[] = ['All', 'Stablecoin', 'Crypto', 'Equity'];

export default function MarketsPage() {
  const { assets, isMarketOpen, walletAddress, connectWallet } = useProtocol();
  const [search, setSearch]         = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [modal, setModal] = useState<{ assetId: string; type: any } | null>(null);

  // Gate modal opens — if not connected, prompt wallet connection instead
  const openModal = (assetId: string, type: any) => {
    if (!walletAddress) { connectWallet(); return; }
    setModal({ assetId, type });
  };

  const mainAssets = assets.filter(a => !a.isolated);

  const q = search.trim().toLowerCase();

  const filteredMain = mainAssets.filter(a => {
    const matchSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.symbol.toLowerCase().includes(q);
    const matchTier = tierFilter === 'All' || a.tier === tierFilter;
    return matchSearch && matchTier;
  });

  // All numbers derived from market state
  const tvl            = assets.reduce((s, a) => s + a.totalSupplied * a.priceUsd, 0);
  const totalBorrowed  = assets.reduce((s, a) => s + a.totalBorrowed * a.priceUsd, 0);
  const availLiquidity = tvl - totalBorrowed;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Stat cards ── */}
      {/* Mobile: single row of 3 compact tiles. Desktop: full-size cards. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* TVL */}
        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center justify-between mb-1.5 sm:mb-3">
              <div className="flex items-center gap-1 text-[11px] sm:text-sm text-muted-foreground leading-tight">
                <span className="hidden sm:inline">Total Value Locked</span>
                <span className="sm:hidden">TVL</span>
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-60 shrink-0" />
              </div>
              <div className="hidden sm:block p-2 rounded-lg bg-muted/50">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-lg sm:text-3xl font-mono font-semibold truncate">{formatUsd(tvl, true)}</div>
            <div className="hidden sm:block text-xs font-mono text-muted-foreground mt-1">Live on-chain · seed liquidity only</div>
          </CardContent>
        </Card>

        {/* Total Borrowed */}
        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center justify-between mb-1.5 sm:mb-3">
              <div className="flex items-center gap-1 text-[11px] sm:text-sm text-muted-foreground leading-tight">
                <span className="hidden sm:inline">Total Borrowed</span>
                <span className="sm:hidden">Borrowed</span>
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-60 shrink-0" />
              </div>
              <div className="hidden sm:block p-2 rounded-lg bg-muted/50">
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-lg sm:text-3xl font-mono font-semibold truncate">{formatUsd(totalBorrowed, true)}</div>
            <div className="hidden sm:block text-xs font-mono text-muted-foreground mt-1">
              {totalBorrowed > 0 ? 'Live on-chain · updates every 15s' : 'Live on-chain · no active borrows yet'}
            </div>
          </CardContent>
        </Card>

        {/* Available Liquidity */}
        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center justify-between mb-1.5 sm:mb-3">
              <div className="flex items-center gap-1 text-[11px] sm:text-sm text-muted-foreground leading-tight">
                <span className="hidden sm:inline">Available Liquidity</span>
                <span className="sm:hidden">Liquidity</span>
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-60 shrink-0" />
              </div>
              <div className="hidden sm:block p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-lg sm:text-3xl font-mono font-semibold text-primary truncate">{formatUsd(availLiquidity, true)}</div>
            <div className="hidden sm:block text-xs font-mono text-muted-foreground mt-1">Ready to borrow · live from chain</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Market ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold tracking-tight">Main Market</h2>
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              {TIER_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    tierFilter === t
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'All'
                    ? `All (${mainAssets.length})`
                    : `${t} (${mainAssets.filter(a => a.tier === t).length})`}
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search assets…"
              className="pl-9 pr-8 bg-card border-border"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop table */}
        <Card className="overflow-hidden bg-card border-border hidden md:block">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-b border-border bg-background/40">
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Supply APY</th>
                <th className="px-4 py-3 font-medium text-right">Borrow APR</th>
                <th className="px-4 py-3 font-medium text-right">Total Supplied</th>
                <th className="px-4 py-3 font-medium text-right">Total Borrowed</th>
                <th className="px-4 py-3 font-medium text-right">Utilization</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMain.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No assets match <span className="text-foreground font-medium">"{search}"</span></p>
                    <button onClick={() => { setSearch(''); setTierFilter('All'); }} className="text-xs text-primary mt-2 hover:underline">Clear search</button>
                  </td>
                </tr>
              )}
              {filteredMain.map(asset => {
                const { utilization, supplyApy, borrowApr } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
                const isExpanded = expandedRow === asset.id;
                const isFrozen   = asset.isEquity && !isMarketOpen;
                const supplyUsed = asset.supplyCap > 0 ? asset.totalSupplied / asset.supplyCap : 0;
                const borrowUsed = asset.borrowCap > 0 ? asset.totalBorrowed / asset.borrowCap : 0;
                // Custom-token markets (USDG, AAPL-T…) have deployer seed liquidity
                // even though the UI shows totalSupplied=0. Only real-token markets
                // (WETH, USDe, VIRTUAL) can run out of borrowable liquidity.
                const availLiq   = Math.max(0, asset.totalSupplied - asset.totalBorrowed);
                const noLiquidity = REAL_MARKET_IDS.has(asset.id) && availLiq < 0.0001;

                return (
                  <React.Fragment key={asset.id}>
                    <tr
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setExpandedRow(isExpanded ? null : asset.id)}
                    >
                      {/* Asset */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xs text-primary font-bold border border-primary/20 group-hover:border-primary/50 transition-colors shrink-0 overflow-hidden" />
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                              {asset.symbol}
                              {asset.isEquity && (
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border-transparent ${isMarketOpen ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                                  {isMarketOpen ? 'NYSE' : 'CLOSED'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{asset.name}</div>
                          </div>
                        </div>
                      </td>
                      {/* Price */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-mono text-sm">{formatUsd(asset.priceUsd)}</div>
                        {isFrozen
                          ? <div className="text-[10px] font-mono text-muted-foreground/70">Last close</div>
                          : <div className={`text-xs font-mono ${asset.priceChange24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                              {asset.priceChange24h >= 0 ? '+' : ''}{formatPercent(asset.priceChange24h)}
                            </div>
                        }
                      </td>
                      {/* Supply APY */}
                      <td className="px-4 py-3.5 text-right font-mono text-sm text-primary">{formatPercent(supplyApy)}</td>
                      {/* Borrow APR */}
                      <td className="px-4 py-3.5 text-right font-mono text-sm">{formatPercent(borrowApr)}</td>
                      {/* Total Supplied */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-mono text-sm">{formatToken(asset.totalSupplied, 0)}</div>
                        <Progress value={supplyUsed * 100} className="w-16 h-1 mt-1 ml-auto" />
                        <div className="text-[10px] text-muted-foreground">of {formatToken(asset.supplyCap, 0)}</div>
                      </td>
                      {/* Total Borrowed */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-mono text-sm">{formatToken(asset.totalBorrowed, 0)}</div>
                        <Progress value={borrowUsed * 100} className="w-16 h-1 mt-1 ml-auto" indicatorClassName="bg-yellow-400/70" />
                        <div className="text-[10px] text-muted-foreground">of {formatToken(asset.borrowCap, 0)}</div>
                      </td>
                      {/* Utilization */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono text-xs">{formatPercent(utilization)}</span>
                      </td>
                      {/* Expand chevron */}
                      <td className="pr-3 text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-primary transition-transform" />
                          : <ChevronRight className="h-4 w-4 group-hover:text-primary transition-colors" />}
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr className="bg-background/60">
                        <td colSpan={8} className="px-6 pb-4 pt-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Max LTV</p>
                              <p className="font-mono text-sm">{formatPercent(asset.ltv)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Liquidation Threshold</p>
                              <p className="font-mono text-sm">{formatPercent(asset.liquidationThreshold)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Liquidation Bonus</p>
                              <p className="font-mono text-sm">{formatPercent(asset.liquidationBonus)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Price Source</p>
                              <p className="text-xs text-primary font-mono">{asset.oracleSource}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 text-xs gap-1.5"
                              onClick={e => { e.stopPropagation(); openModal(asset.id, 'Supply'); }}>
                              <ArrowDownToLine className="h-3.5 w-3.5" /> Supply
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                              disabled={(asset.isEquity && !isMarketOpen) || noLiquidity}
                              title={noLiquidity ? 'No liquidity available to borrow' : undefined}
                              onClick={e => { e.stopPropagation(); openModal(asset.id, 'Borrow'); }}>
                              <Banknote className="h-3.5 w-3.5" />
                              {noLiquidity ? 'No Liquidity' : 'Borrow'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 ml-auto" asChild>
                              <Link href={`/markets/${asset.id}`}><ExternalLink className="h-3.5 w-3.5" /> Full details</Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {filteredMain.length === 0 && (
            <div className="py-14 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No assets match <span className="text-foreground font-medium">"{search}"</span></p>
              <button onClick={() => { setSearch(''); setTierFilter('All'); }} className="text-xs text-primary mt-2 hover:underline">Clear search</button>
            </div>
          )}
          {filteredMain.map(asset => {
            const { utilization, supplyApy, borrowApr } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
            const isFrozen    = asset.isEquity && !isMarketOpen;
            const mobileAvail = Math.max(0, asset.totalSupplied - asset.totalBorrowed);
            const mobileNoLiq = REAL_MARKET_IDS.has(asset.id) && mobileAvail < 0.0001;
            return (
              <Link key={asset.id} href={`/markets/${asset.id}`}>
                <Card className="bg-card border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xs text-primary font-bold border border-primary/20 shrink-0 overflow-hidden" />
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            {asset.symbol}
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${TIER_COLORS[asset.tier]}`}>{asset.tier}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{asset.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{formatUsd(asset.priceUsd)}</div>
                        {isFrozen
                          ? <div className="text-[10px] font-mono text-muted-foreground">Last close</div>
                          : <div className={`text-xs font-mono ${asset.priceChange24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                              {asset.priceChange24h >= 0 ? '+' : ''}{formatPercent(asset.priceChange24h)}
                            </div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><div className="text-muted-foreground mb-0.5">Supply APY</div><div className="font-mono text-primary">{formatPercent(supplyApy)}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">Borrow APR</div><div className="font-mono">{formatPercent(borrowApr)}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">Utilization</div><div className="font-mono">{formatPercent(utilization)}</div></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={e => { e.preventDefault(); openModal(asset.id, 'Supply'); }}>
                        <ArrowDownToLine className="h-3.5 w-3.5" /> Supply
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
                        disabled={isFrozen || mobileNoLiq}
                        title={mobileNoLiq ? 'No liquidity available to borrow' : undefined}
                        onClick={e => { e.preventDefault(); openModal(asset.id, 'Borrow'); }}>
                        <Banknote className="h-3.5 w-3.5" />
                        {mobileNoLiq ? 'No Liquidity' : 'Borrow'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>


      {/* ── Isolated Market ── */}
      {assets.filter(a => a.isolated).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Isolated Market</h2>
            <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-md px-2 py-1">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Collateral-only — can only borrow USDG
            </div>
          </div>

          {/* Desktop table */}
          <Card className="overflow-hidden bg-card border-border hidden md:block">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase border-b border-border bg-background/40">
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Max LTV</th>
                  <th className="px-4 py-3 font-medium text-right">Liq. Threshold</th>
                  <th className="px-4 py-3 font-medium text-right">Total Supplied</th>
                  <th className="px-4 py-3 font-medium text-right">Total Borrowed</th>
                  <th className="px-4 py-3 font-medium text-right">Utilization</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.filter(a => a.isolated).map(asset => {
                  const { utilization } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
                  const supplyUsed = asset.supplyCap > 0 ? asset.totalSupplied / asset.supplyCap : 0;
                  const borrowUsed = asset.borrowCap > 0 ? asset.totalBorrowed / asset.borrowCap : 0;
                  return (
                    <React.Fragment key={asset.id}>
                      <tr
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setExpandedRow(expandedRow === asset.id ? null : asset.id)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xs text-primary font-bold border border-primary/20 group-hover:border-primary/50 transition-colors shrink-0 overflow-hidden" />
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-1.5">
                                {asset.symbol}
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-400/10 text-yellow-400 border-yellow-400/20">Isolated</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-mono text-sm">{formatUsd(asset.priceUsd)}</div>
                          <div className={`text-xs font-mono ${asset.priceChange24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {asset.priceChange24h >= 0 ? '+' : ''}{formatPercent(asset.priceChange24h)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm">{formatPercent(asset.ltv)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm">{formatPercent(asset.liquidationThreshold)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-mono text-sm">{formatToken(asset.totalSupplied, 0)}</div>
                          <Progress value={supplyUsed * 100} className="w-16 h-1 mt-1 ml-auto" />
                          <div className="text-[10px] text-muted-foreground">of {formatToken(asset.supplyCap, 0)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-mono text-sm">{formatToken(asset.totalBorrowed, 0)}</div>
                          <Progress value={borrowUsed * 100} className="w-16 h-1 mt-1 ml-auto" indicatorClassName="bg-yellow-400/70" />
                          <div className="text-[10px] text-muted-foreground">of {formatToken(asset.borrowCap, 0)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-mono text-xs">{formatPercent(utilization)}</span>
                        </td>
                        <td className="pr-3 text-muted-foreground">
                          {expandedRow === asset.id
                            ? <ChevronDown className="h-4 w-4 text-primary" />
                            : <ChevronRight className="h-4 w-4 group-hover:text-primary transition-colors" />}
                        </td>
                      </tr>
                      {expandedRow === asset.id && (
                        <tr className="bg-background/60">
                          <td colSpan={8} className="px-6 pb-4 pt-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div><p className="text-xs text-muted-foreground mb-1">Max LTV</p><p className="font-mono text-sm">{formatPercent(asset.ltv)}</p></div>
                              <div><p className="text-xs text-muted-foreground mb-1">Liq. Threshold</p><p className="font-mono text-sm">{formatPercent(asset.liquidationThreshold)}</p></div>
                              <div><p className="text-xs text-muted-foreground mb-1">Liq. Penalty</p><p className="font-mono text-sm">{formatPercent(asset.liquidationBonus)}</p></div>
                              <div><p className="text-xs text-muted-foreground mb-1">Price Source</p><p className="text-xs text-primary font-mono">{asset.oracleSource}</p></div>
                            </div>
                            <p className="text-xs text-yellow-400/80 mb-3">⚠ Isolated mode: use as collateral to borrow USDG only. Debt ceiling: 100,000 USDG.</p>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-8 text-xs gap-1.5"
                                onClick={e => { e.stopPropagation(); openModal(asset.id, 'Supply'); }}>
                                <ArrowDownToLine className="h-3.5 w-3.5" /> Supply
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                                onClick={e => { e.stopPropagation(); openModal(asset.id, 'Borrow'); }}>
                                <Banknote className="h-3.5 w-3.5" /> Borrow USDG
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 ml-auto" asChild>
                                <Link href={`/markets/${asset.id}`}><ExternalLink className="h-3.5 w-3.5" /> Full details</Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {assets.filter(a => a.isolated).map(asset => (
              <Link key={asset.id} href={`/markets/${asset.id}`}>
                <Card className="bg-card border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xs text-primary font-bold border border-yellow-400/20 shrink-0 overflow-hidden" />
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            {asset.symbol}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-400/10 text-yellow-400 border-yellow-400/20">Isolated</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{asset.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{formatUsd(asset.priceUsd)}</div>
                        <div className={`text-xs font-mono ${asset.priceChange24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {asset.priceChange24h >= 0 ? '+' : ''}{formatPercent(asset.priceChange24h)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><div className="text-muted-foreground mb-0.5">Max LTV</div><div className="font-mono">{formatPercent(asset.ltv)}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">Liq. Threshold</div><div className="font-mono">{formatPercent(asset.liquidationThreshold)}</div></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={e => { e.preventDefault(); openModal(asset.id, 'Supply'); }}>
                        <ArrowDownToLine className="h-3.5 w-3.5" /> Supply
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={e => { e.preventDefault(); openModal(asset.id, 'Borrow'); }}>
                        <Banknote className="h-3.5 w-3.5" /> Borrow USDG
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Action modal */}
      {modal && (
        <ActionModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          asset={assets.find(a => a.id === modal.assetId)!}
          actionType={modal.type}
        />
      )}
    </div>
  );
}
