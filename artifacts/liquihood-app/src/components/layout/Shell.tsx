import * as React from "react"
import { Link, useLocation } from "wouter"
import { useProtocol } from "@/hooks/use-protocol"
import { Button } from "@/components/ui/button"
import { shortenAddress, getTimeToNextOpen } from "@/lib/utils"
import {
  LayoutDashboard, LineChart, HandCoins, List, Bell, Wallet,
  Shield, Zap, Twitter, LogOut, Copy, Check, PlusCircle,
  MoreHorizontal, X, ChevronRight,
} from "lucide-react"
import { NotificationsPanel } from "@/components/shared/NotificationsPanel"
import { MarketTicker } from "@/components/shared/MarketTicker"
import { AssetIcon } from "@/components/shared/AssetIcon"
import { useLHOODBalance } from "@/hooks/use-on-chain-data"

export function Shell({ children }: { children: React.ReactNode }) {
  const {
    walletAddress, connectWallet, disconnectWallet,
    isMarketOpen, marketOverride, notifications, assets, lhoodPrice,
  } = useProtocol()
  const lhoodBalance = useLHOODBalance(walletAddress as `0x${string}` | undefined)
  const [location]    = useLocation()
  const [notifOpen, setNotifOpen]   = React.useState(false)
  const [walletOpen, setWalletOpen] = React.useState(false)
  const [moreOpen, setMoreOpen]     = React.useState(false)
  const [copied, setCopied]         = React.useState(false)
  const walletRef                   = React.useRef<HTMLDivElement>(null)

  // Close wallet dropdown on outside click
  React.useEffect(() => {
    if (!walletOpen) return
    function handler(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node))
        setWalletOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [walletOpen])

  // Close "More" drawer on route change
  React.useEffect(() => { setMoreOpen(false) }, [location])

  const handleCopy = () => {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const navItems = [
    { label: "Markets",   href: "/markets",   icon: LineChart },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Earn",      href: "/earn",      icon: HandCoins },
    { label: "History",   href: "/history",   icon: List },
  ]

  const moreItems = [
    { label: "Transparency",  href: "/transparency",  icon: Shield },
    { label: "Liquidations",  href: "/liquidations",  icon: Zap },
    { label: "Add Market",    href: "/create-market", icon: PlusCircle },
  ]

  const allNavItems = [...navItems, ...moreItems]

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href))

  const unreadNotifs = notifications.filter(n => !n.read).length

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

      {/* ── Top navbar ── */}
      <header className="shrink-0 border-b border-border bg-card z-40">
        <div className="flex items-stretch h-[60px] px-4 lg:px-6">

          {/* Left: logo + wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/markets" className="flex items-center gap-2">
              <img src="/liquihood-app/logo.png" alt="Liquihood" className="h-7 w-7 object-contain" />
              <span className="font-bold text-base tracking-tight">Liquihood</span>
            </Link>
          </div>

          {/* Center: nav tabs (desktop) */}
          <nav className="hidden md:flex items-stretch flex-1 justify-center">
            {navItems.map(item => {
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={`relative flex flex-col items-center justify-center px-4 gap-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                  {active && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />}
                </Link>
              )
            })}
            {moreItems.map(item => {
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={`relative flex flex-col items-center justify-center px-4 gap-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                  {active && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />}
                </Link>
              )
            })}
          </nav>

          {/* Right: actions */}
          <div className="ml-auto flex items-center gap-1 relative">
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative h-9 w-9"
                onClick={() => setNotifOpen(o => !o)}>
                <Bell className="h-[18px] w-[18px] text-muted-foreground" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Button>
              <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {walletAddress ? (
              <div className="relative" ref={walletRef}>
                <Button
                  variant="outline" size="sm"
                  className="font-mono border-border text-foreground hover:bg-muted gap-1.5 h-9"
                  onClick={() => setWalletOpen(o => !o)}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{shortenAddress(walletAddress)}</span>
                  <span className="sm:hidden">{shortenAddress(walletAddress).slice(0, 6)}…</span>
                </Button>

                {walletOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Connected Wallet</p>
                      <p className="font-mono text-xs text-foreground break-all">{walletAddress}</p>
                    </div>
                    <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src="/liquihood-app/logo.png" alt="LHOOD" className="w-4 h-4 object-contain rounded-full" />
                        <span className="text-xs font-mono font-semibold text-foreground">$LHOOD</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-foreground">
                          {lhoodBalance != null ? lhoodBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                        </p>
                        {lhoodBalance != null && lhoodPrice > 0 && (
                          <p className="text-[10px] font-mono text-muted-foreground">
                            ≈ ${(lhoodBalance * lhoodPrice).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      {copied ? "Copied!" : "Copy Address"}
                    </button>
                    <button
                      onClick={() => { disconnectWallet(); setWalletOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-border"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Disconnect Wallet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button size="sm" onClick={connectWallet}
                className="border border-border bg-card text-foreground hover:bg-muted gap-2 h-9 font-medium shadow-none">
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      {/* pb-[84px] on mobile reserves space for fixed bottom nav (ticker 28px + tabs 56px) */}
      <main className="flex-1 overflow-auto bg-background p-4 md:p-8 pb-[84px] md:pb-2">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* ── Market ticker (desktop only — mobile version is inside bottom nav) ── */}
      <div className="hidden md:block">
        <MarketTicker />
      </div>

      {/* ── Footer status bar (desktop) ── */}
      <footer className="hidden md:flex shrink-0 items-center justify-between border-t border-border bg-card px-6 h-9">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground border border-border rounded-full px-2.5 py-0.5 whitespace-nowrap">
            <div className="h-1.5 w-1.5 rounded-full bg-[#D0EF19] animate-pulse" />
            Robinhood Chain
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-mono border border-border rounded-full px-2.5 py-0.5 whitespace-nowrap ${isMarketOpen ? "text-primary border-primary/30" : "text-muted-foreground"}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
            {isMarketOpen ? "NYSE Open" : `NYSE Closed (${getTimeToNextOpen(marketOverride)})`}
          </div>
        </div>
        <a href="https://x.com/liquihood" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          <Twitter className="h-3.5 w-3.5" />
          @liquihood
        </a>
      </footer>

      {/* ── Mobile bottom nav ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/97 backdrop-blur-md border-t border-border">

        {/* Mini market ticker strip */}
        <div className="overflow-hidden h-7 border-b border-border/40 relative flex items-center bg-card/60">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-card/60 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-card/60 to-transparent" />
          {assets.length > 0 && (
            <div
              className="flex items-center whitespace-nowrap"
              style={{ animation: "market-ticker 40s linear infinite" }}
            >
              {[...assets, ...assets, ...assets].map((asset, idx) => {
                const isPos = asset.priceChange24h >= 0
                return (
                  <span key={`m-${asset.id}-${idx}`}
                    className="inline-flex items-center gap-1 px-3 border-r border-border/30 last:border-0">
                    <AssetIcon assetId={asset.id} symbol={asset.symbol}
                      className="h-3 w-3 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0" />
                    <span className="text-[10px] font-semibold text-foreground/90">{asset.symbol}</span>
                    <span className="text-[10px] font-mono text-foreground/70">
                      ${asset.priceUsd >= 1000
                        ? asset.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        : asset.priceUsd >= 1 ? asset.priceUsd.toFixed(2)
                        : asset.priceUsd.toFixed(4)}
                    </span>
                    <span className={`text-[9px] font-mono font-medium ${isPos ? "text-[#D0EF19]" : "text-red-400"}`}>
                      {isPos ? "+" : ""}{(asset.priceChange24h * 100).toFixed(2)}%
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Nav tabs — 4 primary + More */}
        <div className="flex items-center h-14">
          {navItems.map(item => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && <span className="absolute bottom-1 h-0.5 w-6 bg-primary rounded-full" />}
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative ${
              moreItems.some(i => isActive(i.href)) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium">More</span>
            {moreItems.some(i => isActive(i.href)) && (
              <span className="absolute bottom-1 h-0.5 w-6 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile "More" drawer ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="md:hidden fixed bottom-[84px] left-0 right-0 z-[70] bg-card border-t border-border rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">More</span>
              <button onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Items */}
            <div className="p-3 space-y-1">
              {moreItems.map(item => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">{item.label}</span>
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </Link>
                )
              })}
            </div>

            {/* Status footer */}
            <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-[#D0EF19] animate-pulse" />
                Robinhood Chain
              </div>
              <div className={`flex items-center gap-1.5 text-[11px] font-mono ${isMarketOpen ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
                {isMarketOpen ? "NYSE Open" : `NYSE Closed`}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
