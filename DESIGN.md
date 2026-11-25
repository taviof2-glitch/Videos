# Design

Houselite's interface: the modern category standard (craft bar: Mercado Pago, Treinta), played straight, in the palette of the owner's app icon. Operate mode: navigation, controls and layout stay the familiar ones; the brand lives in colour, type, figures and press feel. Source of truth: `app/src/index.css` (tokens on `:root`).

## Scene
One person, her phone, a carpentry workshop in daylight or mixed light, one thumb, interruptions. Light theme by scene, not by default.

## Colour
Restrained strategy with a committed shell.
- Ink `#12100d` text; night `#0a0a0a` header, primary "Registrar venta" button, selected day, catalog banner.
- Ground `#f3f4f1`, surfaces `#ffffff`, inset fills `#f6f7f4`, hairlines `#e3e6e1` / `#d3d8d1`, secondary text `#5c6660` (5.4:1 on ground).
- Brand sage `#3d5e50` (white on it 7.2:1) for primary actions, active tab, chips; soft `#e6eeea` behind icons.
- Gold `#e4b467` only on night (10.4:1): icons inside dark buttons, avatar ring, quoter price, selected-day weekday.
- Money: in `#167a4a` / soft `#e3f3ea`; out `#b42318` / soft `#fdeceb`. Warning `#7a4b00` on `#fff4db`. Never used decoratively.

## Type
Figtree Variable (self-hosted via `@fontsource-variable/figtree`), tabular numerals everywhere. Scale: amount hero 2.35rem/780, h1 1.5rem/750, h2 1.06rem/700, body 16px, labels .9rem/650, meta .8rem. Tracking -.02 to -.03em on large figures only. Receipts keep a monospace face because they preview the real printed document.

## Shape and depth
Cards 16px radius with one soft offset shadow (no border). Controls 12–14px radius, 48px minimum height, 52–56px for primary buttons. Pills only for chips, badges and the tab indicator. Bottom sheet 22px top radius.

## Icons
Lucide line icons, 1.75–2 stroke. No emoji or glyphs as icons. Tiles and empty states put the icon in a sage-soft square or circle.

## Motion and feel
Press feedback `scale(.97)` at 140ms `cubic-bezier(.23,1,.32,1)` on every pressable; colour changes 160–200ms. One authored moment: the bottom sheet rises with `@starting-style` (380ms drawer curve). Hover styles only under `(hover: hover) and (pointer: fine)`. `prefers-reduced-motion` removes movement.

## Mobile platform layer
`viewport-fit=cover` with safe-area padding on header, tab bar and sheet; 16px inputs (no iOS zoom); no tap highlight; `overscroll-behavior: none` on the root; `touch-action: manipulation` on controls; `user-select: none` on controls only; theme colour matches the night header.
