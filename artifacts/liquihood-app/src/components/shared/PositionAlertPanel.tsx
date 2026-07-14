/**
 * PositionAlertPanel — compact alert strip + slim P&L bar.
 * HF alert only fires when genuinely dangerous (< 1.50).
 * P&L shown as a quiet single line, no big red panels.
 */

import React from 'react'
import { AlertTriangle, ShieldAlert, ShieldCheck, TrendingUp, TrendingDown, Minus, ShieldPlus, CornerUpLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/utils'
import type { MarketState, UserPosition } from '@/lib/protocol'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  positions: UserPosition[]
  assets: MarketState[]
  hf: number
  totalCollateral: number
  totalDebt: number
  isMarketOpen: boolean
  onRepay: (assetId: string) => void
  onAddCollateral: (assetId: string) => void
}

// ─── PnL badge used in rows ───────────────────────────────────────────────────

export function PnLBadge({ change24h, size = 'sm' }: { change24h: number; size?: 'xs' | 'sm' }) {
  const isPos = change24h >= 0
  const pct   = (change24h * 100).toFixed(2)
  const Icon  = isPos ? TrendingUp : change24h === 0 ? Minus : TrendingDown

  if (size === 'xs') {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono font-medium
        ${isPos ? 'text-primary' : 'text-red-400'}`}>
        <Icon className="h-2.5 w-2.5" />
        {isPos ? '+' : ''}{pct}%
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium
      ${isPos
        ? 'bg-primary/8 text-primary border border-primary/15'
        : 'bg-red-500/8 text-red-400 border border-red-500/15'
      }`}>
      <Icon className="h-2.5 w-2.5" />
      {isPos ? '+' : ''}{pct}%
    </span>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PositionAlertPanel({
  positions, assets, hf, totalCollateral, totalDebt, isMarketOpen, onRepay, onAddCollateral,
}: Props) {
  const hasDebt     = totalDebt > 0.01
  const hasPositions = positions.some(p => p.supplied > 0 || p.borrowed > 0)
  if (!hasPositions) return null

  // ── HF severity ─────────────────────────────────────────────────────────────
  const isCritical = hasDebt && hf < 1.10
  const isDanger   = hasDebt && hf >= 1.10 && hf < 1.30
  const isCaution  = hasDebt && hf >= 1.30 && hf < 1.50

  // ── 24h P&L ─────────────────────────────────────────────────────────────────
  let net24h = 0
  positions.forEach(p => {
    const a = assets.find(x => x.id === p.assetId)
    if (!a) return
    if (p.supplied > 0) net24h += p.supplied  * a.priceUsd *  a.priceChange24h
    if (p.borrowed > 0) net24h -= p.borrowed  * a.priceUsd *  a.priceChange24h
  })
  const pnlPos = net24h >= 0

  // Action targets
  const topBorrow = positions
    .filter(p => p.borrowed > 0)
    .map(p => ({ ...p, usd: p.borrowed * (assets.find(a => a.id === p.assetId)?.priceUsd ?? 0) }))
    .sort((a, b) => b.usd - a.usd)[0]
  const topCollateral = positions
    .filter(p => p.supplied > 0)
    .map(p => ({ ...p, usd: p.supplied * (assets.find(a => a.id === p.assetId)?.priceUsd ?? 0) }))
    .sort((a, b) => b.usd - a.usd)[0]

  return (
    <div className="space-y-2">

      {/* ── HF alert strip — only when dangerous ─────────────────────────────── */}
      {(isCritical || isDanger || isCaution) && (
        <div className={`
          rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3
          animate-in slide-in-from-top-1 fade-in duration-300
          ${isCritical ? 'border-red-500/50 bg-red-500/6' : isDanger ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-orange-400/30 bg-orange-400/4'}
        `}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full shrink-0
              ${isCritical ? 'bg-red-500/15' : isDanger ? 'bg-yellow-400/15' : 'bg-orange-400/15'}`}>
              {isCritical
                ? <ShieldAlert className="h-4 w-4 text-red-400" />
                : <AlertTriangle className={`h-4 w-4 ${isDanger ? 'text-yellow-400' : 'text-orange-400'}`} />
              }
            </div>
            <div>
              <div className={`text-sm font-semibold leading-tight
                ${isCritical ? 'text-red-400' : isDanger ? 'text-yellow-400' : 'text-orange-400'}`}>
                {isCritical ? 'Near Liquidation' : isDanger ? 'Liquidation Risk' : 'Monitor Closely'}
                <span className="font-mono text-xs ml-2 opacity-70">HF {hf.toFixed(3)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {isCritical
                  ? 'Add collateral or repay now to avoid liquidation.'
                  : isDanger
                  ? 'Health Factor below 1.30 — act soon.'
                  : 'Health Factor between 1.30–1.50, watch price movements.'}
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {topBorrow && (
              <Button size="sm" variant="outline"
                className={`h-7 text-xs gap-1 ${isCritical ? 'border-red-500/40 text-red-400' : isDanger ? 'border-yellow-400/40 text-yellow-400' : 'border-orange-400/40 text-orange-400'}`}
                onClick={() => onRepay(topBorrow.assetId)}>
                <CornerUpLeft className="h-3 w-3" /> Repay
              </Button>
            )}
            {topCollateral && (
              <Button size="sm"
                className={`h-7 text-xs gap-1 text-black font-semibold
                  ${isCritical ? 'bg-red-400 hover:bg-red-300' : isDanger ? 'bg-yellow-400 hover:bg-yellow-300' : 'bg-orange-400 hover:bg-orange-300'}`}
                onClick={() => onAddCollateral(topCollateral.assetId)}>
                <ShieldPlus className="h-3 w-3" /> Add Collateral
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Slim P&L strip ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/40 bg-card px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          {pnlPos
            ? <TrendingUp className="h-3.5 w-3.5 text-primary" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          }
          <span className="text-xs text-muted-foreground">24h P&amp;L</span>
          <span className={`text-sm font-mono font-semibold ${pnlPos ? 'text-primary' : 'text-red-400'}`}>
            {pnlPos ? '+' : ''}{formatUsd(net24h)}
          </span>
        </div>

        <div className="h-4 w-px bg-border/50 shrink-0" />

        {/* Per-asset chips */}
        <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
          {positions
            .filter(p => p.supplied > 0 || p.borrowed > 0)
            .slice(0, 6)
            .map(p => {
              const a = assets.find(x => x.id === p.assetId)
              if (!a) return null
              const isPos = a.priceChange24h >= 0
              return (
                <span key={p.assetId}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono
                    ${isPos ? 'text-primary/70' : 'text-red-400/70'}`}>
                  {a.symbol} {isPos ? '+' : ''}{(a.priceChange24h * 100).toFixed(2)}%
                </span>
              )
            })}
        </div>

        {/* Healthy badge (only when has debt and safe) */}
        {hasDebt && hf >= 1.50 && (
          <div className="ml-auto shrink-0 flex items-center gap-1 text-primary text-[11px] font-mono">
            <ShieldCheck className="h-3 w-3" />
            <span>HF {hf > 99 ? '∞' : hf.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
