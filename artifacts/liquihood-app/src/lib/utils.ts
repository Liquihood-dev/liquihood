import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number, abbreviate = false) {
  if (abbreviate) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatToken(value: number, decimals = 4) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function shortenAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// NYSE: Mon–Fri 9:30 AM – 4:00 PM ET
export function checkMarketOpen(override?: 'open' | 'closed'): boolean {
  if (override === 'open')   return true;
  if (override === 'closed') return false;

  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day = et.getDay();
  if (day === 0 || day === 6) return false;

  const t = et.getHours() + et.getMinutes() / 60;
  return t >= 9.5 && t < 16;
}

export function getTimeToNextOpen(override?: 'open' | 'closed'): string {
  if (override === 'open')   return '0m';
  if (override === 'closed') return '∞';

  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day   = et.getDay();
  const hours = et.getHours();
  const mins  = et.getMinutes();
  const t     = hours + mins / 60;

  // Already open
  if (day >= 1 && day <= 5 && t >= 9.5 && t < 16) return '0m';

  // Minutes until next 9:30 AM ET on a trading day
  let daysAhead = 0;
  if (day === 0) daysAhead = 1;        // Sunday → Monday
  else if (day === 6) daysAhead = 2;   // Saturday → Monday
  else if (t >= 16) daysAhead = day === 5 ? 3 : 1; // after close → next day (skip weekend on Fri)
  else daysAhead = 0; // before open today

  const targetH = 9;
  const targetM = 30;
  let totalMins: number;

  if (daysAhead === 0) {
    // Before 9:30 today
    totalMins = (targetH - hours) * 60 + (targetM - mins);
  } else {
    const minsLeftToday  = (24 - hours) * 60 - mins;
    const minsInFullDays = (daysAhead - 1) * 24 * 60;
    const minsToOpen     = targetH * 60 + targetM;
    totalMins = minsLeftToday + minsInFullDays + minsToOpen;
  }

  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
