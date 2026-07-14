import { motion } from "framer-motion";
import { Layers, Box, Clock, Globe, Shield, TrendingUp } from "lucide-react";

const ACCENT = "#D0EF19";
const MONO = "'JetBrains Mono', monospace";

// ── Shared card icon box ─────────────────────────────────────
function CardIcon({ Icon }: { Icon: React.ElementType }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <Icon className="w-5 h-5" style={{ color: "#888888" }} strokeWidth={1.5} />
    </div>
  );
}

// ── Composition bar (Universal Collateral) ───────────────────
function CompositionBar() {
  const segs = [
    { label: "AAPL-T", pct: 44, color: ACCENT },
    { label: "WETH",   pct: 34, color: "rgba(208,239,25,0.55)" },
    { label: "HOOD-T", pct: 22, color: "rgba(208,239,25,0.22)" },
  ];
  return (
    <div className="w-full flex flex-col gap-2.5 mt-2">
      <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ gap: 2 }}>
        {segs.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, borderRadius: 4 }} />
        ))}
      </div>
      <div className="flex gap-4">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs" style={{ color: "#444", fontFamily: MONO }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Asset table (Multi-Asset Vault) ─────────────────────────
function AssetTable() {
  const rows = [
    { asset: "AAPL-T", pct: 44 },
    { asset: "WETH",   pct: 34 },
    { asset: "HOOD-T", pct: 22 },
  ];
  return (
    <div
      className="w-full rounded-xl overflow-hidden mt-2"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {rows.map((r, i) => (
        <div
          key={r.asset}
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
        >
          <span className="text-xs w-14 shrink-0" style={{ color: "#777", fontFamily: MONO }}>{r.asset}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: ACCENT }} />
          </div>
          <span className="text-xs w-8 text-right shrink-0" style={{ color: "#555", fontFamily: MONO }}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Market calendar (Market-Hours) ───────────────────────────
function MarketCalendar() {
  const days = [
    { d: "M", open: true }, { d: "T", open: true }, { d: "W", open: true },
    { d: "T", open: true }, { d: "F", open: true }, { d: "S", open: false }, { d: "S", open: false },
  ];
  return (
    <div className="w-full flex items-end gap-2 mt-2">
      {days.map((day, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
          <div
            className="w-full rounded"
            style={{
              height: day.open ? 44 : 18,
              background: day.open ? ACCENT : "rgba(255,255,255,0.07)",
            }}
          />
          <span className="text-xs" style={{ color: day.open ? "rgba(208,239,25,0.55)" : "#333", fontFamily: MONO }}>
            {day.d}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Isolation buttons (Isolated Markets) ────────────────────
function IsolationButtons() {
  return (
    <div className="flex gap-3 mt-2">
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center"
        style={{ border: "1px solid rgba(208,239,25,0.4)", color: "rgba(208,239,25,0.8)", fontFamily: MONO }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />
        Main
      </div>
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center"
        style={{ border: "1px dashed rgba(255,80,80,0.45)", color: "rgba(255,100,100,0.7)", fontFamily: MONO }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(255,80,80,0.7)" }} />
        Isolated
      </div>
    </div>
  );
}

// ── HF Gauge (Health Factor) ─────────────────────────────────
function HFGauge() {
  const hf = 1.82, maxHF = 2;
  const R = 26, circ = 2 * Math.PI * R;
  const pct = Math.min(hf / maxHF, 1);
  const arcLen = circ * 0.75;
  const fillLen = pct * arcLen;
  return (
    <div className="flex items-center gap-5 mt-2">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r={R}
          stroke="rgba(255,255,255,0.07)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circ - arcLen}`}
          strokeDashoffset={circ * 0.125}
          transform="rotate(135 36 36)"
        />
        <circle cx="36" cy="36" r={R}
          stroke={ACCENT} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${fillLen} ${circ - fillLen + (circ - arcLen)}`}
          strokeDashoffset={circ * 0.125}
          transform="rotate(135 36 36)"
          style={{ filter: "drop-shadow(0 0 5px rgba(208,239,25,0.55))" }}
        />
        <text x="36" y="40" textAnchor="middle" fill={ACCENT} fontSize="10" fontFamily={MONO} fontWeight="700">
          1.82
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />
          <span className="text-xs" style={{ color: "#555", fontFamily: MONO }}>1.82 healthy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(255,80,80,0.65)" }} />
          <span className="text-xs" style={{ color: "#555", fontFamily: MONO }}>1.0 liquidation</span>
        </div>
      </div>
    </div>
  );
}

// ── Utilization curve (Transparent Rates) ───────────────────
function UtilizationCurve() {
  return (
    <div
      className="w-full rounded-xl overflow-hidden mt-2"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <svg viewBox="0 0 300 90" width="100%" height="90" fill="none" aria-hidden="true">
        {/* Area fill */}
        <path
          d="M0 86 C40 84 80 78 120 65 C150 55 175 38 200 22 C220 10 240 5 300 2 L300 86 Z"
          fill="rgba(208,239,25,0.06)"
        />
        {/* Curve line */}
        <path
          d="M0 86 C40 84 80 78 120 65 C150 55 175 38 200 22 C220 10 240 5 300 2"
          stroke={ACCENT} strokeWidth="1.5" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 3px rgba(208,239,25,0.4))" }}
        />
        {/* Axis */}
        <line x1="0" y1="86" x2="300" y2="86" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <text x="4" y="86" dy="10" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily={MONO}>0%</text>
        <text x="264" y="86" dy="10" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily={MONO}>100%</text>
      </svg>
    </div>
  );
}

// ── Ticker row (Universal Collateral) ────────────────────────
const TICKERS = ["USDG", "ETH", "WETH", "AAPL-T", "TSLA-T", "HOOD-T"];
function TickerRow() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TICKERS.map((t) => (
        <span
          key={t}
          className="px-2 py-0.5 rounded text-xs font-medium border"
          style={{ fontFamily: MONO, color: ACCENT, borderColor: "rgba(208,239,25,0.2)", background: "rgba(208,239,25,0.05)" }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ── Card wrapper ─────────────────────────────────────────────
function Card({
  children, delay = 0, className = "",
}: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      className={`rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-200 cursor-default overflow-hidden ${className}`}
      style={{ background: "#0D0D0D", borderColor: "rgba(255,255,255,0.08)" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(208,239,25,0.35)";
        el.style.boxShadow = "0 0 32px -10px rgba(208,239,25,0.25)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(255,255,255,0.08)";
        el.style.boxShadow = "none";
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Card header (icon + label) ───────────────────────────────
function CardHeader({ Icon, label }: { Icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <CardIcon Icon={Icon} />
      <p
        className="text-xs uppercase tracking-widest font-semibold"
        style={{ color: ACCENT, fontFamily: MONO }}
      >
        {label}
      </p>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────
export function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* Header */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-xs uppercase tracking-widest mb-4 font-semibold"
          style={{ color: ACCENT, fontFamily: MONO }}
        >
          Features
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="font-bold mb-3"
          style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", letterSpacing: "-0.04em", color: "#EDEDED" }}
        >
          Built differently.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-sm leading-relaxed mb-10"
          style={{ color: "#777" }}
        >
          Modular design. Risk-aware infrastructure.<br />
          Everything you need to unlock liquidity with confidence.
        </motion.p>

        {/* 2-column bento grid */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* 1 — Universal Collateral */}
          <Card delay={0}>
            <CardHeader Icon={Layers} label="Universal Collateral" />
            <h3 className="text-xl font-bold leading-snug" style={{ color: "#EDEDED", letterSpacing: "-0.03em" }}>
              Tokenized stocks, crypto, stablecoins. One protocol.
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
              Any supported asset becomes productive collateral. Combine them freely inside a single Multi-Asset Vault.
            </p>
            <TickerRow />
            <CompositionBar />
          </Card>

          {/* 2 — Multi-Asset Vault */}
          <Card delay={0.06}>
            <CardHeader Icon={Box} label="Multi-Asset Vault" />
            <h3 className="text-xl font-bold leading-snug" style={{ color: "#EDEDED", letterSpacing: "-0.03em" }}>
              One vault. One Health Factor.
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
              All your collateral in one position,<br />one solvency score to watch.
            </p>
            <AssetTable />
          </Card>

          {/* 3 — Market-Hours Aware */}
          <Card delay={0.09}>
            <CardHeader Icon={Clock} label="Market-Hours Aware" />
            <div>
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-md border font-semibold mb-3"
                style={{ color: ACCENT, borderColor: "rgba(208,239,25,0.25)", background: "rgba(208,239,25,0.06)", fontFamily: MONO }}
              >
                Built for RWAs
              </span>
              <h3 className="text-xl font-bold leading-snug" style={{ color: "#EDEDED", letterSpacing: "-0.03em" }}>
                Stock markets close.<br />Robinhood Chain doesn't.
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
              New borrows against stock-token collateral are blocked while underlying markets are closed. Gap-aware conservative ratios protect you around weekends and holidays.
            </p>
            <MarketCalendar />
          </Card>

          {/* 4 — Isolated Markets */}
          <Card delay={0.12}>
            <CardHeader Icon={Globe} label="Isolated Markets" />
            <h3 className="text-xl font-bold leading-snug" style={{ color: "#EDEDED", letterSpacing: "-0.03em" }}>
              Speculative assets.<br />Hard ceiling.
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
              Memecoins stay quarantined. Their losses can never touch the Main Market.
            </p>
            <IsolationButtons />
          </Card>

          {/* 5 — Health Factor */}
          <Card delay={0.15}>
            <CardHeader Icon={Shield} label="Health Factor" />
            <h3 className="text-xl font-bold leading-snug" style={{ color: "#EDEDED", letterSpacing: "-0.03em" }}>
              Live solvency.<br />Clear recovery paths.
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
              One number tells you where you stand. Add collateral or repay to move it up anytime.
            </p>
            <HFGauge />
          </Card>

          {/* 6 — Transparent Rates */}
          <Card delay={0.18}>
            <CardHeader Icon={TrendingUp} label="Transparent Rates" />
            <h3 className="text-xl font-bold leading-snug" style={{ color: "#EDEDED", letterSpacing: "-0.03em" }}>
              Open utilization curve.
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#555" }}>
              Interest rates are set by a public, audited formula. No hidden fees or opaque adjustments.
            </p>
            <UtilizationCurve />
          </Card>

        </div>
      </div>
    </section>
  );
}
