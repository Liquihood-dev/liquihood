import { motion } from "framer-motion";
import { BeamDivider } from "@/components/ui/BeamDivider";

const ITEMS = [
  {
    title: "Open-Source Contracts",
    desc: "All smart contract source code is published on-chain and readable. No hidden logic, no proxy traps.",
  },
  {
    title: "Conservative Launch Caps",
    desc: "LTVs and debt ceilings start at guarded launch values and grow only as real on-chain liquidity is measured.",
  },
  {
    title: "On-Chain Insurance Fund",
    desc: "Losses follow a pre-committed waterfall: Insurance Fund absorbs first, contained to the originating market.",
  },
  {
    title: "Non-Custodial",
    desc: "No off-chain accounts, no rehypothecation. Your collateral stays in transparent smart contracts.",
  },
];

export function Security() {
  return (
    <section id="security" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-xs uppercase tracking-widest mb-4 font-medium"
          style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}
        >
          Security
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="font-semibold mb-3"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em", color: "#EDEDED" }}
        >
          Safety is the product.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="text-base mb-12 max-w-xl"
          style={{ color: "#555555" }}
        >
          Conservative caps that grow only as real liquidity grows.{" "}
          <span style={{ color: "#D0EF19" }}>Boring by design.</span>
        </motion.p>

        {/* 4-item row with beam dividers */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="relative"
            >
              {/* Vertical beam divider between items on desktop */}
              {i > 0 && (
                <div
                  className="hidden lg:block absolute left-0 top-0 bottom-0 w-px overflow-hidden"
                  aria-hidden="true"
                >
                  <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.06)" }} />
                </div>
              )}
              <div className="p-6 lg:px-8">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-4 text-xs font-bold"
                  style={{
                    background: "rgba(208,239,25,0.08)",
                    color: "#D0EF19",
                    fontFamily: "'JetBrains Mono', monospace",
                    border: "1px solid rgba(208,239,25,0.15)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "#EDEDED" }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#555555" }}>
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <BeamDivider className="mt-12" />
      </div>
    </section>
  );
}
