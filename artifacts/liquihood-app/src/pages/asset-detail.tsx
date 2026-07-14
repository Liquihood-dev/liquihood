import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useProtocol } from '@/hooks/use-protocol';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatUsd, formatPercent, formatToken } from '@/lib/utils';
import { calculateRates } from '@/lib/protocol';
import { ActionModal } from '@/components/shared/ActionModal';
import { Info, Clock, AlertTriangle, Shield, ArrowDownToLine, ArrowUpFromLine, Banknote, CornerUpLeft } from 'lucide-react';
import { AssetIcon } from '@/components/shared/AssetIcon';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

export default function AssetDetailPage() {
  const params = useParams();
  const { assets, isMarketOpen } = useProtocol();
  const [modal, setModal] = useState<{ type: any } | null>(null);

  const asset = assets.find(a => a.id === params.id);
  if (!asset) return <div className="p-8 text-muted-foreground">Asset not found</div>;

  const { utilization, supplyApy, borrowApr } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
  const supplyUsed = asset.supplyCap > 0 ? asset.totalSupplied / asset.supplyCap : 0;
  const borrowUsed = asset.borrowCap > 0 ? asset.totalBorrowed / asset.borrowCap : 0;
  const isFrozen   = asset.isEquity && !isMarketOpen;

  // Interest rate model curve — real math from contract parameters
  const curveData = Array.from({ length: 101 }, (_, i) => {
    const u = i / 100;
    const bApr = u <= 0.8 ? (u / 0.8) * 0.065 : 0.065 + ((u - 0.8) / 0.2) * 0.60;
    return { u: u * 100, supplyApy: bApr * u * 0.90 * 100, borrowApr: bApr * 100 };
  });

  const currentU = utilization * 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <AssetIcon assetId={asset.id} symbol={asset.symbol} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-accent/10 flex items-center justify-center font-mono text-xl text-primary font-bold border border-primary/20 shadow-[0_0_15px_rgba(208,239,25,0.15)] overflow-hidden shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{asset.symbol}</h1>
              {asset.isolated && <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/30">ISOLATED</Badge>}
              {asset.isEquity && (
                <Badge variant="outline" className={`border-transparent ${isMarketOpen ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isMarketOpen ? 'NYSE OPEN' : 'NYSE CLOSED'}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground text-sm sm:text-lg">{asset.name}</div>
            <Badge variant="outline" className="text-[11px] mt-1">{asset.tier}</Badge>
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1 flex items-center gap-1 md:justify-end">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {isFrozen ? 'Last close price' : `Live · ${asset.oracleSource}`}
          </div>
          <div className="text-2xl sm:text-3xl font-mono">{formatUsd(asset.priceUsd)}</div>
          {isFrozen
            ? <div className="text-xs sm:text-sm font-mono text-muted-foreground mt-1">Frozen while NYSE closed</div>
            : <div className={`text-xs sm:text-sm font-mono mt-1 ${asset.priceChange24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {asset.priceChange24h >= 0 ? '+' : ''}{formatPercent(asset.priceChange24h)} (24h)
              </div>}
        </div>
      </div>

      {/* ── Equity closed callout ── */}
      {asset.isEquity && !isMarketOpen && (
        <div className="bg-muted p-4 rounded-lg flex items-start gap-3 border border-border">
          <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Stock Token market is closed</h3>
            <p className="text-sm text-muted-foreground">
              {asset.symbol} follows US market hours. New borrows against this asset are paused while the underlying market is closed.
              This protects you from stale prices. You can still supply or repay.
            </p>
          </div>
        </div>
      )}

      {/* ── Isolated callout ── */}
      {asset.isolated && (
        <div className="bg-yellow-400/10 p-4 rounded-lg flex items-start gap-3 border border-yellow-400/20 text-yellow-400">
          <Shield className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm opacity-80">
            Isolated market. Collateral here cannot be mixed with the Main Market. Losses are strictly contained.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: stats + charts ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Parameter grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Max LTV',         value: formatPercent(asset.ltv),                   tip: 'Max you can borrow as % of collateral' },
              { label: 'Liq Threshold',   value: formatPercent(asset.liquidationThreshold),   tip: 'HF drops below 1.0 at this level' },
              { label: 'Liq Bonus',       value: formatPercent(asset.liquidationBonus),        tip: 'Bonus paid to liquidators' },
              { label: 'Supply APY',      value: formatPercent(supplyApy),                    tip: 'Current annualised yield for suppliers' },
              { label: 'Borrow APR',      value: formatPercent(borrowApr),                    tip: 'Current annualised cost for borrowers' },
              { label: 'Utilization',     value: formatPercent(utilization),                  tip: 'Borrowed / Supplied' },
              { label: 'Supply Cap Used', value: formatPercent(supplyUsed),                   tip: 'Protocol cap on total supply' },
              { label: 'Borrow Cap Used', value: formatPercent(borrowUsed),                   tip: 'Protocol cap on total borrows' },
            ].map(({ label, value, tip }) => (
              <Card key={label} className="bg-card">
                <CardContent className="p-4 space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center justify-between" title={tip}>
                    {label} <Info className="h-3 w-3 opacity-60" />
                  </div>
                  <div className="text-xl font-mono">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Interest rate model — real contract parameters */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle>Interest Rate Model</CardTitle>
              <CardDescription>
                Kinked curve: borrow APR = 6.5% at 80% utilization, then +60% slope above.
                The marker shows current pool utilization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curveData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                    <XAxis dataKey="u" stroke="#444" tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `${v}%`} />
                    <YAxis stroke="#444" tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                      formatter={(v: number) => [`${v.toFixed(2)}%`]}
                      labelFormatter={l => `U: ${Number(l).toFixed(0)}%`}
                    />
                    <ReferenceLine x={currentU} stroke="#D0EF19" strokeDasharray="3 3"
                      label={{ position: 'top', value: 'Now', fill: '#D0EF19', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                    <Line type="monotone" dataKey="supplyApy"  stroke="#D0EF19" strokeWidth={2} dot={false} name="Supply APY" />
                    <Line type="monotone" dataKey="borrowApr" stroke="#FF4D4D"  strokeWidth={2} dot={false} name="Borrow APR" />
                    <ReferenceDot x={currentU} y={supplyApy * 100} r={5} fill="#D0EF19" stroke="#D0EF19" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 justify-center text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary inline-block rounded" /> Supply APY</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-destructive inline-block rounded" /> Borrow APR</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: action box + liquidity ── */}
        <div className="space-y-5">
          <Card className="bg-card border-primary/20">
            <CardHeader><CardTitle>Interact with {asset.symbol}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full h-11 text-base gap-2" onClick={() => setModal({ type: 'Supply' })}>
                <ArrowDownToLine className="h-4 w-4" /> Supply
              </Button>
              <Button variant="outline" className="w-full h-11 text-base gap-2"
                disabled={isFrozen}
                onClick={() => setModal({ type: 'Borrow' })}>
                <Banknote className="h-4 w-4" />
                {isFrozen ? 'Borrow (market closed)' : 'Borrow'}
              </Button>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <Button variant="ghost" className="text-muted-foreground hover:text-black active:text-black gap-1.5" onClick={() => setModal({ type: 'Withdraw' })}>
                  <ArrowUpFromLine className="h-3.5 w-3.5" /> Withdraw
                </Button>
                <Button variant="ghost" className="text-muted-foreground hover:text-black active:text-black gap-1.5" onClick={() => setModal({ type: 'Repay' })}>
                  <CornerUpLeft className="h-3.5 w-3.5" /> Repay
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Pool Liquidity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Total Supplied</span>
                  <span className="font-mono">{formatToken(asset.totalSupplied, 0)}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${supplyUsed * 100}%` }} />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 text-right">cap {formatToken(asset.supplyCap, 0)}</div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Total Borrowed</span>
                  <span className="font-mono">{formatToken(asset.totalBorrowed, 0)}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400/70" style={{ width: `${borrowUsed * 100}%` }} />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 text-right">cap {formatToken(asset.borrowCap, 0)}</div>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-mono">{formatPercent(utilization)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Oracle</span>
                  <span className="font-mono text-xs text-primary">
                    {isFrozen ? 'Last close price' : asset.oracleSource}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {modal && (
        <ActionModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          asset={asset}
          actionType={modal.type}
        />
      )}
    </div>
  );
}
