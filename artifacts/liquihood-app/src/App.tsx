import { useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProtocolProvider } from '@/hooks/use-protocol';
import { wagmiConfig } from '@/lib/wagmi';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

import { Shell } from '@/components/layout/Shell';
import { ConnectWalletModal } from '@/components/shared/ConnectWalletModal';

import MarketsPage      from '@/pages/markets';
import DashboardPage    from '@/pages/dashboard';
import EarnPage         from '@/pages/earn';
import HistoryPage      from '@/pages/history';
import AssetDetailPage  from '@/pages/asset-detail';
import TransparencyPage  from '@/pages/transparency';
import LiquidationsPage  from '@/pages/liquidations';
import CreateMarketPage  from '@/pages/create-market';
import NotFound          from '@/pages/not-found';

const queryClient = new QueryClient();

function RedirectToMarkets() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/markets'); }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/"                component={RedirectToMarkets} />
        <Route path="/markets"         component={MarketsPage} />
        <Route path="/markets/:id"     component={AssetDetailPage} />
        <Route path="/dashboard"       component={DashboardPage} />
        <Route path="/earn"            component={EarnPage} />
        <Route path="/history"         component={HistoryPage} />
        <Route path="/transparency"    component={TransparencyPage} />
        <Route path="/liquidations"    component={LiquidationsPage} />
        <Route path="/create-market"   component={CreateMarketPage} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

// Auto-detect whether Cloudflare path rewriting is active:
// - If the current path starts with /liquihood-app, no rewriting → use full prefix.
// - If the current path does NOT start with /liquihood-app (e.g. /markets),
//   Cloudflare has already stripped the prefix → use '' so Wouter matches correctly.
// This works in dev, production without CF rule, and with CF rule.
const rawBase = (import.meta.env.BASE_URL || '/liquihood-app/').replace(/\/$/, '');
const routerBase = window.location.pathname.startsWith(rawBase) ? rawBase : '';

function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ProtocolProvider>
            <TooltipProvider>
              <WouterRouter base={routerBase}>
                <Router />
                <ConnectWalletModal />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ProtocolProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

export default App;
