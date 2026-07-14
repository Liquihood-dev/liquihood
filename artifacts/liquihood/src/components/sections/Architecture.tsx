import { motion } from "framer-motion";
import { Lock, Clock, Shield, ArrowUpRight } from "lucide-react";

// ── Diagram constants ────────────────────────────────────────
const A   = "#D0EF19";
const AD  = "rgba(208,239,25,0.4)";
const NB  = "#111111";
const NBO = "rgba(255,255,255,0.09)";
const TP  = "rgba(255,255,255,0.8)";
const TS  = "rgba(255,255,255,0.32)";
const MONO = "JetBrains Mono,monospace";

// ── Node layout — sized to contain all text at chosen font sizes ──
// Text starts at node.x + 56 (icon circle 28px + 28px gap).
// Right margin: node.x + node.w – 8px.
// Available text width = node.w – 64px.
const U  = { x: 14,  y: 162, w: 118, h: 74  }; // "User" / "Wallet"         — needs ~40px
const PM = { x: 155, y: 114, w: 218, h: 122 }; // "PoolManager" 12px ~85px, "Timelocked governance" 9px ~118px — needs ~160px text area (218-64=154 ✓)
const RE = { x: 398, y: 62,  w: 182, h: 72  }; // "RiskEngine" 11px ~72px, "HF · caps · limits" 8px ~94px    — needs ~118px (182-64=118 ✓)
const OR = { x: 398, y: 150, w: 182, h: 86  }; // "OracleRouter" ~80px, "Chainlink + validation" 8px ~110px  — 118px ✓
const LE = { x: 398, y: 252, w: 182, h: 72  }; // "Liq. Engine" ~72px, "+ Insurance Fund" 8px ~80px          — 118px ✓
const LU = { x: 604, y: 52,  w: 132, h: 66  }; // "lUSDG" ~36px, "supply token" ~60px  — (132-48=84px) ✓
const DU = { x: 604, y: 142, w: 132, h: 66  }; // "dUSDG" / "debt token"
const IC = { x: 175, y: 350, w: 570, h: 120 };

const ncx = (n: { x: number; w: number }) => n.x + n.w / 2;
const ncy = (n: { y: number; h: number }) => n.y + n.h / 2;
const MARKER = "arr";

// ── Inline icon paths (Lucide 24×24 viewBox, scaled to ~17px) ──
function NodeIcon({ icon, ox, oy, dim }: { icon: string; ox: number; oy: number; dim?: boolean }) {
  const col = dim ? "rgba(255,255,255,0.3)" : A;
  return (
    <g transform={`translate(${ox - 8.6}, ${oy - 8.6}) scale(0.72)`}
      stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {icon === "user"   && <><circle cx="12" cy="8" r="4" /><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /></>}
      {icon === "layers" && <><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>}
      {icon === "shield" && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>}
      {icon === "box"    && <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>}
      {icon === "flame"  && <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" /></>}
      {icon === "dollar" && <><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><line x1="12" y1="18" x2="12" y2="6" /></>}
    </g>
  );
}

// ── SVG Diagram ──────────────────────────────────────────────
function ArchDiagram() {
  const IR = 18; // icon circle radius
  const IR2 = 16; // smaller circle for token nodes

  return (
    <svg viewBox="0 0 760 490" className="w-full h-auto" fill="none" aria-hidden="true" style={{ minWidth: 560 }}>
      <defs>
        <marker id={MARKER} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={AD} />
        </marker>
      </defs>

      {/* Dot grid background */}
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 20 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * 38 + 8} cy={r * 44 + 18} r="1" fill="rgba(255,255,255,0.035)" />
        ))
      )}

      {/* ── Arrows ── */}
      {/* User → PoolManager */}
      <path d={`M${U.x + U.w} ${ncy(U)} H${PM.x}`}
        stroke={AD} strokeWidth="1.5" strokeDasharray="5 3" markerEnd={`url(#${MARKER})`} />
      {/* PoolManager → RiskEngine */}
      <path d={`M${PM.x + PM.w} ${ncy(PM) - 16} H${RE.x - 12} V${ncy(RE)} H${RE.x}`}
        stroke={AD} strokeWidth="1.5" strokeDasharray="5 3" markerEnd={`url(#${MARKER})`} />
      {/* PoolManager → OracleRouter */}
      <path d={`M${PM.x + PM.w} ${ncy(PM)} H${OR.x}`}
        stroke={AD} strokeWidth="1.5" strokeDasharray="5 3" markerEnd={`url(#${MARKER})`} />
      {/* PoolManager → Liq.Engine */}
      <path d={`M${PM.x + PM.w} ${ncy(PM) + 16} H${LE.x - 12} V${ncy(LE)} H${LE.x}`}
        stroke={AD} strokeWidth="1.5" strokeDasharray="5 3" markerEnd={`url(#${MARKER})`} />
      {/* RiskEngine → lUSDG */}
      <path d={`M${RE.x + RE.w} ${ncy(RE)} H${LU.x}`}
        stroke={AD} strokeWidth="1.5" strokeDasharray="5 3" markerEnd={`url(#${MARKER})`} />
      {/* OracleRouter → dUSDG */}
      <path d={`M${OR.x + OR.w} ${ncy(OR)} H${DU.x}`}
        stroke={AD} strokeWidth="1.5" strokeDasharray="5 3" markerEnd={`url(#${MARKER})`} />
      {/* PoolManager ↓ Isolated Cluster */}
      <path d={`M${ncx(PM)} ${PM.y + PM.h} V${IC.y}`}
        stroke="rgba(208,239,25,0.18)" strokeWidth="1" strokeDasharray="4 3" />

      {/* ── User ── */}
      <rect x={U.x} y={U.y} width={U.w} height={U.h} rx="8" fill={NB} stroke={NBO} strokeWidth="1" />
      <circle cx={U.x + 28} cy={ncy(U)} r={IR} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <NodeIcon icon="user" ox={U.x + 28} oy={ncy(U)} dim />
      <text x={U.x + 54} y={ncy(U) - 7} fill={TP} fontSize="11" fontWeight="600" fontFamily={MONO}>User</text>
      <text x={U.x + 54} y={ncy(U) + 9}  fill={TS} fontSize="9"  fontFamily={MONO}>Wallet</text>

      {/* ── PoolManager (highlighted) ── */}
      <rect x={PM.x} y={PM.y} width={PM.w} height={PM.h} rx="10" fill={NB} stroke={A} strokeWidth="1.5" />
      <rect x={PM.x} y={PM.y} width={PM.w} height={PM.h} rx="10" fill="rgba(208,239,25,0.025)" />
      <circle cx={PM.x + 28} cy={ncy(PM)} r={IR} fill="rgba(208,239,25,0.07)" stroke="rgba(208,239,25,0.3)" strokeWidth="1" />
      <NodeIcon icon="layers" ox={PM.x + 28} oy={ncy(PM)} />
      <text x={PM.x + 56} y={ncy(PM) - 16} fill={A}  fontSize="12" fontWeight="700" fontFamily={MONO}>PoolManager</text>
      <text x={PM.x + 56} y={ncy(PM) + 2}  fill={TS} fontSize="9"  fontFamily={MONO}>Entry Point</text>
      <text x={PM.x + 56} y={ncy(PM) + 17} fill={TS} fontSize="9"  fontFamily={MONO}>Timelocked governance</text>

      {/* ── RiskEngine ── */}
      <rect x={RE.x} y={RE.y} width={RE.w} height={RE.h} rx="8" fill={NB} stroke={NBO} strokeWidth="1" />
      <circle cx={RE.x + 26} cy={ncy(RE)} r={IR} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <NodeIcon icon="shield" ox={RE.x + 26} oy={ncy(RE)} dim />
      <text x={RE.x + 52} y={ncy(RE) - 8} fill={TP} fontSize="11" fontWeight="600" fontFamily={MONO}>RiskEngine</text>
      <text x={RE.x + 52} y={ncy(RE) + 8} fill={TS} fontSize="8"  fontFamily={MONO}>HF · caps · limits</text>

      {/* ── OracleRouter ── */}
      <rect x={OR.x} y={OR.y} width={OR.w} height={OR.h} rx="8" fill={NB} stroke={NBO} strokeWidth="1" />
      <circle cx={OR.x + 26} cy={ncy(OR)} r={IR} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <NodeIcon icon="box" ox={OR.x + 26} oy={ncy(OR)} dim />
      <text x={OR.x + 52} y={ncy(OR) - 13} fill={TP} fontSize="11" fontWeight="600" fontFamily={MONO}>OracleRouter</text>
      <text x={OR.x + 52} y={ncy(OR) + 3}  fill={TS} fontSize="8"  fontFamily={MONO}>Keeper (5 assets) · FIXED (USDG)</text>
      <text x={OR.x + 52} y={ncy(OR) + 17} fill={TS} fontSize="8"  fontFamily={MONO}>NYSE market-hours policy</text>

      {/* ── Liq. Engine ── */}
      <rect x={LE.x} y={LE.y} width={LE.w} height={LE.h} rx="8" fill={NB} stroke={NBO} strokeWidth="1" />
      <circle cx={LE.x + 26} cy={ncy(LE)} r={IR} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <NodeIcon icon="flame" ox={LE.x + 26} oy={ncy(LE)} dim />
      <text x={LE.x + 52} y={ncy(LE) - 8} fill={TP} fontSize="11" fontWeight="600" fontFamily={MONO}>Liq. Engine</text>
      <text x={LE.x + 52} y={ncy(LE) + 8} fill={TS} fontSize="8"  fontFamily={MONO}>+ Insurance Fund</text>

      {/* ── lUSDG ── */}
      <rect x={LU.x} y={LU.y} width={LU.w} height={LU.h} rx="8" fill={NB} stroke="rgba(208,239,25,0.2)" strokeWidth="1" />
      <circle cx={LU.x + 23} cy={ncy(LU)} r={IR2} fill="rgba(208,239,25,0.05)" stroke="rgba(208,239,25,0.22)" strokeWidth="1" />
      <NodeIcon icon="dollar" ox={LU.x + 23} oy={ncy(LU)} />
      <text x={LU.x + 46} y={ncy(LU) - 7} fill="rgba(208,239,25,0.85)" fontSize="11" fontWeight="700" fontFamily={MONO}>lhUSDG</text>
      <text x={LU.x + 46} y={ncy(LU) + 8} fill={TS} fontSize="8" fontFamily={MONO}>supply token</text>

      {/* ── dUSDG ── */}
      <rect x={DU.x} y={DU.y} width={DU.w} height={DU.h} rx="8" fill={NB} stroke="rgba(208,239,25,0.2)" strokeWidth="1" />
      <circle cx={DU.x + 23} cy={ncy(DU)} r={IR2} fill="rgba(208,239,25,0.05)" stroke="rgba(208,239,25,0.22)" strokeWidth="1" />
      <NodeIcon icon="dollar" ox={DU.x + 23} oy={ncy(DU)} />
      <text x={DU.x + 46} y={ncy(DU) - 7} fill="rgba(208,239,25,0.85)" fontSize="11" fontWeight="700" fontFamily={MONO}>dUSDG</text>
      <text x={DU.x + 46} y={ncy(DU) + 8} fill={TS} fontSize="8" fontFamily={MONO}>debt tracker</text>

      {/* ── Isolated Markets Cluster ── */}
      <rect x={IC.x} y={IC.y} width={IC.w} height={IC.h} rx="8"
        fill="rgba(255,80,80,0.02)" stroke="rgba(255,100,100,0.28)" strokeWidth="1" strokeDasharray="6 4" />
      <text x={ncx(IC)} y={IC.y + 22} fill="rgba(255,120,120,0.7)" fontSize="10" fontWeight="700"
        textAnchor="middle" fontFamily={MONO} letterSpacing="0.07em">ISOLATED MARKETS</text>
      <text x={ncx(IC)} y={IC.y + 37} fill="rgba(255,255,255,0.2)" fontSize="8"
        textAnchor="middle" fontFamily={MONO}>Hard debt ceilings · losses contained, never cross to Main Market</text>
      {["Pool A", "Pool B", "Pool C", "Pool D", "Ceiling"].map((label, i) => {
        const bw = 88; const gap = 10;
        const totalW = 5 * bw + 4 * gap;
        const bx = IC.x + (IC.w - totalW) / 2 + i * (bw + gap);
        const by = IC.y + 52;
        return (
          <g key={label}>
            <rect x={bx} y={by} width={bw} height={40} rx="5"
              fill="rgba(255,100,100,0.05)" stroke="rgba(255,100,100,0.18)" strokeWidth="1" />
            <text x={bx + bw / 2} y={by + 25} fill="rgba(255,130,130,0.45)" fontSize="9"
              textAnchor="middle" fontFamily={MONO}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Bottom security cards ────────────────────────────────────
const CARDS = [
  {
    Icon: Lock,
    label: "FAIL-CLOSED",
    body: "Every price is validated for staleness, bounds, and anomalies before it can move funds.",
    link: true,
  },
  {
    Icon: Clock,
    label: "SINGLE ENTRY POINT",
    body: "LendingPool routes every supply, borrow, repay, and liquidation. All privileged functions are owner-only and emit on-chain events.",
    link: false,
  },
  {
    Icon: Shield,
    label: "PRE-COMMITTED",
    body: "Losses follow a published waterfall: Insurance Fund first, contained to the originating market.",
    link: false,
  },
];

// ── Section ──────────────────────────────────────────────────
export function Architecture() {
  return (
    <section id="architecture" className="py-24 relative">
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
          Architecture
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="font-semibold"
          style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", letterSpacing: "-0.04em", color: "#EDEDED", lineHeight: 1.05 }}
        >
          Under the Hood
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-3 mb-10 text-base leading-relaxed max-w-xl"
          style={{ color: "#888888" }}
        >
          Liquihood is built with modular, upgradeable components
          designed for security, scalability, and transparency.
        </motion.p>

        {/* Diagram card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border overflow-x-auto mb-5"
          style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="p-4 sm:p-6" style={{ minWidth: 520 }}>
            <ArchDiagram />
          </div>
        </motion.div>

        {/* Security cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {CARDS.map(({ Icon, label, body, link }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-xl border p-6 flex flex-col gap-4"
              style={{ background: "#0A0A0A", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(208,239,25,0.07)", border: "1px solid rgba(208,239,25,0.2)" }}
              >
                <Icon className="w-5 h-5" style={{ color: "#D0EF19" }} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-2">
                <p
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {label}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "#666666" }}>
                  {body}
                </p>
              </div>
              {link && (
                <a
                  href="/docs"
                  className="inline-flex items-center gap-1 text-sm font-medium mt-auto"
                  style={{ color: "#D0EF19" }}
                  onMouseEnter={(e) => { (e.currentTarget).style.opacity = "0.7"; }}
                  onMouseLeave={(e) => { (e.currentTarget).style.opacity = "1"; }}
                >
                  Read the full technical documentation
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
