import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Zap, ArrowUpRight, ArrowRight, Copy, Check } from "lucide-react";
import virtualsLogo from "@/assets/virtuals-logo.png";

const LHOOD_CA = "0xb221e90e44d551702c3c989f7155a6afc86796ec";

// ── Types ────────────────────────────────────────────────────
const SPRING: [number, number, number, number] = [0.16, 1, 0.3, 1];

const COLLATERAL = [
  { asset: "AAPL-T", value: "$4,200.00", pct: 45 },
  { asset: "WETH",   value: "$3,800.00", pct: 40 },
  { asset: "HOOD-T", value: "$1,500.00", pct: 15 },
];

const FEATURES = [
  {
    Icon: Shield,
    title: "Non-Custodial",
    desc: "You remain in control. Your assets, your keys, your rules.",
  },
  {
    Icon: Lock,
    title: "Transparent & Secure",
    desc: "Open-source contracts live on Robinhood Chain. Fail-closed design throughout.",
  },
  {
    Icon: Zap,
    title: "Capital Efficient",
    desc: "Borrow without selling. Maximize your exposure and keep compounding.",
  },
];

// ── Copy CA pill ─────────────────────────────────────────────
function CopyCA() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(LHOOD_CA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const short = `${LHOOD_CA.slice(0, 6)}...${LHOOD_CA.slice(-4)}`;
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all duration-150 w-fit"
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.03)",
        color: "#666",
        fontFamily: "'JetBrains Mono', monospace",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(208,239,25,0.3)"; e.currentTarget.style.color = "#D0EF19"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#666"; }}
    >
      <span style={{ color: "#444" }}>$LHOOD</span>
      <span>{short}</span>
      {copied
        ? <Check className="w-3 h-3" style={{ color: "#D0EF19" }} />
        : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Vault card with cursor glow ──────────────────────────────
function VaultCard() {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const { left, top } = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - left}px`);
    el.style.setProperty("--my", `${e.clientY - top}px`);
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "-300px");
    el.style.setProperty("--my", "-300px");
    el.style.boxShadow = "0 0 0 0 rgba(208,239,25,0)";
    el.style.borderColor = "rgba(255,255,255,0.1)";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
      className="relative flex items-center justify-center lg:justify-end"
    >
      {/* Ambient glow behind card */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(208,239,25,0.06), transparent 70%)" }}
      />

      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full rounded-2xl border overflow-hidden"
        style={{
          maxWidth: 420,
          background:
            "radial-gradient(280px circle at var(--mx,-300px) var(--my,-300px), rgba(208,239,25,0.09), transparent 65%), #0D0D0D",
          borderColor: "rgba(255,255,255,0.1)",
          boxShadow: "0 0 0 0 rgba(208,239,25,0)",
          transition: "box-shadow 0.3s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget).style.boxShadow = "0 0 40px -12px rgba(208,239,25,0.3)";
          (e.currentTarget).style.borderColor = "rgba(208,239,25,0.3)";
        }}
      >
        {/* macOS title bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: "#FF5F57" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#FEBC2E" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#28C840" }} />
            </div>
            <span className="text-xs ml-1" style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
              vault_overview.tsx
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#D0EF19" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#D0EF19" }} />
            </span>
            <span className="text-xs" style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Health Factor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-widest" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                Health Factor
              </span>
              <span className="text-sm font-bold" style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}>
                1.82
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full" style={{ width: "91%", background: "#D0EF19", boxShadow: "0 0 10px rgba(208,239,25,0.5)" }} />
            </div>
            <div className="mt-1.5">
              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(208,239,25,0.1)", color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}>
                HEALTHY
              </span>
            </div>
          </div>

          {/* Collateral */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>
              Collateral
            </p>
            <div className="flex flex-col gap-2.5">
              {COLLATERAL.map((row) => (
                <div key={row.asset} className="flex items-center gap-3">
                  <span className="text-xs w-14 shrink-0 font-medium" style={{ color: "#EDEDED", fontFamily: "'JetBrains Mono', monospace" }}>
                    {row.asset}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: "rgba(208,239,25,0.5)" }} />
                  </div>
                  <span className="text-xs w-20 text-right shrink-0" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

          {/* Debt */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>
                Borrowed
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold" style={{ color: "#EDEDED", fontFamily: "'JetBrains Mono', monospace" }}>
                  2,100.00
                </span>
                <span className="text-xs" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>USDG</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="text-sm px-4 py-2 rounded-lg border font-medium"
                style={{ borderColor: "rgba(255,255,255,0.12)", color: "#888", background: "transparent", fontFamily: "'JetBrains Mono', monospace" }}
              >
                Repay
              </button>
              <button
                className="text-sm px-4 py-2 rounded-lg font-bold"
                style={{ background: "#D0EF19", color: "#000", fontFamily: "'JetBrains Mono', monospace" }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Hero ────────────────────────────────────────────────
export function Hero() {
  return (
    <>
      {/* ── Hero section ── */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid dot-grid-fade pointer-events-none" />
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(700px circle at 30% 40%, rgba(208,239,25,0.06), transparent 60%)" }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* ── Left ── */}
            <div className="flex flex-col items-start gap-6">

              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold"
                style={{
                  borderColor: "rgba(208,239,25,0.25)",
                  background: "rgba(208,239,25,0.06)",
                  color: "#D0EF19",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.08em",
                }}
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#D0EF19" }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#D0EF19" }} />
                </span>
                LIVE ON ROBINHOOD CHAIN
              </motion.div>

              {/* H1 — inline gradient words */}
              <div
                style={{
                  fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.08, ease: SPRING }}
                >
                  <span style={{ color: "#EDEDED" }}>Unlock </span>
                  <span className="text-gradient-hero">Liquidity.</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.18, ease: SPRING }}
                >
                  <span style={{ color: "#EDEDED" }}>Keep Your </span>
                  <span className="text-gradient-hero">Exposure.</span>
                </motion.div>
              </div>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.32 }}
                className="text-base leading-relaxed max-w-md"
                style={{ color: "#888888" }}
              >
                The universal collateral protocol for Robinhood Chain.
                Deposit tokenized stocks, crypto, or stablecoins,
                borrow USDG against them, and never sell what you believe in.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.44 }}
                className="flex flex-wrap items-center gap-3"
              >
                <a
                  href="https://app.liquihood.xyz/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-150"
                  style={{ background: "#D0EF19", color: "#000000" }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.boxShadow = "0 0 32px -4px rgba(208,239,25,0.45)";
                    el.style.transform = "scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.boxShadow = "none";
                    el.style.transform = "scale(1)";
                  }}
                >
                  Launch App
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                <a
                  href="/docs"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border text-sm font-medium transition-all duration-150"
                  style={{ color: "#888888", borderColor: "rgba(255,255,255,0.1)" }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "rgba(208,239,25,0.45)";
                    el.style.color = "#EDEDED";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "rgba(255,255,255,0.1)";
                    el.style.color = "#888888";
                  }}
                >
                  Read the Docs
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>

              {/* CA + Virtuals badge */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.56 }}
                className="flex flex-col gap-2"
              >
                <CopyCA />
                <a
                  href="https://app.virtuals.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 w-fit"
                >
                  <span className="text-xs" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                    Launched by
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(0,200,150,0.1)",
                      color: "#00c896",
                      border: "1px solid rgba(0,200,150,0.25)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <img src={virtualsLogo} alt="Virtuals" className="w-3.5 h-3.5 object-contain rounded-sm" />
                    Virtuals Protocol
                  </span>
                </a>
              </motion.div>
            </div>

            {/* ── Right: Vault card ── */}
            <VaultCard />
          </div>
        </div>
      </section>

      {/* ── Feature strip ── */}
      <section className="border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid sm:grid-cols-3">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-start gap-4 px-6 py-8"
                style={i < FEATURES.length - 1 ? { borderRight: "1px solid rgba(255,255,255,0.07)" } : {}}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(208,239,25,0.08)", border: "1px solid rgba(208,239,25,0.2)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "#D0EF19" }} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#EDEDED" }}>{title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
