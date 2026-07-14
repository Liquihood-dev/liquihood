import { motion } from "framer-motion";

export function ProblemSolution() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative grid md:grid-cols-2 gap-0">

          {/* Left — problem (gray) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="pr-0 md:pr-16 py-16 flex items-center"
          >
            <p
              className="leading-snug font-semibold"
              style={{
                fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                color: "#444444",
                letterSpacing: "-0.02em",
              }}
            >
              "To access cash, investors have always had to sell, giving up
              exposure, upside, and conviction."
            </p>
          </motion.div>

          {/* Vertical beam divider */}
          <div
            className="hidden md:block absolute left-1/2 -translate-x-px top-8 bottom-8 w-px overflow-hidden"
            aria-hidden="true"
          >
            <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div
              className="absolute w-full"
              style={{
                height: "80px",
                background: "linear-gradient(180deg, transparent, #D0EF19, transparent)",
                animation: "beam-travel-v 4s linear infinite",
              }}
            />
          </div>

          {/* Right — solution (white + gradient word) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="pl-0 md:pl-16 py-16 flex items-center"
          >
            <p
              className="leading-snug font-semibold"
              style={{
                fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                color: "#EDEDED",
                letterSpacing: "-0.02em",
              }}
            >
              Liquihood makes your assets{" "}
              <span className="text-gradient-accent">productive</span>. Borrow
              against them. Repay on your terms. Withdraw your position intact.
            </p>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes beam-travel-v {
          0%   { top: -20%; }
          100% { top: 120%; }
        }
      `}</style>
    </section>
  );
}
