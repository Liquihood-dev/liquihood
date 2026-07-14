---
name: Tailwind v4 setup in liquihood artifact
description: How Tailwind CSS v4 must be configured in artifacts/liquihood — the v3 directives break all utility classes.
---

# Tailwind v4 CSS Setup (liquihood artifact)

**Rule:** Use `@import "tailwindcss"` + `@theme {}` block. Never use the v3 directives.

**Why:** The project uses `tailwindcss@4.x` + `@tailwindcss/vite`. The old v3 directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) are not recognized by v4 and silently break ALL utility class generation — fixed layout, responsive prefixes, grid, flex, everything stops working. This was the root cause of the entire layout collapsing after the redesign.

**How to apply:**
- `src/index.css` must start with `@import "tailwindcss";`
- Custom design tokens live inside `@theme { ... }` (not `@layer base`)
- Custom keyframes/animations can still use `@keyframes` directly at root level
- Custom component-like classes use `@layer utilities { ... }` or `@layer base { ... }`
- No `tailwind.config.js` file is needed for basic use; `@theme` replaces `extend` in config

**Verified working** as of 2026-07-10 on `tailwindcss@4.3.2`.
