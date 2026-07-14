---
name: LiquiHood landing page
description: Design decisions, accessibility setup, and conventions for the LiquiHood React+Vite landing page artifact.
---

## Conventions
- Stack: React + Vite, Framer Motion, Tailwind CSS, shadcn/ui, wouter, JetBrains Mono.
- Color palette: near-black `#0A0E14`→`#0D1420` bg, lime-green primary `#8BC34A` (HSL 88 50% 53%), soft violet `#8B7CF6`.
- Card style: dark rounded cards (`bg-[#0f1623]`, `border border-white/[0.07]`), upper portion = dot-grid SVG graphic area (`h-36 bg-[#0a0e14] border-b`), bold title + description below. See Features.tsx and Security.tsx as canonical references.
- Animated gradient text: `.animated-gradient-text` utility in `index.css` — lime-to-yellow-green shimmer `@keyframes gradient-shift`. Respects `prefers-reduced-motion`.
- Logo: PNG at `attached_assets/ChatGPT_Image_Jul_10,_2026_at_03_11_49_PM_1783712719729.png`, imported via `@assets` Vite alias.

## Accessibility
- `<MotionConfig reducedMotion="user">` wraps the entire app in `App.tsx` — all Framer Motion animations auto-disable when the OS reduces motion.
- CSS `@media (prefers-reduced-motion: reduce)` also stops `.animate-ping`, `.animate-pulse`, `.animate-spin`.
- All decorative SVGs carry `aria-hidden="true" focusable="false"`.

## Content policy
- Zero em dashes (—) allowed anywhere in user-facing text. Replace with commas, periods, or restructured sentences.
- No absolute language ("can never", "impossible") — rephrase as design choices.

**Why:** Code review flagged both reduced-motion and aria-hidden as blocking accessibility gaps; both were fixed together in July 2026.
