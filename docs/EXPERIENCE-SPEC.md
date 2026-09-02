# Frontend and shared-canvas experience

## Direction
An elegant design studio, not a chatbot dashboard: warm neutral room canvas, restrained blue actions, amber pending proposals, green approved state, red only for blocked/risk. Status always includes text and icon.

## Desktop layout
- Header: product, synthetic-demo badge, WebMCP availability, reset/help.
- Left rail: synthetic catalog filters and product cards.
- Center: accessible SVG room canvas with grid, dimensions, committed items and proposal overlays.
- Right rail: budget, deterministic checks, pending proposals and human decisions.
- Bottom timeline: concise receipts and export.

## Mobile
Single-column flow: canvas, then budget/checks, proposals, catalog, receipt. Sticky status and minimum 44px targets. No horizontal page scroll.

## Required states
Empty, ready, WebMCP unavailable, loading, offline, proposal pending, approved, rejected, expired, version conflict, protected confirmation, safe failure, receipt ready.

## Accessibility
Semantic landmarks, skip link, keyboard-operable canvas alternatives, visible focus, live region for status, textual item position fields, non-color state labels, 4.5:1 text contrast, 3:1 boundaries, reduced motion, 200% zoom, 390px support. Passing automated checks alone cannot justify a WCAG claim.
