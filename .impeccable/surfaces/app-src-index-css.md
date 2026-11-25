---
version: 1
slug: "app-src-index-css"
primary_target: "app/src/index.css"
related_targets: ["app/src/ui/Layout.tsx","app/src/pages/Home.tsx"]
---

# Houselite app shell (all screens)

Scope: every screen of the Houselite PWA (`app/src`), Operate mode. Audience: the owner on her phone in the workshop, one hand, mixed light; employees occasionally on a shared device. Priority tasks: register a sale or an expense; create, share and convert a quote. Constraints: no behavior, data or route changes; Spanish (MX); offline; small phones (360 px).

## Direction contract

THESIS: The category standard played straight at Mercado Pago / Treinta finish: the owner knows where everything is before she notices the look. Refuses the current website-in-a-browser feel: emoji icons, flat grey cards, pill buttons everywhere, tap flashes.

OWN-WORLD: Light ground (workshop daylight), white surfaces with one soft offset shadow, 16px card radius, 14px control radius, pills only for chips and badges. One confident emerald brand colour for the primary action and active nav; green/red reserved for money in and out. Figtree variable, tabular numerals for every amount. Drawn line icons (Lucide, 1.75 stroke) replace every emoji.

STORY: She opens the app, sees today's money in one glance, taps the big primary "Registrar venta" with her thumb, and the form feels like a native app: big amount field, no zoom, instant press feedback.

FIRST VIEWPORT: White header with business avatar and name; the "Tu negocio hoy" card leads with the day's sales as the largest number, balance and expenses beneath, then primary and secondary actions full width; bottom tab bar with icons and an emerald active state.

FORM: Category standard (the user's standing choice, canon card); grounded list position: standing exit.
seed:dde8af0d3b6a8a9c

SIGNATURE: none by contract (canon); craft lives in press feedback, safe areas, tabular figures and themed browser surfaces.
