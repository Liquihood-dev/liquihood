import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Menu, X, ExternalLink, ArrowLeft } from "lucide-react";
import logoImg from "@/assets/liquihood-logo.png";

// ─── Design tokens ───────────────────────────────────────────
const A = "#D0EF19";
const MONO = "'JetBrains Mono', monospace";

// ─── TOC ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: "executive-summary",  label: "1. Executive Summary" },
  { id: "verified-facts",     label: "2. Verified Facts" },
  { id: "product-definition", label: "3. Product Definition" },
  { id: "protocol-model",     label: "4. Protocol Model" },
  { id: "architecture",       label: "5. System Architecture" },
  { id: "flows",              label: "6. Transaction Flows" },
  { id: "oracle",             label: "7. Oracle & Market Hours" },
  { id: "interest-rate",      label: "8. Interest Rate Model" },
  { id: "liquidation",        label: "9. Liquidation & Bad Debt" },
  { id: "risk-params",        label: "10. Risk Parameters" },
  { id: "implementation",     label: "11. Implementation Guide" },
  { id: "security",           label: "12. Security Program" },
  { id: "roadmap",            label: "13. Roadmap" },
  { id: "checklist",          label: "14. Pre-Build Checklist" },
  { id: "failure-modes",      label: "15. Failure Mode Analysis" },
  { id: "interfaces",         label: "16. Solidity Interfaces" },
  { id: "deployed-contracts", label: "17. Deployed Contracts" },
];

// ─── Reusable primitives ──────────────────────────────────────
function SectionHead({ id, n, title }: { id: string; n: string; title: string }) {
  return (
    <div id={id} className="scroll-mt-24 pt-14 pb-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: A, fontFamily: MONO }}>{n}</p>
      <h2 className="font-semibold" style={{ fontSize: "1.7rem", letterSpacing: "-0.03em", color: "#EDEDED", lineHeight: 1.1 }}>{title}</h2>
    </div>
  );
}

function SubHead({ title }: { title: string }) {
  return (
    <h3 className="font-semibold mt-10 mb-3" style={{ fontSize: "1.05rem", color: "#CDCDCD", letterSpacing: "-0.02em" }}>{title}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border-l-2 px-4 py-3" style={{ borderColor: A, background: "rgba(208,239,25,0.04)" }}>
      <p className="text-sm leading-relaxed" style={{ color: "#aaaaaa" }}>{children}</p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="my-4 rounded-xl p-5 overflow-x-auto text-xs leading-relaxed" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.07)", color: "#CDCDCD", fontFamily: MONO }}>
      <code>{children}</code>
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
            {head.map((h) => (
              <th key={h} className="text-left px-4 py-3 font-semibold uppercase tracking-wider" style={{ color: "#555555", fontFamily: MONO }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3 text-sm leading-relaxed" style={{ color: "#888888", verticalAlign: "top" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: A }}>{children}</span>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <code className="px-1 py-0.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "#cdcdcd", fontFamily: MONO }}>{children}</code>;
}

// ─── Sidebar ──────────────────────────────────────────────────
function Sidebar({ active, onClose }: { active: string; onClose?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 py-4">
      <Link
        href="/"
        className="flex items-center gap-2 mb-5 text-sm transition-colors"
        style={{ color: "#555555" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEDED"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555555"; }}
      >
        <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
        Back to site
      </Link>
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={onClose}
            className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg transition-all duration-150"
            style={{
              color: isActive ? "#EDEDED" : "#555555",
              background: isActive ? "rgba(208,239,25,0.07)" : "transparent",
              fontFamily: MONO,
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#AAAAAA"; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#555555"; }}
          >
            {isActive && <span className="w-1 h-1 rounded-full shrink-0" style={{ background: A }} />}
            {!isActive && <span className="w-1 h-1 rounded-full shrink-0 opacity-0" />}
            <span className="truncate">{s.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function Docs() {
  const [active, setActive] = useState("executive-summary");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Scrollspy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ background: "#000000", minHeight: "100vh" }}>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-7 w-7 rounded overflow-hidden">
            <img src={logoImg} alt="Liquihood" className="h-full w-full object-cover" />
          </div>
          <span className="font-semibold text-sm" style={{ color: "#EDEDED" }}>Liquihood</span>
          <span className="text-xs px-1.5 py-0.5 rounded ml-1" style={{ background: "rgba(208,239,25,0.12)", color: A, fontFamily: MONO }}>docs</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs" style={{ color: "#444444", fontFamily: MONO }}>v2.1 · July 13, 2026</span>
          <button
            className="lg:hidden p-2 rounded-lg"
            style={{ color: "#888888" }}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 pt-14 lg:hidden" style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(20px)" }}>
          <div className="px-6 overflow-y-auto h-full">
            <Sidebar active={active} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex pt-14">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto px-4 border-r" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Sidebar active={active} />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 px-5 sm:px-8 xl:px-14 pb-32 max-w-4xl mx-auto lg:mx-0">

          {/* Hero */}
          <div className="pt-12 pb-4 border-b mb-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: A, fontFamily: MONO }}>Protocol Documentation</p>
            <h1 className="font-semibold mb-2" style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", letterSpacing: "-0.04em", color: "#EDEDED", lineHeight: 1.08 }}>
              Liquihood: Complete<br />Protocol Specification
            </h1>
            <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "#666666" }}>
              Architecture, economic design, oracle policy, risk parameters, and implementation guide.
              Engineering &amp; risk reference, v2.0. Supersedes all prior marketing and v1 technical documents.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              {[["Version", "2.1"], ["Date", "July 13, 2026"], ["Status", "Live — v1"]].map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: "rgba(255,255,255,0.07)", background: "#0A0A0A", fontFamily: MONO }}>
                  <span style={{ color: "#444444" }}>{k}:</span>
                  <span style={{ color: "#AAAAAA" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 1. Executive Summary ── */}
          <SectionHead id="executive-summary" n="01" title="Executive Summary" />
          <div className="mt-6 space-y-4">
            <P>
              <strong style={{ color: "#CDCDCD" }}>Liquihood</strong> is a pooled, overcollateralized lending protocol on <Accent>Robinhood Chain</Accent> that lets users borrow <Accent>USDG</Accent> against a basket of on-chain assets (Stock Tokens, blue-chip crypto, stablecoins, and in isolated markets, speculative assets) without selling them.
            </P>
            <P>Three structural facts drive everything in this document:</P>
            <div className="space-y-2 my-4">
              {[
                ["1", "Liquihood cannot mint USDG", "Paxos issues USDG, therefore the protocol is a pool-based lender (Aave-style), not a CDP (Maker-style). Supply & Earn must ship in Phase 1: without USDG suppliers there is nothing to borrow."],
                ["2", "Stock Tokens carry non-standard risk", "They are debt securities issued by Robinhood Assets (Jersey) Limited tracking US equities (not shares) and their underlying markets close nights and weekends while the chain runs 24/7. This forces an explicit Market-Hours Policy and conservative LTV haircuts."],
                ["3", "Speculative assets are the classic DeFi attack vector", "Memecoins are confined to Isolated Markets from day one, never cross-collateralized with the main pool."],
              ].map(([n, title, body]) => (
                <div key={n} className="flex gap-4 rounded-xl p-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "rgba(208,239,25,0.12)", color: A, fontFamily: MONO }}>{n}</span>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#CDCDCD" }}>{title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: "#777777" }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Note>
              The design goal is not "cannot fail." The goal is <strong>contained, absorbable failure</strong>: isolated markets quarantine bad debt, an insurance fund absorbs losses before suppliers do, caps bound maximum damage, and a guardian can freeze markets faster than an exploit can drain them.
            </Note>
          </div>

          {/* ── 2. Verified Facts ── */}
          <SectionHead id="verified-facts" n="02" title="Grounding: Verified Facts & Source Corrections" />
          <SubHead title="Source Correction" />
          <P>The previously referenced <Mono>docs.robinhood.com/crypto/trading</Mono> is the <strong style={{ color: "#CDCDCD" }}>Robinhood Crypto Trading API</strong>, a centralized REST API for US brokerage customers. It is <strong>not</strong> Robinhood Chain documentation and plays no role in Liquihood's architecture. It cannot be called from Solidity and serves US customers only; Stock Tokens are explicitly not available in the US.</P>
          <SubHead title="Verified State of Robinhood Chain (July 2026)" />
          <Table
            head={["#", "Verified Fact", "Design Consequence for Liquihood"]}
            rows={[
              ["F1", "Robinhood Chain public mainnet launched July 1, 2026; permissionless Ethereum L2 on Arbitrum Orbit; ~100ms block times; ETH is the gas token.", "Anyone may deploy contracts. Standard EVM tooling (Foundry, Wagmi/Viem) valid. Gas in ETH."],
              ["F2", "Stock Tokens are debt securities issued by Robinhood Assets (Jersey) Limited, mirroring 200+ US stocks/ETFs; available in 120+ jurisdictions, excluding the US; holders receive no shareholder rights.", "Collateral risk = market risk + issuer credit risk + regulatory risk. All three must be priced into LTV haircuts."],
              ["F3", "SEC guidance (January 2026) distinguishes issuer-sponsored tokenized securities from third-party synthetic products, placing the latter under heightened scrutiny.", "Regulatory intervention against the issuer is a live tail risk outside Liquihood's control."],
              ["F4", "Stock Tokens are transferable via Robinhood Wallet and tradeable on on-chain DEXs.", "Composability is validated: the go/no-go is answered positively. Per-token contract audits still required."],
              ["F5", "ERC-8056 (draft; Robinhood + Superstate) standardizes on-chain corporate actions and Scaled UI Amounts.", "Collateral accounting must survive splits/reverse-splits. Adapter layer is mandatory; draft status means adapters must be defensive."],
              ["F6", "Chainlink is a day-one ecosystem partner on the chain.", "Primary oracle assumption valid in principle, but feed existence must be verified per asset on this chain."],
              ["F7", "Morpho is live on the chain powering Robinhood Earn (USDG lending, ~7% APY, insured via Lloyd's of London/RELM); chain TVL surpassed ~$240M shortly after launch.", "A direct lending competitor exists at launch. Supply-rate competitiveness must be benchmarked against ~7%."],
              ["F8", "DEX venues live at launch: Uniswap plus a zero-fee DEX built by the dYdX team; early volume dominated by speculative memecoin trading.", "Liquidators have somewhere to sell seized collateral, but per-asset depth is shallow. Borrow caps must be pegged to measured DEX depth."],
              ["F9", "USDG (Global Dollar / Paxos) is natively available on the chain; Robinhood participates in the Global Dollar Network.", "USDG as the borrow asset is strategically and technically sound. Liquihood cannot mint it → pooled model."],
              ["F10", "Single sequencer operated by Robinhood provides fast soft confirmations.", "Sequencer downtime delays liquidations. A post-downtime grace period mechanism is required."],
            ]}
          />

          {/* ── 3. Product Definition ── */}
          <SectionHead id="product-definition" n="03" title="Product Definition (Corrected)" />
          <Note><strong>One sentence:</strong> deposit supported assets as collateral, borrow USDG against them, repay anytime, keep your market exposure throughout.</Note>
          <SubHead title="What Liquihood Is" />
          <ul className="space-y-2 text-sm" style={{ color: "#888888" }}>
            {[
              "A non-custodial, overcollateralized, pooled lending protocol.",
              "Two-sided: suppliers deposit USDG to earn yield; borrowers post collateral to draw USDG.",
              "Universal-collateral by design: equities exposure (Stock Tokens), crypto, stablecoins, under one health-factor system, with risk-tiered parameters.",
            ].map((item, i) => (
              <li key={i} className="flex gap-3">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: A }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <SubHead title="What Liquihood Is Not" />
          <ul className="space-y-2 text-sm" style={{ color: "#888888" }}>
            {[
              "Not a stablecoin issuer or CDP: it cannot create USDG.",
              "Not a margin/brokerage product: no rehypothecation, no off-chain accounts, no brokerage API integration.",
              "Not a guarantee of liquidity: borrowing capacity depends on supplied USDG and utilization.",
              "Not risk-free: positions can be liquidated; extreme events can exceed modeled buffers.",
            ].map((item, i) => (
              <li key={i} className="flex gap-3 opacity-70">
                <span className="shrink-0 mt-0.5">✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <SubHead title="Positioning vs. Morpho (F7)" />
          <P>Morpho on Robinhood Chain serves curated, primarily yield-oriented flows. Liquihood competes on the <Accent>collateral side</Accent>: breadth of accepted assets (especially Stock Tokens with a purpose-built market-hours risk regime) and a unified multi-asset borrowing position. If Liquihood cannot list Stock Tokens safely, its differentiation collapses , which is why §10 and §14 exist.</P>

          {/* ── 4. Protocol Model ── */}
          <SectionHead id="protocol-model" n="04" title="Protocol Model & Economic Design" />
          <SubHead title="Why Pooled Lending (Not CDP)" />
          <Table
            head={["Criterion", "CDP (mint synthetic)", "Pooled Lending (chosen)"]}
            rows={[
              ["Requires control of the borrow asset", "Yes, must mint/burn", "No, borrows pre-supplied USDG"],
              ["USDG feasibility", "Impossible (Paxos issues USDG)", <Accent>Feasible</Accent>],
              ["Peg risk owned by protocol", "Yes", "No (Paxos owns the peg)"],
              ["Cold-start problem", "None (mint on demand)", "Must bootstrap supply side"],
            ]}
          />
          <P>The cold-start trade-off is explicit and mitigated structurally: Supply &amp; Earn ships in Phase 1, with treasury-seeded liquidity targeting $250k-$1M USDG at launch, publicly disclosed.</P>
          <SubHead title="Market Topology: Main Market + Isolated Markets" />
          <Code>{`                 ┌────────────────────────────────────────────┐
                 │              MAIN MARKET                    │
                 │  Collateral: USDG, USDC*, WETH,             │
                 │              approved Stock Tokens          │
                 │  Borrow: USDG (single borrow asset, v1)     │
                 │  Cross-collateral: YES (one HF per account) │
                 └────────────────────────────────────────────┘

   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ ISOLATED MKT #1   │  │ ISOLATED MKT #2   │  │ ISOLATED MKT #n   │
   │ Collateral: MEME-A│  │ Collateral: MEME-B│  │ Collateral: RWA-X │
   │ Borrow: USDG      │  │ Borrow: USDG      │  │ Borrow: USDG      │
   │ Debt ceiling: hard│  │ Debt ceiling: hard│  │ Debt ceiling: hard│
   │ Contagion: NONE   │  │ Contagion: NONE   │  │ Contagion: NONE   │
   └──────────────────┘  └──────────────────┘  └──────────────────┘`}</Code>
          <Note>The canonical DeFi lending exploits (Mango Markets 2022, CREAM 2021) share one shape: pump the price of a thin collateral → borrow blue-chip liquidity against the inflated valuation → walk away. Cross-collateralization is the transmission channel. Isolation with a hard per-market debt ceiling caps the maximum extractable value at the ceiling , a known, budgeted number , instead of the entire pool.</Note>
          <SubHead title="Account Model" />
          <P>One address = one account per market scope. A user's Main Market position is a single cross-collateralized vault (multiple collaterals, one debt). Each isolated position is separate. Supplied USDG is represented by a transferable, interest-bearing receipt token (<Accent>lhUSDG</Accent>) using an exchange-rate model (Compound cToken style, non-rebasing).</P>
          <SubHead title="Revenue Model" />
          <Table
            head={["Stream", "Rate", "Destination"]}
            rows={[
              ["Reserve factor on borrow interest", "10%", "Treasury / Insurance Fund"],
              ["Protocol share of liquidation bonus", "10% of the bonus", "Insurance Fund"],
              ["(Future) origination / flash fees", "TBD", "Treasury"],
            ]}
          />

          {/* ── 5. Architecture ── */}
          <SectionHead id="architecture" n="05" title="System Architecture" />
          <SubHead title="Contract Map" />
          <Code>{`                        ┌─────────────────────────────┐
                        │        GOVERNANCE            │
                        │  3/5 Multisig → Timelock     │
                        │  (24h params / 48h listings  │
                        │   & upgrades)                │
                        │  GUARDIAN multisig:          │
                        │  pause-only, instant          │
                        └──────────┬──────────────────┘
                                   │ configures
        ┌──────────────────────────┼─────────────────────────────┐
        ▼                          ▼                             ▼
┌───────────────┐        ┌─────────────────┐          ┌──────────────────┐
│ PoolManager    │◀──────▶│ RiskEngine       │◀────────│ OracleRouter      │
│ (single entry  │        │ (params, HF,     │         │ (Chainlink +      │
│  point, UUPS)  │        │  caps, modes)    │         │  validation +     │
└──────┬────────┘        └────────┬────────┘          │  market calendar) │
       │                          │                    └──────────────────┘
  ┌────┴──────┐             ┌─────┴─────────┐
  ▼           ▼             ▼               ▼
┌────────┐ ┌─────────┐ ┌──────────────┐ ┌───────────────────┐
│ lhToken │ │ dToken   │ │ Liquidation   │ │ InterestRateModel  │
│ (supply │ │ (debt,   │ │ Manager +     │ │ (kinked curve,     │
│ receipt)│ │ non-     │ │ BadDebtModule │ │  per asset)        │
└────────┘ │ transfer)│ └──────────────┘ └───────────────────┘
           └─────────┘
       ▲
       │ per-asset wrappers
┌──────┴────────────────┐
│ CollateralAdapters     │  ← StockTokenAdapter (ERC-8056-aware),
│ (one per asset class)  │    StandardERC20Adapter, etc.
└───────────────────────┘`}</Code>
          <SubHead title="Module Specifications" />
          <div className="space-y-4">
            {[
              {
                name: "PoolManager (Entry Point)",
                body: <>External functions: <Mono>supply</Mono>, <Mono>withdraw</Mono>, <Mono>depositCollateral</Mono>, <Mono>withdrawCollateral</Mono>, <Mono>borrow</Mono>, <Mono>repay</Mono>, <Mono>liquidate</Mono>. UUPS upgradeable (48h timelock). ReentrancyGuard on every state-changing function; SafeERC20 everywhere. Fee-on-transfer defense: every inflow measured as <Mono>balanceAfter − balanceBefore</Mono>. <Mono>repay</Mono> and <Mono>supply</Mono> can never be paused.</>,
              },
              {
                name: "RiskEngine",
                body: <>Stores per-asset parameters: <Mono>ltv</Mono>, <Mono>liquidationThreshold</Mono>, <Mono>liquidationBonus</Mono>, <Mono>supplyCap</Mono>, <Mono>borrowCap</Mono>, <Mono>debtCeiling</Mono> (isolated), <Mono>{"marketStatus ∈ {Active, Frozen, Paused, Deprecated}"}</Mono>, <Mono>{"assetClass ∈ {Stablecoin, Crypto, Equity, Speculative}"}</Mono>. Computes Health Factor and authorizes state transitions. <Mono>Frozen</Mono> = no new borrows/deposits, but repay/withdraw/liquidate allowed.</>,
              },
              {
                name: "StockTokenAdapter (per Stock Token)",
                body: "ERC-8056 awareness: reads Scaled UI Amounts / corporate-action state so a 10:1 split doesn't corrupt collateral accounting. Any unrecognized scaling event auto-Freezes the market , fail-closed, not fail-open. Probes for paused()/allowlist state on the token contract each interaction. No generic listing: every Stock Token contract is individually reviewed.",
              },
              {
                name: "StandardERC20Adapter",
                body: "Decimals normalization to 1e18 internal accounting (USDG/USDC 6-decimals vs WETH 18-decimals). Fee-on-transfer rejection. Rebasing-token rejection.",
              },
            ].map(({ name, body }) => (
              <div key={name} className="rounded-xl p-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm font-semibold mb-2" style={{ color: "#CDCDCD", fontFamily: MONO }}>{name}</p>
                <p className="text-sm leading-relaxed" style={{ color: "#777777" }}>{body}</p>
              </div>
            ))}
          </div>
          <SubHead title="Health Factor: The Solvency Invariant" />
          <Code>{`HF(account) = Σᵢ [ collateralBalanceᵢ × priceᵢ × liquidationThresholdᵢ ]
              ─────────────────────────────────────────────────────────
                          totalDebt × priceUSDG

HF > 1.00 → solvent
HF ≤ 1.00 → liquidatable`}</Code>
          <P><Mono>liquidationThreshold</Mono> (LT) governs liquidation; <Mono>ltv</Mono> ({"<"} LT) governs new borrowing power. The gap is the user's buffer zone. All <Mono>borrow</Mono> and <Mono>withdrawCollateral</Mono> actions require post-action HF ≥ 1.02.</P>
          <SubHead title="Explicit Dependency Inventory" />
          <Table
            head={["Dependency", "Failure Mode", "Handling"]}
            rows={[
              ["Robinhood sequencer (F10)", "Downtime → users can't repay → unfair liquidations on restart", "Post-downtime grace period (§7.4)"],
              ["Chainlink feeds (F6)", "Stale / wrong price", "Multi-check validation, auto-freeze (§7.2)"],
              ["Stock Token issuer contracts (F2, F4)", "Issuer pause/freeze; issuer credit event", "Adapter detection → Frozen; issuer-risk haircut in LT; grace queue"],
              ["USDG (Paxos)", "Depeg", "USDG priced via its own feed, not hardcoded $1; severe depeg → global Freeze playbook"],
              ["DEX liquidity (F8)", "Liquidators can't exit collateral", "Borrow caps pegged to measured depth; open-source liquidation bot"],
              ["Arbitrum Orbit stack", "L2 protocol bug", "Outside our control; monitored; part of disclosed risk"],
            ]}
          />

          {/* ── 6. Transaction Flows ── */}
          <SectionHead id="flows" n="06" title="Core Transaction Flows" />
          <SubHead title="6.1 Supply (Lend USDG)" />
          <Code>{`User                    PoolManager              lhUSDG           RiskEngine
 │  approve(USDG)            │                     │                  │
 │──supply(amount)──────────▶│                     │                  │
 │                           │─check supplyCap────▶│                  │
 │                           │◀────ok──────────────│                  │
 │                           │ pull USDG (measure balanceΔ)           │
 │                           │ accrue interest index                  │
 │                           │──mint lhUSDG @ exchangeRate──▶         │
 │◀───lhUSDG─────────────────│                     │                  │`}</Code>
          <P>Interest accrues via a global borrow index updated on every state-changing interaction (per-second compounding approximation). <Mono>withdraw</Mono> burns lhUSDG at the current exchange rate; reverts if pool cash is insufficient.</P>
          <SubHead title="6.2 Deposit Collateral & Borrow" />
          <Code>{`1. depositCollateral(asset, amount)
   → adapter.validate(asset): not frozen by issuer, decimals normalized,
     supplyCap not exceeded, market Active
   → internal collateral balance credited (no receipt token)

2. borrow(USDG, amount)
   GATES (all must pass, in order):
   a. market Active (not Frozen/Paused)
   b. borrowCap / debtCeiling not exceeded
   c. OracleRouter returns VALID prices for every collateral (§7.2)
   d. Market-Hours gate for equity collateral (§7.3):
      if any borrowing power derives from Stock Tokens while the
      underlying market is closed → that asset contributes 0 to
      *new* borrowing power (existing positions unaffected)
   e. post-action HF ≥ 1.02
   → dUSDG minted to borrower, USDG transferred out`}</Code>
          <Note><strong>Gate (d) rationale:</strong> allowing borrows against Friday's close all weekend hands attackers a free option: borrow at stale prices exactly when adverse information arrives. Blocking new equity-backed borrowing power off-hours removes the option while leaving honest existing borrowers untouched.</Note>
          <SubHead title="6.3 Repay & Withdraw Collateral" />
          <P><Mono>repay(amount | max)</Mono>: burns dUSDG; interest settled first, then principal. Always available, even under global pause. <Mono>withdrawCollateral</Mono>: gated by post-action HF ≥ 1.02, and for Stock Tokens off-hours, by the stricter HF ≥ 1.30; withdrawals shrink the safety buffer precisely when the protocol cannot re-price it.</P>
          <SubHead title="6.4 Liquidation" />
          <Code>{`Liquidator              LiquidationManager         PoolManager        DEX
 │ observe HF ≤ 1 (via indexer / own node)              │              │
 │──liquidate(user, collateralAsset, repayAmount)──▶    │              │
 │        validate: HF ≤ 1; repayAmount ≤ closeFactor × debt           │
 │        pull USDG from liquidator                     │              │
 │        seize = repayValue × (1 + bonus) / price      │              │
 │        90% of bonus → liquidator; 10% → InsuranceFund│              │
 │◀───────collateral transferred────────────────────    │              │
 │──sell collateral──────────────────────────────────────────────────▶│`}</Code>

          {/* ── 7. Oracle ── */}
          <SectionHead id="oracle" n="07" title="Oracle Architecture & Market-Hours Policy" />
          <Note>This is the highest-risk subsystem. Design principle: <strong>fail closed</strong>.</Note>
          <SubHead title="7.1 Primary Source" />
          <P>The deployed OracleRouter uses three source types: <strong style={{ color: "#CDCDCD" }}>KEEPER</strong> (keeper EOA pushes prices on a schedule), <strong style={{ color: "#CDCDCD" }}>FIXED</strong> (hardcoded $1.00 for stablecoins), and <strong style={{ color: "#CDCDCD" }}>CHAINLINK</strong> (reserved for on-chain Chainlink feeds; not yet configured on Robinhood Chain). Live configuration: USDG is FIXED; ETH, WETH, AAPL-T, TSLA-T, and HOOD-T are KEEPER-sourced, with prices pushed every 5 minutes by the protocol keeper service. CHAINLINK will replace KEEPER for assets where a verified on-chain feed exists on Robinhood Chain.</P>
          <SubHead title="7.2 Per-Read Validation Pipeline" />
          <div className="space-y-2 my-4">
            {[
              ["1", "Staleness", "block.timestamp − updatedAt ≤ heartbeat(asset) + grace. Crypto heartbeats per feed spec; equity feeds use the market calendar."],
              ["2", "Bounds", "minAnswer < price < maxAnswer (mitigates the circuit-limit failure class, the LUNA/Venus incident shape)."],
              ["3", "Deviation circuit-breaker", "Single-update move beyond a per-class threshold (stablecoin 2%, crypto 20%, equity 25%) → market auto-Frozen pending guardian review."],
              ["4", "Cross-reference (advisory)", "On-chain DEX TWAP as a sanity signal only, never a price source (thin liquidity makes TWAPs manipulable, F8). Chainlink stale and TWAP divergent: Frozen."],
            ].map(([n, title, body]) => (
              <div key={n} className="flex gap-3 rounded-xl p-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "rgba(208,239,25,0.1)", color: A, fontFamily: MONO }}>{n}</span>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "#CDCDCD" }}>{title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#777777" }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <SubHead title="7.3 Market-Hours Policy for Stock Tokens" />
          <P>Underlying price discovery exists ~32.5 hours/week (NYSE/Nasdaq regular sessions); the chain runs 168. For ~80% of each week, the "price" of equity collateral is the last close. Overnight/weekend gaps of 5-15% on single names are routine around earnings and macro shocks.</P>
          <Table
            head={["Condition", "New borrows vs equity collateral", "Withdraw equity collateral", "Liquidations"]}
            rows={[
              ["Underlying market OPEN, feed live", "✅ normal (HF ≥ 1.02)", "✅ normal (HF ≥ 1.02)", "✅ normal"],
              ["Market CLOSED (nights/weekends/holidays), feed at last close", "❌ blocked: equity contributes 0 to new borrowing power", "✅ only if post-action HF ≥ 1.30", "✅ active, at last-close price"],
              ["Feed anomalous / issuer paused token", "❌", "❌", "⏸ grace-queued, guardian review"],
            ]}
          />
          <P>Equity LTs are derived from historical worst gap-opens so a position healthy at Friday's close survives the modeled Monday gap (Weekend Gap Buffer). On-chain market calendar maintained by a keeper with conservative default: if calendar state is uncertain, treat as closed.</P>
          <SubHead title="7.4 Sequencer-Downtime Handling (F10)" />
          <P>After any detected downtime ≥ 15 minutes, liquidations require prices refreshed post-restart and a grace period of <Mono>min(downtime, 2h)</Mono> before executing on positions that became unhealthy during the outage. Detection uses the chain's sequencer-uptime feed if provided; otherwise a keeper-attested heartbeat with guardian override.</P>

          {/* ── 8. Interest Rate ── */}
          <SectionHead id="interest-rate" n="08" title="Interest Rate Model" />
          <P>Kinked utilization curve, per borrowable asset (v1: USDG only):</P>
          <Code>{`U = totalBorrows / (cash + totalBorrows)

borrowRate(U) = R0 + (U/U*) × S1                       for U ≤ U*
              = R0 + S1 + ((U − U*)/(1 − U*)) × S2      for U > U*

supplyRate(U) = borrowRate(U) × U × (1 − reserveFactor)`}</Code>
          <Table
            head={["Param", "Value", "Rationale"]}
            rows={[
              ["U* (optimal utilization)", "80%", "Standard for stablecoin pools; keeps a withdrawal buffer"],
              ["R0 (base rate)", "0%", "No base rate"],
              ["S1 (slope below kink)", "6.5%", "At U=80%: borrow ≈ 6.5%, supply ≈ 4.7%. Launch incentives required to compete with Morpho's ~7% (F7)"],
              ["S2 (slope above kink)", "60%", "Punitive above the kink: utilization >80% must be expensive and self-correcting"],
              ["reserveFactor", "10%", "Funds treasury + insurance"],
            ]}
          />
          <Note><strong>The kink is a liquidity-guarantee mechanism disguised as a rate curve.</strong> At U=95%, borrow ≈ 51.5% APR; borrowers repay or new supply floods in; either restores withdrawability. Rates accrue per-second via index; parameters are governance-tunable behind the 24h timelock.</Note>

          {/* ── 9. Liquidation ── */}
          <SectionHead id="liquidation" n="09" title="Liquidation Engine & Bad Debt Management" />
          <SubHead title="9.1 Parameters" />
          <Table
            head={["Parameter", "Value", "Notes"]}
            rows={[
              ["Trigger", "HF ≤ 1.00", ""],
              ["Close factor", "50% of debt per call; 100% if HF < 0.90 or position < $50 (dust)", "Partial liquidation preserves borrower equity in mild breaches; deep breaches allow full closure"],
              ["Liquidation bonus", "Per asset class (§10): 4% stables to 15% speculative", "Must exceed round-trip execution cost (gas + slippage) at that asset's real DEX depth, or nobody liquidates"],
              ["Protocol fee", "10% of the bonus → Insurance Fund", ""],
            ]}
          />
          <SubHead title="9.2 Liquidator Economics" />
          <Note>A liquidation only happens if <Mono>bonus × seizedValue {">"} gas + DEX slippage + inventory risk</Mono>. Binding rule: <strong>borrow cap per asset ≈ 30-50% of the value sellable on-chain at ≤5% slippage, measured weekly.</strong> Caps grow with measured liquidity, never ahead of it.</Note>
          <SubHead title="9.3 Grace-Queue for Frozen Collateral" />
          <P>If an issuer pauses a Stock Token (F4), seized collateral cannot be transferred. Liquidations enter a queue; the market freezes; positions are re-evaluated when transferability resumes. Interest continues accruing on debt, but no liquidation penalty accrues during the freeze window.</P>
          <SubHead title="9.4 Bad Debt Module: The Loss Waterfall" />
          <Code>{`Loss → 1. Insurance Fund (reserveFactor + liquidation fees)
     → 2. Socialization strictly within the originating market scope:
          - Isolated market loss → haircut only that market's accounting
          - Main Market loss → pro-rata haircut on lhUSDG exchange rate
     → 3. Automatic Freeze of the originating market + public post-mortem`}</Code>
          <P>Pre-committing to a waterfall makes the worst case a known, bounded, communicable event. The isolated-market scoping is what makes memecoin listings survivable at all.</P>

          {/* ── 10. Risk Params ── */}
          <SectionHead id="risk-params" n="10" title="Risk Parameter Framework" />
          <SubHead title="10.1 Six-Dimension Listing Assessment" />
          <div className="space-y-2 my-4">
            {[
              "Volatility: 2-year annualized σ; worst 1-day move; for equities, worst overnight/weekend gap.",
              "On-chain liquidity: DEX depth on Robinhood Chain, value sellable at ≤5% slippage, drives borrow cap.",
              "Oracle quality: feed existence on this chain, heartbeat, deviation threshold, operating hours.",
              "Contract & issuer risk: for Stock Tokens, Jersey-entity credit risk, issuer pause/allowlist powers, SEC-scrutiny overhang; for crypto, audit history, upgradeability, admin keys.",
              "Holder concentration: top-10 holders > 50% supply, isolated-only or rejected.",
              "Track record: token age (≥90 days for speculative), depeg/exploit history.",
            ].map((item, i) => (
              <div key={i} className="flex gap-3 text-sm" style={{ color: "#888888" }}>
                <span className="shrink-0 text-xs mt-0.5 font-bold" style={{ color: A, fontFamily: MONO }}>{i + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <SubHead title="10.2 Equity LT Derivation" />
          <Code>{`LT_equity = LT_base − gapBuffer − issuerHaircut

gapBuffer    = max( worst 2-yr gap-open, 2 × daily ATR )
issuerHaircut ≥ 5%   (Jersey-entity credit + regulatory overhang, F2/F3)

Example (mega-cap, worst gap ≈ 9%, ATR-implied 8%):
  LT = 80% (base) − 9% − 5% ≈ 66% → published LT 65%, LTV 55%

High-gap single name (worst gap ≈ 20%+):
  LT ≈ 45-50% , visibly harsher terms than index-like ETFs.`}</Code>
          <SubHead title="10.3 Launch Parameter Tables" />
          <p className="text-xs font-bold uppercase tracking-widest mb-2 mt-6" style={{ color: "#555555", fontFamily: MONO }}>Tier 1: Stablecoins (Main Market)</p>
          <Table
            head={["Asset", "LTV", "LT", "Liq. Bonus", "Supply Cap", "Notes"]}
            rows={[
              ["USDG", "85%", "90%", "4%", "$10M", "Borrow asset; also usable as collateral"],
              ["USDC (bridged)", "82%", "87%", "5%", "$5M", "List only after verifying the canonical bridge contract"],
            ]}
          />
          <p className="text-xs font-bold uppercase tracking-widest mb-2 mt-6" style={{ color: "#555555", fontFamily: MONO }}>Tier 2: Blue-Chip Crypto (Main Market)</p>
          <Table
            head={["Asset", "LTV", "LT", "Liq. Bonus", "Supply Cap"]}
            rows={[["WETH", "75%", "80%", "6%", "$5M"]]}
          />
          <p className="text-xs font-bold uppercase tracking-widest mb-2 mt-6" style={{ color: "#555555", fontFamily: MONO }}>Tier 3: Stock Tokens (Main Market + Market-Hours Policy §7.3)</p>
          <Table
            head={["Bucket", "LTV", "LT", "Liq. Bonus", "Supply Cap", "Rationale"]}
            rows={[
              ["Mega-cap, low gap history (e.g. AAPL, MSFT)", "55%", "65%", "8%", "$1M/asset", "§10.2 derivation"],
              ["Broad ETFs / large caps", "45-50%", "55-60%", "10%", "$500k/asset", "Lower idiosyncratic gap risk than single names, but thinner token liquidity"],
              ["High-volatility single names (e.g. TSLA-class)", "35%", "45%", "12%", "$250k/asset", "Gap history dominates"],
            ]}
          />
          <p className="text-xs font-bold uppercase tracking-widest mb-2 mt-6" style={{ color: "#555555", fontFamily: MONO }}>Tier 4: Speculative Assets (Isolated Only)</p>
          <Table
            head={["Parameter", "Value"]}
            rows={[
              ["LTV / LT", "20-25% / 30-35%"],
              ["Liquidation bonus", "15%"],
              ["Debt ceiling per market", "$100k-$250k, pegged to measured DEX depth"],
              ["Listing preconditions", "Verified oracle (KEEPER-sourced via OracleRouter) + ≥90-day age + concentration pass + token-contract review"],
            ]}
          />
          <Note><strong>Tier 5: Other RWAs</strong> not listed until oracle and legal structure clarity exist. Declared honestly rather than promised vaguely.</Note>
          <SubHead title="10.4 Parameter Governance Cadence" />
          <P>New listing: public proposal → 6-dimension assessment → approval → 48h timelock. Routine review: monthly; ad-hoc review triggered by {">"} 30% shift in volatility or DEX depth. Early-phase governance = disclosed 3/5 team multisig behind timelocks; DAO migration only with a concrete plan.</P>

          {/* ── 11. Implementation ── */}
          <SectionHead id="implementation" n="11" title="Implementation Guide" />
          <SubHead title="11.1 Repository Layout" />
          <Code>{`liquihood/
├── contracts/                  # Foundry project
│   ├── src/
│   │   ├── core/               # PoolManager, RiskEngine
│   │   ├── tokens/             # lhToken, dToken
│   │   ├── oracle/             # OracleRouter, MarketCalendar
│   │   ├── liquidation/        # LiquidationManager, BadDebtModule
│   │   ├── adapters/           # StockTokenAdapter, StandardERC20Adapter
│   │   ├── rates/              # InterestRateModel
│   │   └── governance/         # Timelock wiring, Guardian
│   ├── test/                   # unit / fuzz / invariant / fork
│   └── script/                 # deploy & config scripts
├── frontend/                   # Next.js + TS + Tailwind + Wagmi/Viem
├── indexer/                    # event indexer → PostgreSQL (Supabase)
├── bots/
│   ├── liquidator/             # open-source reference liquidation bot
│   └── keepers/                # market-calendar keeper, monitoring keeper
└── docs/`}</Code>
          <SubHead title="11.2 Stack Decisions (Validated Against F1)" />
          <Table
            head={["Layer", "Choice", "Validation"]}
            rows={[
              ["Contracts", "Solidity 0.8.x, Foundry, OpenZeppelin (UUPS, SafeERC20, AccessControl)", "Standard EVM, valid on Orbit-stack L2 (F1)"],
              ["Frontend", "Next.js, TypeScript, Tailwind, Wagmi + Viem; WalletConnect", "Valid (F1). No brokerage API integration anywhere."],
              ["Data", "Event indexer → PostgreSQL/Supabase; positions table with computed HF", "Required for liquidator UX and monitoring"],
              ["Oracles", "OracleRouter KEEPER source (keeper EOA pushes every 5 min); FIXED for USDG; CHAINLINK reserved for when verified on-chain feeds exist", "F6"],
              ["Gas", "ETH (F1); bot treasuries hold ETH, not a native token", "F1"],
            ]}
          />
          <SubHead title="11.3 Build Order (6 Stages)" />
          <div className="space-y-2 my-4">
            {[
              ["Stage 0", "Verification spike (§14) before real code. Cheap, fast, converts assumptions into facts."],
              ["Stage 1", "Accounting core: InterestRateModel, LHToken/DebtToken, PoolManager supply/withdraw/borrow/repay against a mocked oracle. Exit criteria: invariant tests green."],
              ["Stage 2", "Risk layer: RiskEngine, HF math, caps, isolated-mode accounting, action gating (1.02 / 1.30 rules)."],
              ["Stage 3", "Oracle layer: OracleRouter with full validation pipeline; MarketCalendar; fork tests against real Robinhood Chain feeds."],
              ["Stage 4", "Liquidation: LiquidationManager, BadDebtModule, grace queue; adversarial test suite."],
              ["Stage 5", "Adapters & integration: StockTokenAdapter against real token contracts on fork; end-to-end flows; deploy scripts; guarded-launch configuration."],
            ].map(([stage, body]) => (
              <div key={stage} className="flex gap-3 rounded-xl p-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded" style={{ background: "rgba(208,239,25,0.1)", color: A, fontFamily: MONO, whiteSpace: "nowrap" }}>{stage}</span>
                <p className="text-sm leading-relaxed" style={{ color: "#777777" }}>{body}</p>
              </div>
            ))}
          </div>
          <SubHead title="11.4 Mainnet Deployment Sequence" />
          <Code>{`1. Deploy Timelock + Guardian multisig wiring
2. Deploy implementation contracts → UUPS proxies (admin = Timelock)
3. Deploy InterestRateModel, OracleRouter (feeds configured, verified on-chain)
4. Deploy lhToken/dToken pairs; wire LendingPool ↔ HealthFactorEngine ↔ OracleRouter
5. Configure Tier 1–2 assets ONLY at 10–20% of target caps (guarded launch)
6. Seed treasury USDG liquidity; publish addresses + verification
7. Week 2–4: enable first Stock Token (single mega-cap) at reduced caps
8. Month 2+: cap raises and further listings strictly per measured data`}</Code>
          <SubHead title="11.5 Testing Strategy" />
          <ul className="space-y-2 text-sm my-4" style={{ color: "#888888" }}>
            {[
              ["Unit tests", "Per function, including revert paths."],
              ["Fuzz tests", "All math: interest accrual across time jumps, exchange-rate rounding (protocol-favoring everywhere; rounding exploits are a real, exploited class)."],
              ["Invariant tests (Foundry)", "Aggregate solvency; Σ user debt == dUSDG supply; no operation sequence yields free value; isolated-market losses never touch Main Market accounting."],
              ["Fork tests", "Real feeds, real Stock Token contracts, real DEX routing for the liquidation bot on Robinhood Chain."],
              ["Adversarial scenarios", "Stale-oracle weekend gap (−25% Monday open); oracle pinned at minAnswer; issuer freezes token mid-liquidation; utilization 100% withdrawal crunch; memecoin −90% in one block inside an isolated market; sequencer 6h outage replay."],
              ["Static/dynamic analysis", "Slither + semgrep in CI; Echidna/Medusa campaign pre-audit."],
            ].map(([name, body]) => (
              <li key={name} className="flex gap-3">
                <span className="shrink-0 font-semibold text-xs mt-0.5" style={{ color: A, fontFamily: MONO, whiteSpace: "nowrap" }}>{name}</span>
                <span>{body}</span>
              </li>
            ))}
          </ul>
          <SubHead title="11.6 Off-Chain Services" />
          <P><strong style={{ color: "#CDCDCD" }}>Reference liquidation bot (open-source):</strong> watches indexer for HF ≤ threshold, simulates profitability (gas + measured slippage), executes, sells via DEX router. Shipping this is a solvency feature, not a courtesy.</P>
          <P><strong style={{ color: "#CDCDCD" }}>Market-calendar keeper:</strong> pushes NYSE/Nasdaq session state; conservative default = closed.</P>
          <P><strong style={{ color: "#CDCDCD" }}>Monitoring/alerting:</strong> utilization {">"} 90%; HF distribution mass near 1.0; oracle deviation events; issuer-pause events; Insurance Fund balance; sequencer heartbeat.</P>

          {/* ── 12. Security ── */}
          <SectionHead id="security" n="12" title="Security Program" />
          <Table
            head={["Item", "Commitment"]}
            rows={[
              ["Audits", "Planned: ≥ 2 independent firms; re-audit on every major upgrade. Not yet completed at v1 launch — guarded caps apply until audits are done."],
              ["Bug bounty", "Planned post-audit. Not live at v1 launch. Responsible disclosure: contact team directly."],
              ["Guarded launch", "Month 1: caps at 10-20% of target + per-wallet deposit caps"],
              ["Admin risk", "All privileged ops behind 24/48h timelocks; Guardian is pause-only and cannot move funds; all multisig signers' policies disclosed"],
              ["Un-pausable user exits", "repay and supply immune to pause by construction"],
              ["Incident response", "Pre-written playbooks: oracle failure, issuer freeze, bad debt event, sequencer outage, each with a public-comms template"],
            ]}
          />

          {/* ── 13. Roadmap ── */}
          <SectionHead id="roadmap" n="13" title="Revised Roadmap" />
          <div className="space-y-4 mt-6">
            {[
              {
                phase: "Phase 1", label: "Core (True Minimum Viable Protocol)",
                items: ["Supply & Earn (moved from Phase 2)", "Deposit & Borrow (Tiers 1-3, guarded caps)", "Isolated Markets for Tier 4 (moved from Phase 2)", "Health Factor + Liquidation Engine + Insurance Fund", "OracleRouter + Market-Hours Policy", "Open-source liquidation bot", "2 audits + bounty + guarded launch"],
              },
              {
                phase: "Phase 2", label: "Expansion",
                items: ["Full multi-asset vault UX + portfolio dashboard", "E-mode for correlated assets (stablecoin↔stablecoin efficiency)", "Additional Stock Tokens and cap raises driven by measured liquidity", "Supply-side incentive program (competitive response to F7)"],
              },
              {
                phase: "Phase 3", label: "Advanced",
                items: ["Fixed-rate loans", "Auto-repay", "Portfolio credit lines", "Permissionless listings restricted to Isolated Markets under a hard parameter template, never permissionless into the Main Market"],
              },
            ].map(({ phase, label, items }) => (
              <div key={phase} className="rounded-xl p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(208,239,25,0.1)", color: A, fontFamily: MONO }}>{phase}</span>
                  <span className="text-sm font-semibold" style={{ color: "#CDCDCD" }}>{label}</span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm" style={{ color: "#777777" }}>
                      <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" style={{ color: A }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* ── 14. Checklist ── */}
          <SectionHead id="checklist" n="14" title="Open Assumptions & Pre-Build Verification Checklist" />
          <Note>These items were flagged as of July 12, 2026. V1–V4 have been partially resolved at the v1 launch. Each is cheap relative to what it de-risks.</Note>
          <Table
            head={["#", "Item", "Method", "Blocks"]}
            rows={[
              ["V1", "Per-token behavior of 2-3 sample Stock Token contracts: transfer restrictions, pause/allowlist powers, corporate-action mechanics (ERC-8056 draft status)", "Read verified source on-chain; testnet dust transfers into a test contract", "StockTokenAdapter design; Tier 3 listing at all"],
              ["V2", "Chainlink feed addresses for every launch asset on Robinhood Chain (not Arbitrum One)", "Enumerate feeds on-chain; confirm heartbeat/deviation specs", "OracleRouter config"],
              ["V3", "Sequencer-uptime feed availability", "Chain docs / Chainlink deployment inspection", "§7.4 mechanism choice"],
              ["V4", "Real DEX depth per candidate asset (value sellable at ≤5% slippage)", "Scripted quote sampling on Uniswap + zero-fee DEX, weekly", "Every borrow cap number in §10.3"],
              ["V5", "Legal opinion: lending against tokenized debt securities per target jurisdiction; whether geo-blocking is required", "External counsel", "Mainnet launch"],
              ["V6", "USDG contract mechanics on-chain (blacklist functions, upgrade authority)", "Contract review", "Pause playbooks"],
            ]}
          />
          <Note>If V1 or V2 fails for Stock Tokens, Phase 1 launches with Tiers 1-2 + Tier 4 isolated markets only, and Tier 3 waits. The protocol degrades gracefully rather than launching on hope.</Note>

          {/* ── 15. Failure Modes ── */}
          <SectionHead id="failure-modes" n="15" title="Failure Mode Analysis (Honest Assessment)" />
          <P>No lending protocol can be "100% guaranteed to work." The correct claim is: known failure modes are enumerated, bounded, and absorbed.</P>
          <Table
            head={["Failure Mode", "Likelihood", "Max Impact (with this design)", "Containment"]}
            rows={[
              ["Smart-contract bug despite audits", "Low, never zero", "Funds at risk up to caps", "2 audits, fuzz/invariant testing, guarded launch caps, bounty, pause"],
              ["Stale-price weekend gap exceeding buffer", "Moderate over years", "Bad debt on equity markets", "Gap-buffered LTs, off-hours borrow block, Insurance Fund, waterfall §9.4"],
              ["Memecoin oracle/liquidity manipulation", "High attempt rate", "≤ isolated debt ceiling per market", "Isolation + ceilings + feed-required rule + concentration screens"],
              ["Issuer freezes a Stock Token", "Possible (issuer holds the power)", "Temporary illiquidity of that collateral", "Adapter auto-freeze, grace queue, issuer haircut already in LT"],
              ["Issuer credit/regulatory event (F2/F3)", "Unknowable, non-trivial", "Impairment of all Tier 3 collateral", "The one risk code cannot fix: haircuts + caps bound exposure; legal review (V5); disclosure"],
              ["USDG depeg", "Low", "Borrow-power distortion", "Feed-priced USDG, global freeze playbook"],
              ["Sequencer outage", "Occasional (single sequencer)", "Delayed liquidations, unfair restarts", "§7.4 grace mechanism"],
              ["Liquidity crunch (100% utilization)", "Moderate early", "Delayed supplier withdrawals", "Punitive kink (§8), caps, incentives"],
              ["No liquidators on young chain", "High if unaddressed", "Insolvency drift", "Ship the bot ourselves (§11.6); bonuses sized to real costs"],
            ]}
          />
          <Note><strong>Bottom line:</strong> technical buildability on this chain is near-certain (standard EVM, proven architecture patterns). Operational soundness at launch is achievable conditional on §14 verification passing and clean audits. Residual risk (exploits, issuer/regulatory shocks, unprecedented market gaps) is permanent and can only be managed, never eliminated. That is precisely why the Insurance Fund, isolation, caps, and the loss waterfall are core product features rather than fine print.</Note>

          {/* ── 16. Interfaces ── */}
          <SectionHead id="interfaces" n="16" title="Appendix: Solidity Interface Sketches" />
          <Code>{`// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

interface IPoolManager {
    // ── Supply side ──────────────────────────────────────────────
    function supply(uint256 amount) external;                  // USDG in, lhUSDG out
    function withdraw(uint256 lAmount) external;                // lhUSDG in, USDG out

    // ── Borrow side ──────────────────────────────────────────────
    function depositCollateral(address asset, uint256 amount) external;
    function withdrawCollateral(address asset, uint256 amount) external; // HF-gated
    function borrow(uint256 amount) external;                   // HF- & hours-gated
    function repay(uint256 amount) external;                    // never pausable

    // ── Liquidation ──────────────────────────────────────────────
    function liquidate(
        address user,
        address collateralAsset,
        uint256 repayAmount
    ) external returns (uint256 seized);
}

interface IRiskEngine {
    struct AssetConfig {
        uint16 ltv;                   // bps, e.g. 5500 = 55%
        uint16 liquidationThreshold;  // bps
        uint16 liquidationBonus;      // bps
        uint128 supplyCap;
        uint128 borrowCap;            // or debtCeiling when isolated
        uint8  assetClass;            // 0=Stable 1=Crypto 2=Equity 3=Speculative
        uint8  marketStatus;          // 0=Active 1=Frozen 2=Paused 3=Deprecated
        bool   isolated;
    }

    function healthFactor(address user) external view returns (uint256); // 1e18
    function validateBorrow(address user, uint256 amount) external view;
    function validateWithdrawCollateral(
        address user, address asset, uint256 amount
    ) external view;
}

interface IOracleRouter {
    enum PriceStatus { Valid, Stale, OutOfBounds, Deviated, MarketClosed }

    /// @notice Validated price; reverts or flags per §7.2 pipeline
    function getPrice(address asset)
        external view returns (uint256 price1e18, PriceStatus status);

    function isUnderlyingMarketOpen(address asset) external view returns (bool);
}

interface ICollateralAdapter {
    /// @dev fail-closed: any unrecognized issuer/scaling state must revert
    function validateDeposit(address asset, uint256 amount) external view;
    function isTransferable(address asset) external view returns (bool);
    /// @dev ERC-8056 scaled-amount normalization for equity tokens
    function normalizedBalance(address asset, address user)
        external view returns (uint256);
}`}</Code>

          {/* ── 17. Deployed Contracts ── */}
          <SectionHead id="deployed-contracts" n="17" title="Deployed Contracts — Robinhood Chain (Chain ID 4663)" />
          <P>
            All core Liquihood contracts are live on Robinhood Chain mainnet. Every address below is source-deployed and wired; no proxies or placeholders. ENS-compatible names are registered on-chain via the <Mono>ProtocolNameRegistry</Mono> contract — resolve any name with <Mono>resolve("pool.liquihood")</Mono>.
          </P>
          <Note>
            All 6 active assets (USDG, ETH, WETH, AAPL-T, TSLA-T, HOOD-T) are live with oracle prices, risk parameters, and reserves fully configured on-chain. The keeper price service pushes updates every 5 minutes for ETH, WETH, AAPL-T, TSLA-T, and HOOD-T. USDG is pegged at $1.00 (FIXED source). All 6 are in the Main Market. Isolated Market infrastructure is deployed and ready — new markets can be created permissionlessly via the Add Market page.
          </Note>

          {/* ── Contract grid ── */}
          <div className="space-y-5 mt-8">

            {/* LendingPool */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>LendingPool</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>pool.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  The single user-facing entry point for all protocol interactions. Every supply, borrow, repay, withdraw, and liquidation call goes through this contract. On <Mono>addReserve</Mono>, it deploys a new <Mono>LHToken</Mono> (supply receipt) and <Mono>DebtToken</Mono> (debt tracker) pair for each asset. Guards every state-changing path with a reentrancy lock; pulls the exact received amount via <Mono>balanceBefore/After</Mono> to neutralize fee-on-transfer tokens.
                </p>
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>supply(asset, amount)</Mono>, "Deposits asset into the pool; mints proportional LHTokens to the caller at the current exchange rate."],
                    [<Mono>withdraw(asset, amount)</Mono>, "Burns LHTokens; returns underlying asset; reverts if the pool has insufficient cash."],
                    [<Mono>borrow(asset, amount)</Mono>, "Draws asset from the pool; gated by Health Factor ≥ 1.02, borrow cap, and market-hours policy for equity collateral."],
                    [<Mono>repay(asset, amount)</Mono>, "Settles outstanding debt; can never be paused; accepts full or partial repayment."],
                    [<Mono>liquidate(user, collateral, repayAmt)</Mono>, "Repays up to the close factor on a sub-1.0 HF position; seizes collateral plus bonus from the borrower."],
                    [<Mono>addReserve(asset, params)</Mono>, "Owner-only: lists a new asset, deploys its LHToken/DebtToken, wires oracle and rate model."],
                  ]}
                />
              </div>
            </div>

            {/* OracleRouter */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>OracleRouter</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>oracle.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0x9c445077D3826C706A1f39413F2508cc09049827" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0x9c445077D3826C706A1f39413F2508cc09049827
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  Routes every price request through a three-source architecture and a mandatory validation pipeline before any price is used to move funds. A 10% single-update deviation triggers an automatic market freeze pending guardian review. Staleness is checked per-asset against a configured heartbeat; stale prices are rejected, not silently used.
                </p>
                <Table
                  head={["Source type", "Used for", "Staleness guard"]}
                  rows={[
                    ["KEEPER", "All live market assets — ETH, WETH, AAPL-T, TSLA-T, HOOD-T. Price pushed every 5 min by keeper EOA.", "5-min staleness window (300 s); 10% per-update deviation cap"],
                    ["FIXED", "Stablecoin — USDG hardcoded at $1.00", "No staleness (constant)"],
                    ["CHAINLINK", "Reserved for future Chainlink-native feeds on Robinhood Chain (not yet configured)", "Feed heartbeat + grace window"],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>getPrice(asset)</Mono>, "Returns validated price in 1e18 USD. Reverts if stale, out-of-bounds, or deviation triggered."],
                    [<Mono>pushPrice(asset, price)</Mono>, "Keeper-only: pushes a fresh price for any KEEPER-source asset; triggers circuit-breaker if move exceeds 10%."],
                    [<Mono>configureAsset(asset, src, feed)</Mono>, "Owner-only: registers an asset with its source type and feed address."],
                  ]}
                />
              </div>
            </div>

            {/* InterestRateModel */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>InterestRateModel</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>rates.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0x419D74beFA27CE808C9c863533193847F25EFb6F" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0x419D74beFA27CE808C9c863533193847F25EFb6F
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  Stateless kinked utilization curve. Returns per-second borrow and supply rates as a function of the pool's current utilization ratio. The kink at 80% is both a rate boundary and a liquidity guarantee: above it, rates spike sharply enough to attract new supply or force repayments, restoring withdrawability automatically.
                </p>
                <Table
                  head={["Parameter", "Value", "Effect"]}
                  rows={[
                    ["Optimal utilization (U*)", "80%", "Rates are gentle below this; punitive above it"],
                    ["Base rate (R0)", "0%", "No floor; borrowers pay only for what they use"],
                    ["Slope 1 — below kink", "6.5% annual", "At U=80%: borrow ≈ 6.5%, supply ≈ 4.7%"],
                    ["Slope 2 — above kink", "60% annual", "At U=95%: borrow ≈ 51.5%, fully self-correcting"],
                    ["Reserve factor", "10%", "10% of borrow interest flows to the Insurance Fund"],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>getBorrowRate(cash, borrows)</Mono>, "Returns annualized borrow rate in ray (1e27) for the current pool state."],
                    [<Mono>getSupplyRate(cash, borrows)</Mono>, "Returns annualized supply rate after the reserve factor deduction."],
                  ]}
                />
              </div>
            </div>

            {/* HealthFactorEngine */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>HealthFactorEngine</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>health.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0x394b8bc59bC3a01dFaDbe7acc6b924F393ADF2dA
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  Computes the Health Factor that governs every borrow, collateral withdrawal, and liquidation decision. HF is the ratio of weighted collateral value (at liquidation threshold) to total outstanding debt. Any action that would push HF below 1.02 is reverted before it executes. HF below 1.00 makes a position liquidatable.
                </p>
                <Code>{`HF = Σ( collateral_i × price_i × liquidationThreshold_i )
     ──────────────────────────────────────────────────
                  totalDebt × priceUSDG

HF > 1.02  →  borrow / withdrawCollateral allowed
HF ≤ 1.00  →  position is liquidatable
HF < 0.90  →  full close-factor (100%) unlocked`}</Code>
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>healthFactor(user)</Mono>, "Returns the current HF for a user as a 1e18 fixed-point number."],
                    [<Mono>isLiquidatable(user)</Mono>, "Returns true if HF ≤ 1.00; used by liquidators and keepers."],
                    [<Mono>maxBorrowable(user)</Mono>, "Returns the maximum additional USDG borrowable while keeping HF ≥ 1.02."],
                    [<Mono>setAssetConfig(asset, ltv, lt, bonus)</Mono>, "Owner-only: configures per-asset LTV, liquidation threshold, and liquidation bonus."],
                  ]}
                />
              </div>
            </div>

            {/* InsuranceFund */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>InsuranceFund</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>insurance.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0xb89Bc97cA63A4Beb1edeD769E13CE1E441Eeb87F" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0xb89Bc97cA63A4Beb1edeD769E13CE1E441Eeb87F
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  The protocol's first-loss buffer, positioned ahead of suppliers in the loss waterfall. Reserves accumulate automatically from two streams: 10% of all borrow interest (the reserve factor) and 10% of every liquidation bonus. In a bad-debt event the Insurance Fund absorbs the shortfall first; only if it is exhausted does the loss socialize to suppliers through a haircut on the LHToken exchange rate.
                </p>
                <Table
                  head={["Inflow source", "Rate", "Trigger"]}
                  rows={[
                    ["Reserve factor on borrow interest", "10% of interest earned", "Continuous; accrues every block"],
                    ["Liquidation fee share", "10% of the liquidation bonus on every liquidation", "Per-liquidation event"],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>accrueReserves(asset, amount)</Mono>, "LendingPool-only: records incoming reserve accumulation for an asset."],
                    [<Mono>coverBadDebt(asset, shortfall)</Mono>, "LendingPool-only: draws from reserves to absorb a confirmed bad-debt shortfall."],
                    [<Mono>balance(asset)</Mono>, "Returns the current Insurance Fund balance for a given asset."],
                  ]}
                />
              </div>
            </div>

            {/* LiquidationManager */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>LiquidationManager</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>liquidator.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0x13EC47404D1a54D7Bed50Cda76D41254319de3CE" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0x13EC47404D1a54D7Bed50Cda76D41254319de3CE
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  A stateless calculation module called by <Mono>LendingPool.liquidate()</Mono>. It determines exactly how much collateral to seize for a given repayment amount and splits the liquidation bonus between the liquidator (90%) and the Insurance Fund (10%). By keeping this logic separate, the accounting in <Mono>LendingPool</Mono> stays clean and the bonus math is independently auditable.
                </p>
                <Table
                  head={["Parameter", "Value", "Notes"]}
                  rows={[
                    ["Close factor (normal)", "50% of outstanding debt per call", "Preserves borrower equity in mild breaches"],
                    ["Close factor (deep breach, HF < 0.90)", "100% of debt", "Full closure when position is critically underwater"],
                    ["Close factor (dust, position < $50)", "100%", "Economically unprofitable to partially liquidate tiny positions"],
                    ["Bonus to liquidator", "90% of the liquidation bonus", "Must exceed gas + DEX slippage or nobody liquidates"],
                    ["Bonus to Insurance Fund", "10% of the liquidation bonus", "Compounds the fund's reserves on every healthy liquidation"],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>computeSeize(collateral, debt, repay, bonus)</Mono>, "Returns the exact collateral amount to seize given a repayment amount and bonus rate."],
                    [<Mono>splitBonus(bonusAmount)</Mono>, "Returns the 90/10 split: (liquidatorShare, insuranceShare)."],
                  ]}
                />
              </div>
            </div>

            {/* IsolatedMarketController */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>IsolatedMarketController</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>isolated.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0x4596073d475F1ebCcdB18f4BDb64463368695B1d" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0x4596073d475F1ebCcdB18f4BDb64463368695B1d
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  Enforces hard isolation for speculative assets (Tier 4: memecoins, high-volatility tokens). Each isolated asset carries a hard debt ceiling — the maximum total USDG borrowable against that collateral, protocol-wide. Isolated borrowers may only borrow stablecoins; cross-collateralization with the main pool is structurally impossible. Any bad debt from an isolated market is contained to that market and cannot socialize to the main supply pool.
                </p>
                <Table
                  head={["Status", "Details", "Notes"]}
                  rows={[
                    ["No active isolated assets", "The infrastructure is fully deployed and operational. No Tier 4 assets are currently listed.", "New isolated markets can be created permissionlessly via the Add Market page. Each market requires a verified oracle, a hard debt ceiling, and passes the 6-dimension listing assessment (§10.1)."],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>validateBorrow(asset, amount)</Mono>, "Reverts if this borrow would push total isolated debt above the asset's ceiling."],
                    [<Mono>setDebtCeiling(asset, ceiling)</Mono>, "Owner-only: sets or updates the ceiling for an isolated asset."],
                    [<Mono>getIsolatedDebt(asset)</Mono>, "Returns the current total USDG borrowed against a specific isolated asset."],
                  ]}
                />
              </div>
            </div>

            {/* MarketHoursPolicy */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>MarketHoursPolicy</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: MONO }}>hours.liquihood</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0xe71dbE28d26208648644d11e6f92D6305c2561Cb" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0xe71dbE28d26208648644d11e6f92D6305c2561Cb
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  Enforces NYSE/Nasdaq trading-session awareness for equity collateral (Stock Tokens). Because the chain runs 24/7 but stock prices only update ~32.5 hours per week, allowing new equity-backed borrows off-hours hands attackers a free option: borrow at Friday's close, gap down over the weekend, default on Monday. This contract blocks new equity-backed borrowing when underlying markets are closed, while leaving existing positions and repayments untouched.
                </p>
                <Table
                  head={["Condition", "New equity-backed borrow", "Withdraw equity collateral", "Liquidations"]}
                  rows={[
                    ["Market OPEN, price feed live", "✅ allowed (HF ≥ 1.02)", "✅ allowed (HF ≥ 1.02)", "✅ active"],
                    ["Market CLOSED (nights / weekends / holidays)", "❌ blocked — equity contributes 0 to new borrowing power", "✅ allowed only if post-action HF ≥ 1.30", "✅ active at last-close price"],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>isMarketOpen()</Mono>, "Returns true if the keeper has toggled the session open and the 8-hour TTL has not expired."],
                    [<Mono>openMarket()</Mono>, "Keeper-only: signals that NYSE/Nasdaq regular session is open; sets an 8-hour auto-expiry."],
                    [<Mono>closeMarket()</Mono>, "Keeper-only: explicitly marks the session closed (also happens automatically on TTL expiry)."],
                    [<Mono>setKeeper(address)</Mono>, "Owner-only: rotates the keeper EOA responsible for pushing session state."],
                  ]}
                />
              </div>
            </div>

            {/* ProtocolNameRegistry */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>ProtocolNameRegistry</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "#777777", fontFamily: MONO }}>ENS registry</span>
                  </div>
                  <a href="https://explorer.robinhood.com/address/0x2aba92C18A85F5bb8816Dc9373d8D8db1B209C1c" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: "#555555", fontFamily: MONO }}>
                    0x2aba92C18A85F5bb8816Dc9373d8D8db1B209C1c
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>
                  An ENS-compatible on-chain name registry for Robinhood Chain. Uses the same EIP-137 namehash algorithm as the Ethereum Name Service, so any ENS-aware tooling can resolve Liquihood contract addresses without touching Ethereum mainnet. All 8 core protocol contracts are already registered. Resolve a name with a single read call — no off-chain lookup required.
                </p>
                <Code>{`// Resolve by name (EIP-137 namehash computed on-chain)
registry.resolve("pool.liquihood")
// → 0xD26F926CEBdd169D87c5a615C18A3A8AddbBdF6E

// Enumerate all registered contracts
(nodes, names, addresses) = registry.getAllEntries();`}</Code>
                <Table
                  head={["ENS name", "Contract", "Address"]}
                  rows={[
                    ["pool.liquihood",       "LendingPool",              "0xD26F926…dF6E"],
                    ["oracle.liquihood",     "OracleRouter",             "0x9c4450…9827"],
                    ["rates.liquihood",      "InterestRateModel",        "0x419D74…Fb6F"],
                    ["health.liquihood",     "HealthFactorEngine",       "0x394b8b…F2dA"],
                    ["insurance.liquihood",  "InsuranceFund",            "0xb89Bc9…87F"],
                    ["liquidator.liquihood", "LiquidationManager",       "0x13EC47…3CE"],
                    ["isolated.liquihood",   "IsolatedMarketController", "0x459607…B1d"],
                    ["hours.liquihood",      "MarketHoursPolicy",        "0xe71dbE…61Cb"],
                  ]}
                />
                <Table
                  head={["Function", "What it does"]}
                  rows={[
                    [<Mono>resolve(name)</Mono>, "Returns the address registered for a dot-separated name. Returns address(0) if not registered."],
                    [<Mono>namehash(name)</Mono>, "Computes the EIP-137 namehash on-chain — same algorithm used by ENS on Ethereum mainnet."],
                    [<Mono>getAllEntries()</Mono>, "Returns all (node, name, address) tuples — useful for UI enumeration and monitoring tools."],
                    [<Mono>register(name, addr)</Mono>, "Owner-only: registers a new name. Reverts if already registered."],
                    [<Mono>update(name, addr)</Mono>, "Owner-only: updates the address for an existing name (e.g. after a contract upgrade)."],
                  ]}
                />
              </div>
            </div>

            {/* LHToken / DebtToken — dynamically deployed */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: "#EDEDED", fontFamily: MONO }}>LHToken + DebtToken</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "#777777", fontFamily: MONO }}>deployed per reserve</span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: "#444444", fontFamily: MONO }}>Addresses assigned automatically by LendingPool.addReserve() — one pair per listed asset</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <Table
                  head={["Token", "Represents", "Transferable", "Accounting"]}
                  rows={[
                    [<><Mono>LHToken</Mono> (e.g. lhUSDG)</>, "Supply receipt: 1 LHToken = your share of the pool's deposited asset. Exchange rate rises over time as interest accrues.", "Yes — freely transferable ERC-20", "Scaled-balance: the token balance stays constant; the exchange rate grows"],
                    [<Mono>DebtToken</Mono>, "Debt tracker: records exactly how much you owe. Cannot be transferred — borrowers cannot offload their debt obligation.", "No — transfer always reverts", "Scaled-balance: balance grows continuously as interest accrues"],
                  ]}
                />
              </div>
            </div>

          </div>{/* end contract grid */}

          {/* Footer note */}
          <div className="mt-16 pt-8 border-t text-xs leading-relaxed" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#444444", fontFamily: MONO }}>
            All numeric parameters are conservative launch values to be recalibrated with live on-chain data and audit findings.
            This document intentionally lists what is unverified (§14) and what cannot be guaranteed (§15);
            any version without those sections should be treated as marketing, not engineering.
          </div>

        </main>
      </div>
    </div>
  );
}
