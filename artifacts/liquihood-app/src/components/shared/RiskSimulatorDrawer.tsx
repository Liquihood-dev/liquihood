import React, { useState, useMemo } from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatUsd, formatPercent } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { AlertTriangle } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; }

export function RiskSimulatorDrawer({ open, onClose }: Props) {
  const { positions, assets, isMarketOpen } = useProtocol();

  // collateral assets only
  const collateralPositions = positions.filter(p =>
    p.supplied > 0 && p.useAsCollateral && !assets.find(a => a.id === p.assetId)?.isolated
  );

  // price drop percentages per asset: 0 = no drop, 80 = 80% drop
  const [drops, setDrops] = useState<Record<string, number>>(
    Object.fromEntries(collateralPositions.map(p => [p.assetId, 0]))
  );

  const simHf = useMemo(() => {
    let collateral = 0;
    let debt = 0;
    positions.forEach(p => {
      const asset = assets.find(a => a.id === p.assetId);
      if (!asset || asset.isolated) return;
      const simPrice = asset.priceUsd * (1 - (drops[p.assetId] ?? 0) / 100);
      if (p.supplied > 0 && p.useAsCollateral) {
        const valid = !asset.isEquity || isMarketOpen;
        if (valid) collateral += p.supplied * simPrice * asset.liquidationThreshold;
      }
      if (p.borrowed > 0) debt += p.borrowed * asset.priceUsd; // debt doesn't change
    });
    return debt === 0 ? 999 : collateral / debt;
  }, [positions, assets, isMarketOpen, drops]);

  // Liquidation price per collateral asset: price at which simHf = 1.0
  const liquidationPrices = useMemo(() => {
    const result: Record<string, number> = {};
    let otherCollateral = 0;
    let debt = 0;
    positions.forEach(p => {
      const asset = assets.find(a => a.id === p.assetId);
      if (!asset || asset.isolated) return;
      if (p.borrowed > 0) debt += p.borrowed * asset.priceUsd;
    });
    collateralPositions.forEach(targetPos => {
      const targetAsset = assets.find(a => a.id === targetPos.assetId)!;
      otherCollateral = 0;
      collateralPositions.forEach(p => {
        if (p.assetId === targetPos.assetId) return;
        const a = assets.find(x => x.id === p.assetId)!;
        const simPrice = a.priceUsd * (1 - (drops[p.assetId] ?? 0) / 100);
        otherCollateral += p.supplied * simPrice * a.liquidationThreshold;
      });
      // collateral_self + otherCollateral = debt → liqPrice
      const liqPriceRaw = (debt - otherCollateral) / (targetPos.supplied * targetAsset.liquidationThreshold);
      result[targetPos.assetId] = Math.max(0, liqPriceRaw);
    });
    return result;
  }, [positions, assets, collateralPositions, drops]);

  const hfColor = simHf >= 2 ? '#D0EF19' : simHf >= 1.3 ? '#A8C200' : simHf > 1 ? '#FFB224' : '#FF4D4D';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle>Risk Simulator</DialogTitle>
          <DialogDescription>
            Drag sliders to simulate price drops. Watch your Health Factor update live.{' '}
            <span className="text-yellow-400 font-medium">Simulation, not a prediction.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-6">
          {/* Live HF display */}
          <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-mono tracking-wider mb-1">Projected Health Factor</p>
              <p className="text-3xl font-mono font-bold" style={{ color: hfColor }}>
                {simHf > 99 ? '∞' : simHf.toFixed(2)}
              </p>
            </div>
            {simHf < 1.3 && simHf > 0 && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="h-5 w-5" />
                {simHf < 1 ? 'Liquidated' : 'At risk'}
              </div>
            )}
          </div>

          {/* Sliders */}
          {collateralPositions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No collateral positions to simulate.</p>
          )}
          {collateralPositions.map(p => {
            const asset = assets.find(a => a.id === p.assetId)!;
            const drop = drops[p.assetId] ?? 0;
            const simPrice = asset.priceUsd * (1 - drop / 100);
            const liqPrice = liquidationPrices[p.assetId] ?? 0;
            return (
              <div key={p.assetId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{asset.symbol}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatUsd(asset.priceUsd)} → <span className={drop > 0 ? 'text-destructive' : 'text-foreground'}>{formatUsd(simPrice)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Liq. price</p>
                    <p className="text-xs font-mono text-yellow-400">{formatUsd(liqPrice)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-6">0%</span>
                  <Slider
                    value={[drop]}
                    onValueChange={([v]) => setDrops(prev => ({ ...prev, [p.assetId]: v }))}
                    min={0} max={80} step={1}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-destructive w-8 text-right">-{drop}%</span>
                </div>
                {drop > 0 && (
                  <p className="text-xs font-mono text-muted-foreground">
                    What if {asset.symbol} drops {drop}%?{' '}
                    <span style={{ color: hfColor }}>HF would be {simHf > 99 ? '∞' : simHf.toFixed(2)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
