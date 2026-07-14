import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    q: "What is Liquihood?",
    a: "A non-custodial lending protocol on Robinhood Chain. Deposit supported assets as collateral, borrow USDG, and never sell.",
  },
  {
    q: "Where does borrowed USDG come from?",
    a: "From suppliers who deposit USDG to earn the interest borrowers pay. A two-sided marketplace, not a money printer.",
  },
  {
    q: "Can I be liquidated?",
    a: "Yes. At Health Factor below 1.0, part of your collateral can be liquidated. Add collateral or repay early to stay safe.",
  },
  {
    q: "Why are new borrows against stock tokens blocked on weekends?",
    a: "Underlying markets are closed and prices cannot update. Blocking new borrows at stale prices protects everyone. Existing positions are unaffected.",
  },
  {
    q: "Are memecoins really accepted as collateral?",
    a: "Only in Isolated Markets with hard debt ceilings, sealed off from the Main Market. If a speculative market fails, the damage stops at its ceiling.",
  },
  {
    q: "Is Liquihood risk-free?",
    a: "No DeFi protocol is. Smart-contract, market-gap, and issuer/regulatory risks exist. We cap, insure, and disclose risk. We don't hide it.",
  },
];

function FAQItem({ faq, index }: { faq: typeof FAQS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${index}`;
  const triggerId = `faq-trigger-${index}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border-b"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      <button
        id={triggerId}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 min-h-[44px]"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="text-sm sm:text-base font-medium" style={{ color: "#EDEDED" }}>
          {faq.q}
        </span>
        {/* Green chevron */}
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width="16" height="16" viewBox="0 0 16 16"
          fill="none"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M4 6L8 10L12 6" stroke="#D0EF19" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed" style={{ color: "#555555" }}>
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="py-24 relative">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-xs uppercase tracking-widest mb-4 font-medium"
          style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}
        >
          FAQ
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="font-semibold mb-10"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em", color: "#EDEDED" }}
        >
          Common questions.
        </motion.h2>
        <div>
          {FAQS.map((faq, i) => (
            <FAQItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
