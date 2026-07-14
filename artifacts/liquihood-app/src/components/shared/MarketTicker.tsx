import { useProtocol } from '@/hooks/use-protocol'
import { AssetIcon } from './AssetIcon'

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1)    return p.toFixed(2)
  if (p >= 0.01) return p.toFixed(4)
  return p.toFixed(6)
}

const LHOOD_ITEM = { id: 'lhood', symbol: '$LHOOD', name: 'Liquihood' } as const;

export function MarketTicker() {
  const { assets, lhoodPrice, lhoodChange24h } = useProtocol()
  if (!assets.length) return null

  const allItems = [
    { ...LHOOD_ITEM, priceUsd: lhoodPrice, priceChange24h: lhoodChange24h },
    ...assets,
  ];

  // Duplicate for seamless infinite loop
  const items = [...allItems, ...allItems, ...allItems]

  return (
    <div className="shrink-0 border-t border-border bg-card/60 backdrop-blur overflow-hidden h-8 flex items-center relative">
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-card/60 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-card/60 to-transparent" />

      <div
        className="flex items-center gap-0 whitespace-nowrap"
        style={{ animation: 'market-ticker 60s linear infinite' }}
      >
        {items.map((asset, idx) => {
          const change = asset.priceChange24h ?? 0
          const isPos  = change >= 0
          return (
            <span
              key={`${asset.id}-${idx}`}
              className="inline-flex items-center gap-1.5 px-5 border-r border-border/40 last:border-0"
            >
              <AssetIcon
                assetId={asset.id}
                symbol={asset.symbol}
                className="h-4 w-4 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0"
              />
              <span className="text-[11px] font-semibold tracking-wide text-foreground">
                {asset.symbol}
              </span>
              <span className="text-[11px] font-mono text-foreground/80">
                ${formatPrice(asset.priceUsd)}
              </span>
              <span className={`text-[10px] font-mono font-medium ${isPos ? 'text-[#D0EF19]' : 'text-red-400'}`}>
                {isPos ? '+' : ''}{(change * 100).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
