import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Github } from "lucide-react";
import logoImg from "@/assets/liquihood-logo.png";

const LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = LINKS.map((l) => l.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backdropFilter: scrolled ? "blur(12px)" : "none",
          background: scrolled ? "rgba(0,0,0,0.75)" : "transparent",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded overflow-hidden shrink-0">
              <img src={logoImg} alt="Liquihood" className="h-full w-full object-cover" />
            </div>
            <span className="font-semibold tracking-tight text-base" style={{ color: "#EDEDED" }}>
              Liquihood
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {LINKS.map((l) => {
              const isActive = active === l.href.slice(1);
              return (
                <a
                  key={l.label}
                  href={l.href}
                  className="flex items-center gap-1.5 text-sm transition-colors duration-150"
                  style={{ color: isActive ? "#EDEDED" : "#888888" }}
                >
                  {isActive && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "#D0EF19" }}
                    />
                  )}
                  {l.label}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {/* X / Twitter */}
            <a
              href="https://x.com/liquihood"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X / Twitter"
              className="p-2 rounded-lg transition-colors duration-150"
              style={{ color: "#555555" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEDED"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555555"; }}
            >
              {/* X logo */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* GitHub */}
            <a
              href="https://github.com/Liquihood-dev"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="p-2 rounded-lg transition-colors duration-150"
              style={{ color: "#555555" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEDED"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555555"; }}
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="/docs"
              className="text-sm px-4 py-2 rounded-lg border font-medium transition-all duration-150"
              style={{ color: "#888888", borderColor: "rgba(255,255,255,0.08)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(208,239,25,0.45)";
                el.style.color = "#EDEDED";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(255,255,255,0.08)";
                el.style.color = "#888888";
              }}
            >
              Docs
            </a>
            <a
              href="https://app.liquihood.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg font-bold transition-all duration-150 inline-block"
              style={{ background: "#D0EF19", color: "#000000" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.boxShadow = "0 0 32px -4px rgba(208,239,25,0.35)";
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
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: "#888888" }}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile fullscreen overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex flex-col pt-24 px-6 pb-8 md:hidden"
            style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(20px)" }}
          >
            <nav className="flex flex-col">
              {LINKS.map((l, i) => (
                <motion.a
                  key={l.label}
                  href={l.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.06 }}
                  className="py-4 text-xl font-semibold border-b min-h-[44px] flex items-center"
                  style={{ color: "#EDEDED", borderColor: "rgba(255,255,255,0.06)" }}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.36 }}
              className="mt-8 flex flex-col gap-3"
            >
              <a
                href="/docs"
                className="py-3.5 text-center rounded-xl text-sm font-medium border"
                style={{ color: "#888888", borderColor: "rgba(255,255,255,0.1)" }}
              >
                Docs
              </a>
              <a
                href="https://x.com/liquihood"
                target="_blank"
                rel="noopener noreferrer"
                className="py-3.5 text-center rounded-xl text-sm font-medium border flex items-center justify-center gap-2"
                style={{ color: "#888888", borderColor: "rgba(255,255,255,0.1)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X / Twitter
              </a>
              <a
                href="https://github.com/Liquihood-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="py-3.5 text-center rounded-xl text-sm font-medium border flex items-center justify-center gap-2"
                style={{ color: "#888888", borderColor: "rgba(255,255,255,0.1)" }}
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="https://app.liquihood.xyz/"
                className="py-3.5 text-center rounded-xl text-sm font-bold"
                style={{ background: "#D0EF19", color: "#000000" }}
              >
                Launch App
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
