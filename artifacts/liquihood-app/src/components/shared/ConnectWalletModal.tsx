import React, { useState, useEffect } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useProtocol } from '@/hooks/use-protocol';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { robinhoodChain } from '@/lib/chains';

const CHAIN_PARAMS = {
  chainId: '0x1237', // 4663 mainnet
  chainName: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
  blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
};

export function ConnectWalletModal() {
  const { connect, isPending, error: connectError } = useConnect();
  const { isConnected } = useAccount();
  const { showConnectModal, setShowConnectModal } = useProtocol();

  const [adding, setAdding]     = useState(false);
  const [added, setAdded]       = useState(false);
  const [chainErr, setChainErr] = useState('');
  const [noMetaMask, setNoMetaMask] = useState(false);

  // Close modal when wallet connects successfully
  useEffect(() => {
    if (isConnected) setShowConnectModal(false);
  }, [isConnected, setShowConnectModal]);

  const handleAddChain = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setChainErr('MetaMask not detected. Install it first.');
      return;
    }
    setAdding(true);
    setChainErr('');
    try {
      await eth.request({ method: 'wallet_addEthereumChain', params: [CHAIN_PARAMS] });
      setAdded(true);
    } catch (e: any) {
      if (e?.code !== 4001) setChainErr('Could not add chain. Try adding it manually.');
    } finally {
      setAdding(false);
    }
  };

  const handleConnect = () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setNoMetaMask(true);
      return;
    }
    setNoMetaMask(false);
    connect({ connector: injected(), chainId: robinhoodChain.id });
  };

  return (
    <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
      <DialogContent className="sm:max-w-[360px] border-border bg-card p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <img src="/liquihood-app/logo.png" alt="" className="h-6 w-6 object-contain" />
            Connect to Liquihood
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — Add chain */}
          <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
              Step 1: Add Robinhood Chain to MetaMask
            </p>

            <Button
              variant={added ? 'outline' : 'secondary'}
              size="sm"
              className={`w-full gap-2 font-medium ${added ? 'border-primary/40 text-primary' : ''}`}
              onClick={handleAddChain}
              disabled={adding || added}
            >
              {added ? (
                <><CheckCircle className="h-4 w-4" /> Chain added ✓</>
              ) : adding ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
              ) : (
                <><Plus className="h-4 w-4" /> Add Robinhood Chain</>
              )}
            </Button>

            {chainErr && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" />{chainErr}
              </p>
            )}

            <div className="text-[11px] font-mono text-muted-foreground/50 space-y-0.5 pt-1 border-t border-border/50">
              <div className="flex justify-between"><span>Chain ID</span><span>4663</span></div>
              <div className="flex justify-between"><span>Currency</span><span>ETH</span></div>
              <div className="flex justify-between items-center">
                <span>Explorer</span>
                <a
                  href="https://robinhoodchain.blockscout.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-0.5 hover:text-primary transition-colors"
                >
                  Blockscout <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 — Connect */}
          <div className="space-y-2">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
              Step 2: Connect Wallet
            </p>
            <Button
              size="lg"
              className="w-full gap-2 font-semibold"
              onClick={handleConnect}
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
              ) : (
                <><Wallet className="h-4 w-4" /> Connect MetaMask</>
              )}
            </Button>

            {noMetaMask && (
              <p className="text-[11px] text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                MetaMask not found.{' '}
                <a
                  href="https://metamask.io/download"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-primary"
                >
                  install it here
                </a>
              </p>
            )}

            {connectError && !noMetaMask && (
              <p className="text-[11px] text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {connectError.message.includes('rejected')
                  ? 'Connection rejected. Please approve in MetaMask.'
                  : connectError.message}
              </p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/40 text-center font-mono mt-2">
          Robinhood Chain Mainnet · Chain ID 4663
        </p>
      </DialogContent>
    </Dialog>
  );
}
