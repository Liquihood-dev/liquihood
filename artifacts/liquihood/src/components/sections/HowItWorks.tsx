import { useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Wallet, Layers, DollarSign, TrendingUp, RefreshCcw } from "lucide-react";

// ── Steps data ──────────────────────────────────────────────
const STEPS = [
  {
    n: "01",
    title: "Connect Wallet",
    desc: "Non-custodial. Assets live in transparent smart contracts, never a company balance sheet.",
    Icon: Wallet,
  },
  {
    n: "02",
    title: "Deposit Collateral",
    desc: "Tokenized equities (AAPL-T, TSLA-T, HOOD-T), crypto (ETH, WETH), or USDG — all combined into one Multi-Asset Vault under a single Health Factor.",
    Icon: Layers,
  },
  {
    n: "03",
    title: "Borrow USDG",
    desc: "A keeper-fed oracle (updated every 5 minutes, staleness-guarded) values your collateral in real time. Equity collateral is gated by NYSE market hours — no new borrows off-hours.",
    Icon: DollarSign,
  },
  {
    n: "04",
    title: "Use Your Capital",
    desc: "The USDG is yours. Trade, earn, or spend it anywhere on-chain.",
    Icon: TrendingUp,
  },
  {
    n: "05",
    title: "Repay & Withdraw",
    desc: "Settle anytime and reclaim your collateral exactly as you left it, including any gains.",
    Icon: RefreshCcw,
  },
];

// ── Gauge SVG ────────────────────────────────────────────────
// 300° arc, gap at bottom-center, track + dynamic fill
function HFGaugeLarge({ hf, color }: { hf: number; color: string }) {
  const R = 68;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * R;
  const arcDeg = 300; // degrees of the gauge arc
  const arcLen = (arcDeg / 360) * circ;
  const gapLen = circ - arcLen;

  const maxHF = 2.0;
  const pct = Math.min(Math.max(hf / maxHF, 0), 1);
  const fillLen = pct * arcLen;

  // rotate so gap is centered at bottom (6 o'clock)
  // gap = 60°, starts at 270°-30°=240° in standard SVG, so rotate(120°) from start
  const rotDeg = 120;

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true" fill="none">
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={R}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${gapLen}`}
        strokeDashoffset={0}
        transform={`rotate(${rotDeg} ${cx} ${cy})`}
      />
      {/* Fill */}
      <circle
        cx={cx} cy={cy} r={R}
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${fillLen} ${circ - fillLen}`}
        strokeDashoffset={0}
        transform={`rotate(${rotDeg} ${cx} ${cy})`}
        style={{
          transition: "stroke-dasharray 0.45s ease, stroke 0.4s ease",
          filter: `drop-shadow(0 0 10px ${color}88)`,
        }}
      />
    </svg>
  );
}

// ── Interactive Demo ─────────────────────────────────────────
function HealthFactorDemo() {
  const [pct, setPct] = useState(100);

  // Map slider 40–100 → HF 0.74–1.85
  const rawHF = 0.74 + ((pct - 40) / 60) * (1.85 - 0.74);
  const hf = Math.round(rawHF * 100) / 100;

  const springHF = useSpring(rawHF, { stiffness: 180, damping: 22 });
  const displayHF = useTransform(springHF, (v) => v.toFixed(2));

  const getColor = () => {
    if (hf >= 1.4) return "#D0EF19";
    if (hf >= 1.0) return "#F59E0B";
    return "#FF4D4D";
  };

  const getStatus = () => {
    if (hf >= 1.4)
      return { dot: "#D0EF19", label: "Healthy", sub: "Your position is well within the safe range." };
    if (hf >= 1.0)
      return { dot: "#F59E0B", label: "At Risk", sub: "Add collateral or repay to stay safe." };
    return { dot: "#FF4D4D", label: "Liquidatable", sub: "Your position can be partially liquidated." };
  };

  const color = getColor();
  const status = getStatus();
  const sliderPct = ((pct - 40) / 60) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-12 rounded-2xl border overflow-hidden"
      style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}
        >
          Interactive Demo
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded border"
          style={{
            color: "#666",
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Illustrative numbers
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-0">
        {/* ── Left: slider + status ── */}
        <div className="p-6 flex flex-col gap-5">
          {/* Slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: "#EDEDED" }}>
                Simulate collateral price
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: "#EDEDED", fontFamily: "'JetBrains Mono', monospace" }}
              >
                {pct}%
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={40}
                max={100}
                value={pct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPct(val);
                  springHF.set(0.74 + ((val - 40) / 60) * (1.85 - 0.74));
                }}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${color} 0%, ${color} ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%, rgba(255,255,255,0.1) 100%)`,
                  outline: "none",
                  accentColor: color,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs" style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>40%</span>
              <span className="text-xs" style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>100%</span>
            </div>
          </div>

          {/* Status card */}
          <div
            className="rounded-xl border p-4 transition-all duration-300"
            style={{
              background: `${color}0A`,
              borderColor: `${color}25`,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
              />
              <span className="text-sm font-semibold" style={{ color: "#EDEDED" }}>
                {status.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: "#666666" }}>
              {status.sub}
            </p>
          </div>

          {/* Formula */}
          <div
            className="rounded-lg p-3 leading-relaxed"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <p className="text-xs" style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
              Health Factor = weighted collateral value / debt.
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
              Below 1.0, liquidation protects the pool.
            </p>
          </div>
        </div>

        {/* ── Right: gauge ── */}
        <div className="p-6 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <HFGaugeLarge hf={hf} color={color} />
            {/* Center labels */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <motion.span
                className="text-4xl font-bold leading-none"
                style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
              >
                {displayHF}
              </motion.span>
              <span className="text-xs mt-1" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                Health Factor
              </span>
            </div>
          </div>

          {/* Scale */}
          <div className="flex items-start justify-between w-full max-w-[180px] px-1">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold" style={{ color: "#FF4D4D", fontFamily: "'JetBrains Mono', monospace" }}>
                1.0
              </span>
              <span className="text-xs" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                Liquidation
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold" style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}>
                1.85
              </span>
              <span className="text-xs" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                Healthy
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main section ─────────────────────────────────────────────
export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* Header */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-xs uppercase tracking-widest mb-4 font-semibold"
          style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}
        >
          The Protocol Flow
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="font-semibold"
          style={{
            fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
            letterSpacing: "-0.04em",
            color: "#EDEDED",
            lineHeight: 1.05,
          }}
        >
          How It Works
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-3 mb-14 text-base leading-relaxed max-w-lg"
          style={{ color: "#888888" }}
        >
          Borrow against your tokenized assets. Keep your upside,
          get the liquidity you need.
        </motion.p>

        {/* ── Desktop: horizontal step rail ── */}
        <div className="hidden md:grid grid-cols-5 gap-0 relative">
          {/* Connector rail */}
          <div
            className="absolute top-[52px] left-[10%] right-[10%] h-px"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />

          {STEPS.map((step, i) => {
            const isActive = i === 0;
            const { Icon } = step;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="relative flex flex-col items-center px-3"
              >
                {/* Step badge */}
                <div className="mb-4 z-10">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                    style={{
                      background: isActive ? "#D0EF19" : "transparent",
                      color: isActive ? "#000000" : "#444444",
                      border: isActive ? "none" : "1px solid rgba(255,255,255,0.1)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {step.n}
                  </span>
                </div>

                {/* Card */}
                <div
                  className="w-full rounded-xl p-4 flex flex-col items-center gap-3 transition-all duration-200"
                  style={{
                    background: isActive ? "#111111" : "transparent",
                    border: isActive ? "1px solid rgba(208,239,25,0.2)" : "1px solid rgba(255,255,255,0.05)",
                    boxShadow: isActive ? "0 0 32px -12px rgba(208,239,25,0.2)" : "none",
                  }}
                >
                  {/* Icon circle */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: isActive ? "rgba(208,239,25,0.08)" : "rgba(255,255,255,0.03)",
                      border: isActive ? "1px solid rgba(208,239,25,0.25)" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isActive ? "#D0EF19" : "#444444" }}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Text */}
                  <div className="text-center">
                    <h3
                      className="text-sm font-semibold mb-1.5"
                      style={{ color: "#EDEDED" }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "#555555" }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Mobile: vertical steps ── */}
        <div className="md:hidden space-y-3 mb-12">
          {STEPS.map((step, i) => {
            const isActive = i === 0;
            const { Icon } = step;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex gap-4 rounded-xl border p-4"
                style={{
                  background: isActive ? "#111111" : "#0A0A0A",
                  borderColor: isActive ? "rgba(208,239,25,0.2)" : "rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-xs font-bold shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: isActive ? "#D0EF19" : "transparent",
                    color: isActive ? "#000" : "#444",
                    border: isActive ? "none" : "1px solid rgba(255,255,255,0.1)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {step.n}
                </span>
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: isActive ? "rgba(208,239,25,0.08)" : "rgba(255,255,255,0.03)",
                      border: isActive ? "1px solid rgba(208,239,25,0.2)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: isActive ? "#D0EF19" : "#444" }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5" style={{ color: "#EDEDED" }}>{step.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: "#555555" }}>{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Interactive HF Demo */}
        <HealthFactorDemo />
      </div>
    </section>
  );
}
