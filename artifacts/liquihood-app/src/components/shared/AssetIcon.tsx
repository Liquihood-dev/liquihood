import { useState } from 'react';
import usdgLogo    from '@/assets/usdg-logo.png';
import wethLogo    from '@/assets/weth-logo.png';
import virtualLogo from '@/assets/virtual-logo.png';
import usdeLogo    from '@/assets/usde-logo.png';
// Real tokenized stock logos — official brand images (bundled locally)
import aaplLogo from '@/assets/aapl-logo.png';
import amznLogo from '@/assets/amzn-logo.png';
import nvdaLogo from '@/assets/nvda-logo.png';
import tslaLogo from '@/assets/tsla-logo.png';
import mstrLogo    from '@/assets/mstr-logo.png';
import cashcatLogo from '@/assets/cashcat-logo.jpg';

/** Maps asset ID → bundled logo. Falls back to text initials on load error. */
const ASSET_LOGOS: Record<string, string> = {
  'usd-g':   usdgLogo,
  'weth':    wethLogo,
  'virtual': virtualLogo,
  'usde':    usdeLogo,
  'cashcat': cashcatLogo,
  'lhood':   '/liquihood-app/logo.png',
  // Real tokenized stocks (robinscan.io)
  'aapl':  aaplLogo,
  'amzn':  amznLogo,
  'nvda':  nvdaLogo,
  'tsla':  tslaLogo,
  'mstr':  mstrLogo,
};

/**
 * Assets with dark/black logos — need a white background circle so the
 * logo is visible against the app's dark theme.
 */
const NEEDS_WHITE_BG = new Set(['aapl', 'mstr']);

interface Props {
  assetId: string;
  symbol: string;
  /** Classes applied to the outer wrapper div (sizing, border, bg, etc.) */
  className?: string;
}

export function AssetIcon({ assetId, symbol, className = '' }: Props) {
  const [error, setError] = useState(false);
  const logo = ASSET_LOGOS[assetId];
  const whiteBg = NEEDS_WHITE_BG.has(assetId);

  return (
    <div className={className}>
      {logo && !error ? (
        whiteBg ? (
          /* White background so dark logos (AAPL, MSTR) are visible on dark theme */
          <div className="w-full h-full bg-white rounded-full flex items-center justify-center p-0.5">
            <img
              src={logo}
              alt={symbol}
              className="w-full h-full object-contain"
              onError={() => setError(true)}
            />
          </div>
        ) : (
          <img
            src={logo}
            alt={symbol}
            className="w-full h-full object-cover rounded-full"
            onError={() => setError(true)}
          />
        )
      ) : (
        <span>{symbol.substring(0, 2)}</span>
      )}
    </div>
  );
}
