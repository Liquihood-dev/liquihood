import React from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPercent, formatToken } from '@/lib/utils';
import { Shield, Clock, Code, Users, ExternalLink } from 'lucide-react';
import { AssetIcon } from '@/components/shared/AssetIcon';
import { calculateRates } from '@/lib/protocol';

export default function TransparencyPage() {
  const { assets, pricesUpdatedAt } = useProtocol();

  const updatedAgo = pricesUpdatedAt > 0
    ? Math.round((Date.now() - pricesUpdatedAt) / 1000)
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Protocol Transparency</h1>
        <p className="text-muted-foreground text-sm">
          Full disclosure of risk parameters, price sources, governance model, and contract status.
        </p>
      </div>

      {/* ── Risk Parameter Table ── */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader>
          <CardTitle>Risk Parameters</CardTitle>
          <CardDescription>Collateral and liquidation settings for every listed asset. These are the governing protocol constants.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-y border-border bg-background/40">
                <th className="px-5 py-3 text-left font-medium">Asset</th>
                <th className="px-5 py-3 text-right font-medium">Tier</th>
                <th className="px-5 py-3 text-right font-medium">Max LTV</th>
                <th className="px-5 py-3 text-right font-medium">Liq Threshold</th>
                <th className="px-5 py-3 text-right font-medium">Liq Bonus</th>
                <th className="px-5 py-3 text-right font-medium">Supply Cap</th>
                <th className="px-5 py-3 text-right font-medium">Borrow APR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assets.map(a => {
                const { borrowApr } = calculateRates(a.totalSupplied, a.totalBorrowed);
                return (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <AssetIcon
                          assetId={a.id}
                          symbol={a.symbol}
                          className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center font-mono text-[10px] text-primary font-bold border border-primary/20 shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-xs">{a.symbol}</div>
                          <div className="text-[10px] text-muted-foreground">{a.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge variant="outline" className="text-[10px]">{a.tier}</Badge>
                      {a.isolated && <Badge variant="outline" className="text-[10px] ml-1 border-yellow-400/30 text-yellow-400">Isolated</Badge>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs">{formatPercent(a.ltv)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs">{formatPercent(a.liquidationThreshold)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs">{formatPercent(a.liquidationBonus)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs">{formatToken(a.supplyCap, 0)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-primary">{formatPercent(borrowApr)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Price Sources ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Price Sources
          </CardTitle>
          <CardDescription>
            Live prices fetched server-side every 60 seconds.
            {updatedAgo !== null && (
              <span className="ml-1 text-primary font-mono">Last update: {updatedAgo}s ago</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assets.map(a => {
            const source = a.oracleSource;
            const isLive = a.tier === 'Crypto' || a.isEquity;

            return (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                  <div>
                    <span className="font-medium text-sm">{a.symbol}</span>
                    {a.isEquity && (
                      <span className="ml-2 text-[10px] text-muted-foreground">NYSE hours gated</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-primary">{source}</span>
                </div>
              </div>
            );
          })}
          <div className="pt-2 space-y-1">
            <a
              href="https://www.coingecko.com/en/coins/ethereum"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> CoinGecko ETH price feed
            </a>
            <a
              href="https://finance.yahoo.com"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Yahoo Finance equity prices
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── Governance ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Governance Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Multisig + Timelock.</strong> All protocol parameter changes (LTV, liquidation thresholds, new assets) are governed by a 4-of-7 multisig wallet. Any change must pass through a <strong className="text-foreground">48-hour timelock</strong> before taking effect. This gives users time to exit positions they disagree with.
          </p>
          <p>
            <strong className="text-foreground">Emergency pause.</strong> A 2-of-7 emergency signer subset can pause new borrows in the event of an oracle failure or black swan event. Repay and Supply are never paused.
          </p>
          <p>
            <strong className="text-foreground">Insurance Fund.</strong> A reserve factor of 10% on all interest earned accumulates in an Insurance Fund to cover bad debt in the event of a catastrophic liquidation shortfall. Balance will be published on-chain after protocol launch.
          </p>
        </CardContent>
      </Card>

      {/* ── Contract Addresses ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5" /> Contract Addresses</CardTitle>
          <CardDescription>
            All core contracts are live on Robinhood Chain (Chain ID 4663). ENS-compatible names are registered on-chain via ProtocolNameRegistry. Resolve any name with <code className="text-[10px] bg-muted px-1 py-0.5 rounded">resolve("pool.liquihood")</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { name: 'LendingPool',              ens: 'pool.liquihood',       addr: '0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E' },
            { name: 'OracleRouter',             ens: 'oracle.liquihood',     addr: '0x9c445077D3826C706A1f39413F2508cc09049827' },
            { name: 'InterestRateModel',        ens: 'rates.liquihood',      addr: '0x419D74beFA27CE808C9c863533193847F25EFb6F' },
            { name: 'HealthFactorEngine',       ens: 'health.liquihood',     addr: '0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA' },
            { name: 'InsuranceFund',            ens: 'insurance.liquihood',  addr: '0xb89Bc97cA63A4Beb1edeD769E13CE1E441Eeb87F' },
            { name: 'LiquidationManager',       ens: 'liquidator.liquihood', addr: '0x13EC47404D1a54D7Bed50Cda76D41254319de3CE' },
            { name: 'IsolatedMarketController', ens: 'isolated.liquihood',   addr: '0x4596073d475F1ebCcdB18f4BDb64463368695B1d' },
            { name: 'MarketHoursPolicy',        ens: 'hours.liquihood',      addr: '0xe71dbE28d26208648644d11e6f92D6305c2561Cb' },
            { name: 'ProtocolNameRegistry',     ens: '',                     addr: '0x2aba92C18A85F5bb8816Dc9373d8D8db1B209C1c' },
          ].map(({ name, ens, addr }) => (
            <div key={name} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center py-2.5 border-b border-border/40 last:border-0 gap-y-1 gap-x-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-tight">{name}</span>
                {ens && (
                  <span className="text-[11px] font-mono text-[#D0EF19]/80 leading-tight">{ens}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D0EF19] shrink-0" />
                <a
                  href={`https://explorer.robinhood.com/address/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors truncate max-w-[190px] sm:max-w-none"
                >
                  {addr}
                </a>
              </div>
            </div>
          ))}
          <div className="pt-3">
            <a
              href="https://robinhoodchain.blockscout.com"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Robinhood Chain Explorer (Blockscout)
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── Security ── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between py-2 border-b border-border/40">
            <span>Smart Contract Audit</span>
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-[10px]">In Progress</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/40">
            <span>Bug Bounty Program</span>
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-[10px]">Planned at Launch</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Formal Verification</span>
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-[10px]">Planned at Launch</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
