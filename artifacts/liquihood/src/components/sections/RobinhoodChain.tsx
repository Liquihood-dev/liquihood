import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import robinhoodLogo from "@assets/6b490d67-3672-4e49-ae0d-1e2b2e00b81a_1783718381437.png";

const FULL_TEXT =
  "Robinhood Chain brings tokenized exposure to hundreds of stocks and ETFs onto an open, permissionless Layer 2. Liquihood is the credit layer that turns those assets from something you hold into something that works for you.";

// Split into two parts for coloring: grey part + white part
const GREY_END = "Robinhood Chain brings tokenized exposure to hundreds of stocks and ETFs onto an open, permissionless Layer 2. ";

function TypewriterText() {
  const ref = useRef<HTMLParagraphElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [displayed, setDisplayed] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (!isInView) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(i);
      if (i >= FULL_TEXT.length) clearInterval(interval);
    }, 22);
    return () => clearInterval(interval);
  }, [isInView]);

  // Blink cursor after typing finishes
  useEffect(() => {
    if (displayed < FULL_TEXT.length) return;
    const blink = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(blink);
  }, [displayed]);

  const slice = FULL_TEXT.slice(0, displayed);
  const greyPart = slice.slice(0, GREY_END.length);
  const whitePart = slice.slice(GREY_END.length);

  return (
    <p
      ref={ref}
      className="leading-relaxed font-semibold text-center"
      style={{
        fontSize: "clamp(1.35rem, 2.8vw, 2.1rem)",
        letterSpacing: "-0.02em",
        minHeight: "8em",
      }}
    >
      <span
        style={{
          color: "#777777",
          textShadow: "0 0 28px rgba(208,239,25,0.18), 0 0 8px rgba(208,239,25,0.08)",
        }}
      >
        {greyPart}
      </span>
      <span
        style={{
          color: "#EDEDED",
          textShadow: "0 0 32px rgba(208,239,25,0.28), 0 0 12px rgba(208,239,25,0.12)",
        }}
      >
        {whitePart}
      </span>
      {/* blinking cursor */}
      <span
        style={{
          display: "inline-block",
          width: "2px",
          height: "1.1em",
          verticalAlign: "text-bottom",
          marginLeft: "2px",
          background: "#D0EF19",
          boxShadow: "0 0 8px rgba(208,239,25,0.8)",
          opacity: showCursor ? 1 : 0,
          transition: "opacity 0.1s",
        }}
      />
    </p>
  );
}

export function RobinhoodChain() {
  return (
    <section className="py-24 relative">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">

        {/* Robinhood logo */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-10"
        >
          <img
            src={robinhoodLogo}
            alt="Robinhood"
            className="object-contain"
            style={{ height: 160, width: "auto", maxWidth: 560 }}
          />
        </motion.div>

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="text-xs uppercase tracking-widest mb-8 font-semibold"
          style={{ color: "#D0EF19", fontFamily: "'JetBrains Mono', monospace" }}
        >
          Built on Robinhood Chain
        </motion.p>

        {/* Typewriter body */}
        <TypewriterText />
      </div>
    </section>
  );
}
