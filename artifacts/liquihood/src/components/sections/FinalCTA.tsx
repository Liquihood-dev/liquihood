import { motion } from "framer-motion";

export function FinalCTA() {
  return (
    <section className="relative py-36 overflow-hidden">
      {/* Dot grid that brightens */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.8,
        }}
      />
      {/* Green glow rising from bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 100%, rgba(208,239,25,0.18), transparent 70%)",
        }}
      />
      {/* Top ambient */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(208,239,25,0.07), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="font-semibold mb-6"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            color: "#EDEDED",
          }}
        >
          Your assets shouldn't
          <br />
          have to{" "}
          <span className="text-gradient-hero">sleep.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg mb-10"
          style={{ color: "#555555" }}
        >
          Deposit. Borrow. Keep your exposure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <a
            href="https://app.liquihood.xyz/"
            className="inline-flex items-center px-8 py-4 rounded-xl text-base font-bold transition-all duration-150"
            style={{ background: "#D0EF19", color: "#000000" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.boxShadow = "0 0 48px -4px rgba(208,239,25,0.35)";
              el.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.boxShadow = "none";
              el.style.transform = "scale(1)";
            }}
          >
            Launch App
          </a>
        </motion.div>

        {/* Trust marks */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-wrap justify-center gap-6 mt-10 text-xs"
          style={{ color: "#333333", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {["Non-custodial", "Live on mainnet", "Open-source", "No sign-up"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full inline-block" style={{ background: "#D0EF19" }} />
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
