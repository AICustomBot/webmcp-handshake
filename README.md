# Handshake

**Design together. Approve with proof.**

Handshake is a WebMCP-enabled kitchen and bath co-design workspace where a person and an in-browser AI agent collaborate on the same room plan. The agent can inspect state, search a synthetic catalog, run deterministic budget and clearance checks, and propose edits. It cannot silently mutate the approved design or perform consequential actions. Every protected action crosses a visible, page-owned consent gate and produces an evidence receipt.

> **Production Status**: Fully implemented, hardened, and verified across all layers. 93 Vitest unit tests, 62 live HTTP smoke tests, and 37 Playwright browser tests passing 100%.

## Highlights & Capabilities

- **Full Kitchen & Bath Scope**: 16 synthetic fixtures across kitchen and bath categories (vanities, showers, tubs, toilets, sinks, ranges, cooktops, ovens, refrigerators, dishwashers, cabinets) with complete NKBA planning attributes.
- **Governed WebMCP Tool Surface**: 9 contracted tools registered on `document.modelContext` (`get_room_state`, `search_catalog`, `evaluate_design`, `propose_changes`, `get_proposal`, `apply_approved_proposal`, `request_protected_action`, `get_receipt`, `get_bill_of_materials`).
- **Page-Owned Consent Security**: The in-browser model proposes; only the human approves. Model text, query params, or hidden fields are never treated as authority.
- **Single-Use Confirmation Proofs**: Protected synthetic actions (`request_quote`, `book_consultation`) require an explicit confirmation modal generating an ephemeral single-use proof token.
- **Tamper-Evident Receipts**: Redacted, exportable audit receipts with cryptographic SHA-256 proposal hash verification.
- **Production Hardened Backend**: Cloudflare Workers + Durable Objects runtime featuring sliding-window rate limiting (240 req/min, 60 writes/min returning 429 `RATE_LIMITED`), CORS preflight & response headers, stream body size caps (32 KiB), and staging environment support.
- **Interactive Studio SPA**: Room type switcher (Bathroom vs Kitchen), SVG architectural floorplan canvas with door/window openings and utility anchors, interactive drag-and-drop fixture movement, live Bill of Materials table, `@media print` export, and accessible skip-links & ARIA regions.

## Architecture & Verification

```text
================================================================================
                           HANDSHAKE VERIFICATION DOSSIER
================================================================================
 Layer 1: Unit & Policy Tests   : 93 / 93 passed (Vitest, strict TypeScript)
 Layer 2: Live HTTP Smoke Tests : 62 / 62 passed (Cloudflare Worker + DO)
 Layer 3: Headless Browser E2E  : 37 / 37 passed (Playwright Chromium & A11y)
 Layer 4: Packaging Dry-Run     : 0 errors (Wrangler default & staging bundles)
================================================================================
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Run format check, typecheck, and unit test suite
pnpm check

# Launch local Cloudflare Worker & Durable Objects server
pnpm dev --port 8787

# Run live HTTP smoke journey
pnpm test:smoke

# Run Playwright browser and accessibility suite
pnpm test:e2e
```

## Documentation

- [Product Specification](docs/PRODUCT-SPEC.md)
- [Architecture & Boundaries](docs/ARCHITECTURE.md)
- [REST API Specification](docs/API.md)
- [WebMCP Tool Contracts](docs/WEBMCP-TOOL-CONTRACTS.md)
- [Consent Protocol & State Machine](docs/CONSENT-PROTOCOL.md)
- [Deployment Runbook](docs/DEPLOYMENT-RUNBOOK.md)
- [Production Gap Analysis & Roadmap](docs/GAP-ANALYSIS.md)
- [Engineering Workbook](docs/WORKBOOK.md)

## Team

- Ehab Khedr — representative, product owner, final review and demo.
- Mohammed Khedr — engineering and implementation contributor.
- Kholoud — UX, QA, documentation and presentation contributor.
- Senior AI Pair / Swarm — multi-agent autonomous engineering.

## License

Apache License 2.0. See `LICENSE`.
