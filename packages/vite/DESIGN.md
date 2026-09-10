# Visual World: Agent Hover (Overlay UI)

<!-- impeccable:design-schema 1 -->

## Incumbent System
N/A - New custom design system based on "Dark Developer / Builder" guidelines.

## Brand Commitments
The UI must feel like premium tactical equipment or an advanced command palette, not a generic SaaS widget. We are using a dark, frosted glass aesthetic with sharp neon cyan accents, inspired by the reference vertical dock.

## Typography
- **Primary / UI Labels:** `Geist` or `Satoshi` (geometric, sharp, clean). Absolutely no Inter.
- **Monospace / Code / Numbers:** `JetBrains Mono` or `Geist Mono` for precise alignment of coords and metadata.
- **Scale:** Small, dense, and tactical. Maximum label size 12px-14px.

## Color System
- **Backgrounds:** Deep Slate / Near-Black `rgb(15, 23, 42 / 0.4)`
- **Accents:** Neon Cyan / Electric Blue `#00FFFF`
- **Text:** Off-white `rgb(248, 250, 252)` and muted slate `rgb(148, 163, 184)` for secondary metadata.

## Layout & Components
- **Vertical Dock:** The main UI is a floating vertical dock positioned on the edge of the screen.
- **Bento Grid Inner:** The dock contains vertically stacked, pill-shaped or squircle chips.
- **Squircles:** Heavy border radii (e.g., `24px` or `999px` for pills) to give a hardware-like feel.
- **Glassmorphism (Apple Liquid Glass Approx):**
  - High blur (`backdrop-filter: blur(24px)`)
  - Multi-layered subtle inner borders to catch the light
  - Deep drop shadows to float high above the user's canvas.
- **Micro-interactions:**
  - Fast, spring-based motion for hovering.
  - Active states glow with the neon cyan accent.

## Space & Motion
- Tight inner padding inside the dock.
- Hardware-accelerated CSS transforms for the gliding highlight box.
- Motion must feel snappy and immediate (< 150ms).

## A11y & Edge Cases
- The dock must be draggable or have a toggle to minimize it if it covers crucial host UI.
- Reduced motion preferences must disable the gliding highlight.
