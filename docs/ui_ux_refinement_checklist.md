# CricScore UI/UX Refinement Master Checklist & Prompt

## Core Strengths

- **Theme & Vibe**: High-end, dark-mode gaming aesthetic with vibrant neon highlights.
- **Layout Structure**: Clean card-based hierarchy with explicit top-level operational mode toggles (`VIEWER`, `SCORER`, `CHAT BOT`).
- **Scoring Dashboard**: High-contrast, touch-friendly keypads for rapid mobile input.

---

## Key Area Improvements

### 1. Mobile Touch Targets & Alignment

- **Batter Strike Swap Button (🔄)**: Move swap trigger to a right-aligned inline icon inside the batter row to avoid overlapping cards.
- **Header Bar Spacing**: Hide non-essential control icons inside the slide-out menu (≡) or stack top controls on mobile portrait.

### 2. Responsiveness & Text Handling

- **Text Truncation**: Set flex container text handling to dynamic auto-scaling or multi-line stacking (`flex-col` or `break-words`) for long team names.
- **Table Column Cutoff**: Replace rigid tables in System Access with mobile-first stacked card containers or horizontal overflow scrolling (`overflow-x-auto`).

### 3. Visual Safety & Admin Guardrails

- **Destructive Actions (MATCH OPS)**: Style critical database operations with distinct high-danger red outlines and require double-confirmation modals.
- **System Icons**: Standardize on vector SVG icons (e.g., Lucide-React / Heroicons) instead of OS-dependent emojis (🧹, 🧪, 🗑️).

### 4. Accessibility & Contrast

- **Subtext Readability**: Bump muted label opacity from 40% to 65–70% for outdoor viewing conditions.
- **Link Underlines**: Remove default underline styles from static elements like email addresses unless they are clickable actions.

---

## Prompt for Future UI Polish Iterations

> _"Analyze and refine [Component / Screen Name] for CricScore. Ensure the design follows our dark-mode glassmorphic theme (deep navy background #0B0E17, glowing cyan/purple accents, and light-gray text)._
>
> _Key constraints to apply:_
>
> 1. _Mobile-first touch targets: Minimum touch area of 44x44px with zero overlapping floating elements._
> 2. _Flexible layout: Auto-scale or wrap long team and player names instead of truncating with ellipses._
> 3. _Responsive tables: Use card layouts for mobile list screens rather than fixed tables._
> 4. _Destructive actions: Use explicit high-danger red outlines and modal triggers for bulk/delete actions._
> 5. _High contrast: Ensure secondary muted text is readable under direct sunlight (minimum 4.5:1 WCAG contrast ratio)."_
