import robinhoodLogo from "@assets/6b490d67-3672-4e49-ae0d-1e2b2e00b81a_1783718381437.png";
import liquihoodLogo from "@/assets/liquihood-logo.png";

const COLS = [
  {
    title: "Protocol",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Technical Spec", href: "/docs#architecture" },
      { label: "Risk Framework", href: "/docs#risk-params" },
      { label: "Audits", href: "#" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X / Twitter", href: "https://x.com/liquihood" },
      { label: "GitHub", href: "https://github.com/Liquihood-dev" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ background: "#000000", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img
                src={liquihoodLogo}
                alt="Liquihood"
                className="shrink-0 object-contain rounded"
                style={{ width: 28, height: 28 }}
              />
              <span className="font-semibold text-base" style={{ color: "#EDEDED" }}>
                Liquihood
              </span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "#555555", fontFamily: "'JetBrains Mono', monospace" }}
            >
              The credit layer for<br />Robinhood Chain.
            </p>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.title}>
              <h4
                className="text-xs uppercase font-semibold mb-5 tracking-widest"
                style={{ color: "#444444", fontFamily: "'JetBrains Mono', monospace" }}
              >
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm transition-colors duration-150"
                      style={{ color: "#555555" }}
                      onMouseEnter={(e) => { (e.currentTarget).style.color = "#EDEDED"; }}
                      onMouseLeave={(e) => { (e.currentTarget).style.color = "#555555"; }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div
          className="border-t pt-8 mb-8 text-xs leading-relaxed max-w-4xl"
          style={{ borderColor: "rgba(255,255,255,0.06)", color: "#444444" }}
        >
          Liquihood is a decentralized financial protocol. Borrowing against collateral carries liquidation risk.
          Tokenized stock products involve additional issuer and regulatory considerations. Nothing on this page
          is financial advice. Always understand collateral ratios, interest rates, and market volatility before
          opening a position. Liquihood is an independent protocol built on Robinhood Chain and is not affiliated
          with or endorsed by Robinhood Markets, Inc.
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                style={{ background: "#D0EF19" }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: "#D0EF19" }}
              />
            </span>
            <span
              className="text-xs"
              style={{ color: "#444444", fontFamily: "'JetBrains Mono', monospace" }}
            >
              All systems operational
            </span>
          </div>

          {/* Built on Robinhood Chain */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: "#333333", fontFamily: "'JetBrains Mono', monospace" }}
            >
              Built on
            </span>
            <img
              src={robinhoodLogo}
              alt="Robinhood Chain"
              className="object-contain"
              style={{ height: 56, width: "auto" }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
