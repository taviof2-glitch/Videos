# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The owner of House Lite (custom carpentry and furniture, Tepatitlán, Jalisco, México) using the app on her own phone, in the workshop, in a hurry, between customers and jobs. Employees with a PIN use it occasionally on a shared device. Spanish (México) only.

## Product Purpose
Houselite (formerly "Conta") is the shop's back office in a pocket: record sales and expenses, track who owes what (fiados and abonos), keep inventory with photos and variants, write quotes that are sent to customers by WhatsApp or PDF and turned into sales, take orders from a public catalog, and see balance and statistics. Success: a sale or a quote takes seconds, the numbers are trustworthy, and what the customer receives looks professional.

## Positioning
Built for one real carpentry business rather than a generic shop: quotes by piece or by area (m²) with advance payment, a quick quoter with the shop's own job types and costs, the shop's logo on every receipt and quote, and it works offline first with optional cloud sync.

## Operating Context
Mobile phone in a workshop (dust, one hand, interruptions, bright or mixed light). Installed as a PWA from the browser. Outputs leave the app: receipts and quotes as PDF, image, or WhatsApp text sent to customers. Money is always handled in cents; MXN.

## Capabilities and Constraints
- Stack in place: Vite + React + TypeScript + Dexie (IndexedDB), plain CSS in `app/src/index.css`, PWA via vite-plugin-pwa, Supabase sync, deployed on Vercel; also built as a single-file page for claude.ai.
- Screens only use the `app/src/data/` layer; the redesign must not change behavior, data, or routes.
- Priority flows (owner's answer): registering a sale or an expense (Home, new sale, new expense, receipt) and quotes (create, share, convert, quick quoter).
- Must not copy brand, text, or images from Treinta (the app it was modeled on).

## Brand Commitments
- Name: Houselite. The owner gave full freedom on colors, typography, and form for the redesign; no prior visual commitments are binding.
- Standing preference (chosen 2026-11-25 in the redesign round): the modern category standard, played straight and at full craft. Craft bar: Mercado Pago and Treinta (their finish level, never their brand, copy, or assets).
- App icon supplied by the owner (2026-11-25): black ground, gold double ring, sage-green leaves and a gold leaf over an H (`app/public/icon.svg`, PNG set in `app/public/`). Its colours (#0A0A0A, #E4B467, #4F7564, #6F9684) are binding brand colours.
- The business logo (uploaded by the owner) appears on receipts and quotes.

## Evidence on Hand
Real app with real flows; no testimonials, customer counts, or pricing claims exist and none may be invented.

## Product Principles
1. Seconds, not minutes: the two priority flows are reachable and finishable with one thumb.
2. Trust the numbers: amounts, debts, and totals are always legible and unambiguous.
3. Professional outward: anything a customer sees reflects a serious workshop.
4. Works anywhere: offline, small phone, bright workshop light.
