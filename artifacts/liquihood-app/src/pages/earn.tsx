import React, { useMemo, useState } from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatUsd, formatPercent, formatToken } from '@/lib/utils';
import { ActionModal } from '@/components/shared/ActionModal';
import { AssetIcon } from '@/components/shared/AssetIcon';
import { calculateRates, MarketState } from '@/lib/protocol';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';
import {
  ArrowDownToLine, ArrowUpFromLine, Wallet, Info,
  TrendingUp, Coins, BarChart3, ShieldAlert,
  Vote, Zap, Shield, Users, ExternalLink, Copy, Check,
  Sparkles, ChevronRight, Star,
} from 'lucide-react';
import { useLHOODBalance, useLHOODTotalSupply } from '@/hooks/use-on-chain-data';
import { LHOOD_TOKEN } from '@/lib/contracts';

// ── Tier colour helpers ─────────────────────────────────────────────────────
const tierColor: Record<string, string> = {
  Stablecoin: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  Crypto:     'text-blue-400   border-blue-400/30   bg-blue-400/10',
  Equity:     'text-violet-400 border-violet-400/30 bg-violet-400/10',
  Speculative:'text-amber-400  border-amber-400/30  bg-amber-400/10',
};
const tierDot: Record<string, string> = {
  Stablecoin: 'bg-emerald-400',
  Crypto:     'bg-blue-400',
  Equity:     'bg-violet-400',
  Speculative:'bg-amber-400',
};

// ── $LHOOD holder tier system ────────────────────────────────────────────────
const LHOOD_TIERS = [
  { name: 'None',    min: 0,        next: 1_000,   icon: '—',  emoji: null,
    discount: 0,   color: 'text-muted-foreground', ring: 'border-border',
    bg: 'bg-muted/20', perks: [] },
  { name: 'Bronze',  min: 1_000,    next: 10_000,  icon: '🥉', emoji: '🥉',
    discount: 0.5, color: 'text-amber-600',        ring: 'border-amber-600/40',
    bg: 'bg-amber-600/8', perks: ['0.5% borrow rate discount', 'Governance voting access'] },
  { name: 'Silver',  min: 10_000,   next: 50_000,  icon: '🥈', emoji: '🥈',
    discount: 1.0, color: 'text-slate-300',        ring: 'border-slate-300/40',
    bg: 'bg-slate-300/8', perks: ['1% borrow rate discount', 'Governance voting access', 'Early market proposals'] },
  { name: 'Gold',    min: 50_000,   next: 200_000, icon: '🥇', emoji: '🥇',
    discount: 2.0, color: 'text-yellow-400',       ring: 'border-yellow-400/40',
    bg: 'bg-yellow-400/8', perks: ['2% borrow rate discount', 'Governance voting access', 'Priority keeper slots', 'Boosted LP incentives'] },
  { name: 'Diamond', min: 200_000,  next: null,    icon: '💎', emoji: '💎',
    discount: 3.0, color: 'text-cyan-400',         ring: 'border-cyan-400/40',
    bg: 'bg-cyan-400/8', perks: ['3% borrow rate discount', 'Max governance weight', 'Priority keeper slots', 'Max LP incentive boost', 'Insurance fund governance'] },
] as const;

function getLHOODTier(balance: number) {
  for (let i = LHOOD_TIERS.length - 1; i >= 0; i--) {
    if (balance >= LHOOD_TIERS[i].min) return LHOOD_TIERS[i];
  }
  return LHOOD_TIERS[0];
}


// ── Interest-rate curve data (static, same model for all assets) ────────────
const CURVE_DATA = Array.from({ length: 101 }, (_, i) => {
  const u    = i / 100;
  const bApr = u <= 0.8 ? (u / 0.8) * 0.065 : 0.065 + ((u - 0.8) / 0.2) * 0.60;
  const sApy = bApr * u * 0.90;
  return { utilization: u * 100, supplyApy: sApy * 100, borrowApr: bApr * 100 };
});

// ── PoolRow ─────────────────────────────────────────────────────────────────
interface PoolRowProps {
  asset:    MarketState;
  supplied: number;
  interest: number;
  onSupply:   () => void;
  onWithdraw: () => void;
}

function PoolRow({ asset, supplied, interest, onSupply, onWithdraw }: PoolRowProps) {
  const { utilization, supplyApy, borrowApr } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
  const tvlUsd    = asset.totalSupplied * asset.priceUsd;
  const hasDeposit = supplied > 0;
  const depositUsd = supplied * asset.priceUsd;

  return (
    <div className={`rounded-xl border bg-card p-4 sm:p-5 transition-all hover:border-primary/20 ${hasDeposit ? 'border-primary/20 shadow-[0_0_12px_rgba(208,239,25,0.04)]' : 'border-border'}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <AssetIcon
            assetId={asset.id}
            symbol={asset.symbol}
            className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-bold border border-border bg-muted/30 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{asset.symbol}</span>
              <Badge variant="outline" className={`text-[10px] h-4 px-1.5 font-mono ${tierColor[asset.tier] ?? ''}`}>
                {asset.tier}
              </Badge>
              {asset.isolated && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-400/30 bg-amber-400/10">
                  Isolated
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">{asset.name}</div>
          </div>
        </div>

        {/* APY — prominent */}
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground mb-0.5">Supply APY</div>
          <div className="text-2xl font-mono font-bold text-primary leading-none">
            {formatPercent(supplyApy)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
            Borrow {formatPercent(borrowApr)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-xs">
        {/* Utilization */}
        <div>
          <div className="text-muted-foreground mb-1">Utilization</div>
          <div className="font-mono font-medium mb-1">{formatPercent(utilization)}</div>
          <Progress value={utilization * 100} className="h-1" />
        </div>

        {/* Pool Size */}
        <div>
          <div className="text-muted-foreground mb-1">Pool Size</div>
          <div className="font-mono font-medium">{formatUsd(tvlUsd, true)}</div>
          <div className="text-muted-foreground/60 font-mono">
            {formatToken(asset.totalSupplied, 0)} {asset.symbol}
          </div>
        </div>

        {/* Your deposit */}
        <div className="col-span-2 sm:col-span-1">
          <div className="text-muted-foreground mb-1">Your Deposit</div>
          {hasDeposit ? (
            <>
              <div className="font-mono font-medium">{formatUsd(depositUsd, true)}</div>
              {interest > 0 && (
                <div className="text-primary font-mono text-[10px] flex items-center gap-1 mt-0.5">
                  +{formatToken(interest, 4)} {asset.symbol} earned
                  <span className="animate-pulse">●</span>
                </div>
              )}
            </>
          ) : (
            <div className="font-mono text-muted-foreground/40 text-xs">None</div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={onSupply}>
          <ArrowDownToLine className="h-3.5 w-3.5" /> Supply
        </Button>
        {hasDeposit && (
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={onWithdraw}>
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Withdraw
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function EarnPage() {
  const { assets, positions, transactions, walletAddress, connectWallet, lhoodPrice, lhoodChange24h } = useProtocol();
  const lhoodBalance   = useLHOODBalance(walletAddress as `0x${string}` | undefined);
  const lhoodTotalSupply = useLHOODTotalSupply();
  const [caCopied, setCaCopied] = useState(false);
  const copyCA = () => {
    navigator.clipboard.writeText(LHOOD_TOKEN);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  };
  const [modal, setModal] = useState<{ assetId: string; type: 'Supply' | 'Withdraw' } | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  // ── Per-asset metrics ──────────────────────────────────────────────────
  const poolData = useMemo(() => {
    return assets.map(asset => {
      const pos       = positions.find(p => p.assetId === asset.id);
      const supplied  = pos?.supplied ?? 0;
      // Interest earned = current supplied - net deposited (sum of Supply - Withdraw txs)
      const netDep    = transactions
        .filter(t => t.assetId === asset.id)
        .reduce((acc, t) => {
          if (t.type === 'Supply')   return acc + t.amount;
          if (t.type === 'Withdraw') return acc - t.amount;
          return acc;
        }, 0);
      const interest  = Math.max(0, supplied - netDep);
      const { supplyApy } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
      return { asset, supplied, interest, supplyApy };
    });
  }, [assets, positions, transactions]);

  // ── Summary stats (wallet only) ────────────────────────────────────────
  const summary = useMemo(() => {
    let totalDeposited = 0, totalInterest = 0, weightedApy = 0;
    poolData.forEach(({ asset, supplied, interest, supplyApy }) => {
      const usd = supplied * asset.priceUsd;
      totalDeposited += usd;
      totalInterest  += interest * asset.priceUsd;
      weightedApy    += usd * supplyApy;
    });
    const avgApy = totalDeposited > 0 ? weightedApy / totalDeposited : 0;
    return { totalDeposited, totalInterest, avgApy };
  }, [poolData]);

  // ── Sort & filter — only assets where real borrowing happens ────────────
  // Equity assets (AAPL-T, TSLA-T, HOOD-T) and isolated speculative assets
  // (DOGE, MEME-1) are collateral-only — no one borrows them, APY = 0%.
  // Only USDG, ETH, WETH are main-market assets with actual borrow demand.
  const visible = useMemo(() => {
    let rows = poolData.filter(r => !r.asset.isolated && !r.asset.isEquity);
    if (filter === 'mine') rows = rows.filter(r => r.supplied > 0);
    // Sort: user positions first, then USDG first (primary LP asset), then by APY desc
    rows.sort((a, b) => {
      if (a.supplied > 0 && b.supplied === 0) return -1;
      if (a.supplied === 0 && b.supplied > 0) return 1;
      if (a.asset.id === 'usd-g') return -1;
      if (b.asset.id === 'usd-g') return 1;
      return b.supplyApy - a.supplyApy;
    });
    return rows;
  }, [poolData, filter]);

  // ── Interest rate chart utilization for USDG (representative) ─────────
  const { utilization: usdgUtil, supplyApy: usdgApy } = useMemo(() => {
    const usdg = assets.find(a => a.id === 'usd-g');
    if (!usdg) return { utilization: 0, supplyApy: 0 };
    return calculateRates(usdg.totalSupplied, usdg.totalBorrowed);
  }, [assets]);

  const modalAsset = modal ? assets.find(a => a.id === modal.assetId) : null;

  // ── LHOOD tier + real-time protocol fee share ──────────────────────────
  const lhoodTier = getLHOODTier(lhoodBalance ?? 0);

  const protocolDailyFeeUsd = useMemo(() => {
    // 10% reserve factor on borrow interest = protocol gross revenue.
    // 50% of that is earmarked for LHOOD stakers (other 50% → insurance fund).
    // → effective staker fee rate = 5% of borrow interest per day.
    return assets.reduce((sum, asset) => {
      const { borrowApr } = calculateRates(asset.totalSupplied, asset.totalBorrowed);
      const borrowedUsd = asset.totalBorrowed * asset.priceUsd;
      const dailyInterest = borrowedUsd * borrowApr / 365;
      return sum + dailyInterest * 0.05; // 5% to stakers
    }, 0);
  }, [assets]);

  const feeShare = useMemo(() => {
    const bal = lhoodBalance ?? 0;
    const total = lhoodTotalSupply ?? 0;
    if (bal === 0 || total === 0) return { ratio: 0, daily: 0, weekly: 0, monthly: 0 };
    const ratio = bal / total;
    const daily = protocolDailyFeeUsd * ratio;
    return { ratio, daily, weekly: daily * 7, monthly: daily * 30 };
  }, [lhoodBalance, lhoodTotalSupply, protocolDailyFeeUsd]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="space-y-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" /> Earn
        </h1>
        <p className="text-muted-foreground text-sm">
          Supply assets to the lending pool and earn real yield from borrowers. Only main-market assets generate interest. USDG is the primary LP opportunity.
        </p>
      </div>

      {/* ── $LHOOD Governance Token Card ── */}
      <Card className="border-primary/20 bg-card shadow-[0_0_24px_rgba(208,239,25,0.04)]">
        <CardContent className="p-5">
          {/* Top row: logo + name + price + balance */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                <img src="/liquihood-app/logo.png" alt="LHOOD" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base">$LHOOD</span>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Governance Token</Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-mono font-semibold">
                    {lhoodPrice > 0 ? `${lhoodPrice.toFixed(4)}` : '—'}
                  </span>
                  {lhoodChange24h !== 0 && (
                    <span className={`text-xs font-mono ${lhoodChange24h >= 0 ? 'text-primary' : 'text-red-400'}`}>
                      {lhoodChange24h >= 0 ? '+' : ''}{(lhoodChange24h * 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              {walletAddress && lhoodBalance != null ? (
                <>
                  <p className="text-xs text-muted-foreground mb-0.5">Your Balance</p>
                  <p className="font-mono font-bold text-lg leading-none">
                    {lhoodBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    ≈ {formatUsd(lhoodBalance * lhoodPrice)}
                  </p>
                </>
              ) : walletAddress ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (
                <Button size="sm" variant="outline" onClick={connectWallet} className="gap-1.5 w-full sm:w-auto">
                  <Wallet className="h-3.5 w-3.5" /> Connect to see balance
                </Button>
              )}
            </div>
          </div>

          {/* CA row */}
          <button
            onClick={copyCA}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30 hover:border-primary/30 transition-colors mb-5 group"
          >
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Contract Address</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground/70">{LHOOD_TOKEN.slice(0,10)}…{LHOOD_TOKEN.slice(-6)}</span>
              {caCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />}
            </div>
          </button>

          {/* Utility grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Static planned features */}
            {[
              { icon: Vote,   label: 'Governance',           desc: 'Vote on risk params, markets & fees' },
              { icon: Zap,    label: 'Keeper Network',        desc: 'Bond LHOOD, earn keeper fees on-chain' },
              { icon: Shield, label: 'Insurance Backstop',   desc: 'Governance controls Insurance Fund params' },
              { icon: Coins,  label: 'Liquidity Incentives', desc: 'Rewards for suppliers & borrowers' },
              { icon: Users,  label: 'Staking',              desc: 'Lock LHOOD for revenue share & boosted votes' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-primary/70" strokeWidth={1.5} />
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
                    Planned
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}

            {/* Fee Sharing — LIVE card */}
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.5} />
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                  Live
                </Badge>
              </div>
              <p className="text-xs font-semibold text-foreground leading-tight">Fee Sharing</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Protocol earns{' '}
                <span className="font-mono text-primary font-semibold">
                  {protocolDailyFeeUsd < 0.0001
                    ? '$0.00'
                    : `${formatUsd(protocolDailyFeeUsd)}`}
                </span>
                /day from borrows → distributed to LHOOD stakers
              </p>
            </div>
          </div>

          {/* Buy link */}
          <a
            href="https://app.virtuals.io"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors"
          >
            Buy $LHOOD on Virtuals Protocol
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* ── LHOOD Holder Benefits ── */}
      <Card className={`border ${lhoodTier.ring} bg-card transition-all`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> $LHOOD Holder Benefits
            <Badge variant="outline" className="ml-auto text-[10px] border-primary/30 text-primary">Live Preview</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Your real-time estimated share of protocol fees — based on current borrow volume. Fee distribution activates when staking goes live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Tier badge + balance */}
          <div className={`rounded-xl border ${lhoodTier.ring} ${lhoodTier.bg} p-4 flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <div className="text-3xl leading-none">{lhoodTier.emoji ?? '—'}</div>
              <div>
                <div className={`text-sm font-bold ${lhoodTier.color}`}>{lhoodTier.name} Tier</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(lhoodBalance ?? 0) > 0
                    ? `${(lhoodBalance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} $LHOOD held`
                    : walletAddress ? 'No $LHOOD in wallet' : 'Connect wallet to check tier'}
                </div>
              </div>
            </div>
            {lhoodTier.discount > 0 && (
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">Borrow Discount</div>
                <div className={`text-xl font-mono font-bold ${lhoodTier.color}`}>−{lhoodTier.discount}%</div>
              </div>
            )}
          </div>

          {/* Progress to next tier */}
          {lhoodTier.name !== 'Diamond' && (() => {
            const tierIdx = LHOOD_TIERS.findIndex(t => t.name === lhoodTier.name);
            const nextTier = LHOOD_TIERS[tierIdx + 1];
            const bal = lhoodBalance ?? 0;
            const progress = Math.min(100, (bal / nextTier.min) * 100);
            const needed = Math.max(0, nextTier.min - bal);
            return (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Progress to {nextTier.emoji} {nextTier.name}</span>
                  <span className="font-mono text-muted-foreground">{needed > 0 ? `${needed.toLocaleString('en-US', { maximumFractionDigits: 0 })} more` : 'Unlocked!'}</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            );
          })()}

          {/* Real-time fee share */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-foreground">Your Real-time Fee Share Estimate</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 ml-auto cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs">
                  Calculated from live borrow volume × borrow APR × 10% reserve factor. Your share = your LHOOD ÷ total supply. Actual distribution pending staking launch.
                </TooltipContent>
              </Tooltip>
            </div>
            {walletAddress && (lhoodBalance ?? 0) > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Daily',   value: feeShare.daily },
                  { label: 'Weekly',  value: feeShare.weekly },
                  { label: 'Monthly', value: feeShare.monthly },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">{label}</div>
                    <div className="font-mono font-bold text-primary text-lg leading-none">
                      {value < 0.001 ? '<$0.001' : formatUsd(value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-muted-foreground">
                {walletAddress
                  ? <span>Hold $LHOOD to see your fee share estimate</span>
                  : <Button size="sm" variant="ghost" onClick={connectWallet} className="text-primary gap-1.5 h-7 text-xs"><Wallet className="h-3 w-3" /> Connect wallet</Button>
                }
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>Protocol daily fees (live)</span>
              <span className="text-foreground/60">{protocolDailyFeeUsd < 0.0001 ? '$0.00 (no borrows yet)' : formatUsd(protocolDailyFeeUsd)}</span>
            </div>
          </div>

          {/* Tier perks */}
          {lhoodTier.perks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">Your Active Perks (when live)</p>
              <div className="space-y-1.5">
                {lhoodTier.perks.map(perk => (
                  <div key={perk} className="flex items-center gap-2 text-xs">
                    <Check className={`h-3.5 w-3.5 shrink-0 ${lhoodTier.color}`} />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier table */}
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1 select-none">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              View all tiers
            </summary>
            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-mono text-muted-foreground font-medium">Tier</th>
                    <th className="text-right px-3 py-2 font-mono text-muted-foreground font-medium">Min $LHOOD</th>
                    <th className="text-right px-3 py-2 font-mono text-muted-foreground font-medium">Borrow Disc.</th>
                  </tr>
                </thead>
                <tbody>
                  {LHOOD_TIERS.filter(t => t.name !== 'None').map(t => (
                    <tr key={t.name} className={`border-b border-border/50 last:border-0 ${lhoodTier.name === t.name ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <span>{t.emoji}</span>
                        <span className={`font-semibold ${t.color}`}>{t.name}</span>
                        {lhoodTier.name === t.name && <Badge variant="outline" className="text-[9px] px-1.5 border-primary/30 text-primary ml-1">You</Badge>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{t.min.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${t.color}`}>−{t.discount}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

        </CardContent>
      </Card>

      {/* ── Summary (only shown when wallet connected + has a deposit) ── */}
      {walletAddress && summary.totalDeposited > 0 && (
        <div className="grid grid-cols-3 gap-0 rounded-xl border border-primary/20 bg-card overflow-hidden shadow-[0_0_20px_rgba(208,239,25,0.05)]">
          {[
            { label: 'Total Supplied',  value: formatUsd(summary.totalDeposited),           icon: <ArrowDownToLine className="h-4 w-4" />, color: '' },
            { label: 'Interest Earned', value: formatUsd(summary.totalInterest),             icon: <TrendingUp className="h-4 w-4" />,       color: 'text-primary' },
            { label: 'Weighted APY',    value: formatPercent(summary.avgApy),                icon: <BarChart3 className="h-4 w-4" />,         color: 'text-primary' },
          ].map((item, i) => (
            <div key={item.label} className={`px-4 py-4 flex flex-col gap-1 ${i < 2 ? 'border-r border-border/50' : ''}`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {item.icon} {item.label}
              </div>
              <div className={`text-xl font-mono font-semibold leading-tight ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Connect prompt ── */}
      {!walletAddress && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Connect your wallet to start earning</p>
              <p className="text-xs text-muted-foreground">You can still browse all pools below.</p>
            </div>
          </div>
          <Button size="sm" onClick={connectWallet} className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 shrink-0">
            <Wallet className="h-3.5 w-3.5" /> Connect
          </Button>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-2">
        {([['all', 'All Pools'], ['mine', 'My Deposits']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              filter === val
                ? 'bg-primary text-black'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {label}
            {val === 'mine' && summary.totalDeposited > 0 && (
              <span className="ml-1.5 bg-black/20 text-[10px] px-1.5 py-0.5 rounded-full">
                {poolData.filter(r => r.supplied > 0).length}
              </span>
            )}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className={`h-1.5 w-1.5 rounded-full ${tierDot.Stablecoin}`} /> Stable
          <div className={`h-1.5 w-1.5 rounded-full ${tierDot.Crypto} ml-2`} /> Crypto
          <div className={`h-1.5 w-1.5 rounded-full ${tierDot.Equity} ml-2`} /> Equity
        </div>
      </div>

      {/* Isolated assets are excluded — they can't be borrowed, so APY = 0% always.
          They appear on Markets as collateral options, not here as yield sources. */}

      {/* ── Pool list ── */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {filter === 'mine' ? "You haven't supplied to any pool yet." : 'No pools available.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visible.map(({ asset, supplied, interest }) => (
            <PoolRow
              key={asset.id}
              asset={asset}
              supplied={supplied}
              interest={interest}
              onSupply={()   => setModal({ assetId: asset.id, type: 'Supply' })}
              onWithdraw={() => setModal({ assetId: asset.id, type: 'Withdraw' })}
            />
          ))}
        </div>
      )}

      {/* ── Interest Rate Model ── */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Interest Rate Model
          </CardTitle>
          <CardDescription className="text-xs">
            Kinked curve: rates rise gradually up to 80% utilization, then spike sharply to protect pool liquidity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CURVE_DATA} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="utilization"
                  stroke="#333"
                  tick={{ fill: '#666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={v => `${v}%`}
                />
                <YAxis
                  stroke="#333"
                  tick={{ fill: '#666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={v => `${v}%`}
                />
                <RTooltip
                  contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                  itemStyle={{ color: '#EDEDED' }}
                  formatter={(val: number) => [`${val.toFixed(2)}%`]}
                  labelFormatter={l => `Utilization: ${Number(l).toFixed(0)}%`}
                />
                <ReferenceLine
                  x={usdgUtil * 100}
                  stroke="#D0EF19"
                  strokeDasharray="4 2"
                  label={{ position: 'top', value: 'USDG', fill: '#D0EF19', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                />
                <Line type="monotone" dataKey="supplyApy" stroke="#D0EF19" strokeWidth={2} dot={false} name="Supply APY" />
                <Line type="monotone" dataKey="borrowApr" stroke="#FF4D4D" strokeWidth={2} dot={false} name="Borrow APR" />
                <ReferenceDot x={usdgUtil * 100} y={usdgApy * 100} r={4} fill="#D0EF19" stroke="#D0EF19" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 mt-2 justify-center text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-primary inline-block rounded" /> Supply APY</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-destructive inline-block rounded" /> Borrow APR</span>
          </div>
        </CardContent>
      </Card>

      {/* ── How To: Supply & Withdraw ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary px-2">Chapter 01</Badge>
          </div>
          <CardTitle className="text-lg font-bold">How to Supply & Withdraw on Liquihood</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Supplying lets you earn passive interest from borrowers. Your tokens work for you 24/7 — no staking, no locking, no manual claiming.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">

          {/* Supply steps */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 font-mono mb-3">Supplying (Deposit)</p>
            <div className="space-y-3">
              {[
                {
                  n: '1',
                  title: 'Connect your wallet',
                  desc: 'Click "Connect Wallet" in the top-right corner. Choose your wallet app (e.g. MetaMask, Privy). Make sure you\'re on Robinhood Chain — the app will prompt you to switch if needed.',
                },
                {
                  n: '2',
                  title: 'Pick an asset and click "Supply"',
                  desc: 'Find the token you want to deposit in the pool list below. Click the green Supply button on its card. WETH and USDG are the main markets with active yield.',
                },
                {
                  n: '3',
                  title: 'Approve the token (first time only)',
                  desc: 'If it\'s your first time supplying this token, you\'ll need to sign one Approve transaction. This gives Liquihood permission to move that token on your behalf. You only do this once per token.',
                },
                {
                  n: '4',
                  title: 'Confirm the Supply transaction',
                  desc: 'Enter how much you want to supply, then confirm the transaction in your wallet. Once it\'s mined on-chain, your position is live and starts earning interest immediately.',
                },
                {
                  n: '5',
                  title: 'Watch your balance grow',
                  desc: 'Interest accrues every block — automatically. No claiming needed. Your supplied balance on the Dashboard reflects the growing amount in real time.',
                },
              ].map(step => (
                <div key={step.n} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[10px] font-mono font-bold text-primary">{step.n}</span>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground mb-0.5">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Withdraw steps */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/70 font-mono mb-3">Withdrawing</p>
            <div className="space-y-3">
              {[
                {
                  n: '1',
                  title: 'Go to Earn and find your position',
                  desc: 'Switch the filter to "My Positions" to see only the assets you\'ve supplied. Each card shows your current balance including interest earned so far.',
                },
                {
                  n: '2',
                  title: 'Click "Withdraw"',
                  desc: 'Click the Withdraw button on the asset card. Enter the amount you want to take out — you can withdraw a partial amount or everything at once.',
                },
                {
                  n: '3',
                  title: 'Confirm the transaction',
                  desc: 'Approve the transaction in your wallet. The protocol sends your tokens back plus all accrued interest in the same transaction. No separate claim step.',
                },
              ].map(step => (
                <div key={step.n} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                    <span className="text-[10px] font-mono font-bold text-blue-400">{step.n}</span>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground mb-0.5">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Key facts */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground font-mono mb-3">Good to Know</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'No lock-up period',   desc: 'Withdraw anytime, as long as there is liquidity available in the pool.' },
                { label: 'Interest auto-compounds', desc: 'Every block, borrower interest is added to your balance. Nothing to claim.' },
                { label: 'You keep your upside', desc: 'You earn the full interest rate shown on the card — no platform cut taken from suppliers.' },
              ].map(fact => (
                <div key={fact.label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-primary mb-1">{fact.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{fact.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── Modal ── */}
      {modal && modalAsset && (
        <ActionModal
          isOpen
          onClose={() => setModal(null)}
          asset={modalAsset}
          actionType={modal.type}
        />
      )}
    </div>
  );
}
