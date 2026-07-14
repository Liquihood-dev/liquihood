import React, { useState } from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatUsd, formatToken } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Activity, Zap, Wallet } from 'lucide-react';

const TX_TYPES = ['All', 'Supply', 'Withdraw', 'Borrow', 'Repay', 'Liquidation'] as const;
type Filter = typeof TX_TYPES[number];

export default function HistoryPage() {
  const { transactions, assets, walletAddress, connectWallet } = useProtocol();
  const [filter, setFilter] = useState<Filter>('All');

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center animate-in fade-in duration-500">
        <Wallet className="h-10 w-10 text-primary opacity-60" />
        <div>
          <h2 className="text-xl font-bold mb-2">Connect to view history</h2>
          <p className="text-muted-foreground text-sm">Your transaction history will appear here after connecting.</p>
        </div>
        <Button onClick={connectWallet}>Connect Wallet</Button>
      </div>
    );
  }

  const filtered = filter === 'All' ? transactions : transactions.filter(t => t.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'Supply':      return <ArrowUpRight className="h-4 w-4 text-primary" />;
      case 'Withdraw':    return <ArrowDownRight className="h-4 w-4 text-muted-foreground" />;
      case 'Borrow':      return <ArrowDownRight className="h-4 w-4 text-yellow-400" />;
      case 'Repay':       return <ArrowUpRight className="h-4 w-4 text-primary" />;
      case 'Liquidation': return <Zap className="h-4 w-4 text-destructive" />;
      default:            return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-primary/20 text-primary border-primary/20';
      case 'Failed':    return 'bg-destructive/20 text-destructive border-destructive/20';
      case 'Pending':   return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/20';
      default:          return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getHfColor = (hf: number) => {
    if (hf > 99)  return 'text-muted-foreground';
    if (hf >= 2)  return 'text-primary';
    if (hf >= 1.3) return 'text-primary/70';
    if (hf > 1.0) return 'text-yellow-400';
    return 'text-destructive';
  };

  const hasLiquidation = transactions.some(t => t.type === 'Liquidation');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Transaction History</h1>
        <span className="text-xs font-mono text-muted-foreground">{transactions.length} transactions</span>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {TX_TYPES.map(t => (
          <Button
            key={t}
            variant={filter === t ? 'default' : 'outline'}
            size="sm"
            className={`text-xs h-7 ${filter === t ? '' : 'border-border text-muted-foreground hover:text-foreground'}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="bg-card border-border overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Asset</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Value</th>
                <th className="px-6 py-4 font-medium text-right">Resulting HF</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(tx => {
                const asset = assets.find(a => a.id === tx.assetId);
                const value = asset ? tx.amount * asset.priceUsd : 0;
                const isLiq = tx.type === 'Liquidation';
                return (
                  <tr key={tx.id} className={`hover:bg-muted/30 transition-colors ${isLiq ? 'bg-destructive/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-full ${isLiq ? 'bg-destructive/20' : 'bg-background border border-border'}`}>
                          {getIcon(tx.type)}
                        </div>
                        <span className={`font-medium ${isLiq ? 'text-destructive' : ''}`}>{tx.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{asset?.symbol || 'N/A'}</td>
                    <td className="px-6 py-4 text-right font-mono">{formatToken(tx.amount, 4)}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">{formatUsd(value)}</td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={getHfColor(tx.resultingHf)}>
                        {tx.resultingHf > 99 ? '∞' : tx.resultingHf.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs font-mono">
                      {new Date(tx.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Badge variant="outline" className={getStatusColor(tx.status)}>{tx.status}</Badge>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground text-sm">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.map(tx => {
          const asset = assets.find(a => a.id === tx.assetId);
          const value = asset ? tx.amount * asset.priceUsd : 0;
          const isLiq = tx.type === 'Liquidation';
          return (
            <Card key={tx.id} className={`bg-card border-border ${isLiq ? 'border-destructive/30 bg-destructive/5' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full ${isLiq ? 'bg-destructive/20' : 'bg-background border border-border'}`}>
                      {getIcon(tx.type)}
                    </div>
                    <span className={`font-semibold text-sm ${isLiq ? 'text-destructive' : ''}`}>{tx.type}</span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="font-medium text-sm">{asset?.symbol || 'N/A'}</span>
                  </div>
                  <Badge variant="outline" className={getStatusColor(tx.status)}>{tx.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-muted-foreground mb-0.5">Amount</div><div className="font-mono">{formatToken(tx.amount, 4)}</div></div>
                  <div><div className="text-muted-foreground mb-0.5">Value</div><div className="font-mono">{formatUsd(value)}</div></div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">HF After</div>
                    <div className={`font-mono ${getHfColor(tx.resultingHf)}`}>{tx.resultingHf > 99 ? '∞' : tx.resultingHf.toFixed(2)}</div>
                  </div>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {new Date(tx.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No transactions found.</p>
        )}
      </div>

      {hasLiquidation && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive text-base flex items-center gap-2"><Zap className="h-5 w-5" />Liquidation Event</CardTitle>
            <CardDescription>Part of your collateral was sold to repay debt and protect the pool. Health Factor has been restored.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
