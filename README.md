# Handshake

**Design together. Approve with proof.**

Handshake is a WebMCP-enabled kitchen and bath co-design workspace where a person and an in-browser AI agent collaborate on the same room plan. The agent can inspect state, search a synthetic catalog, run deterministic budget and clearance checks, and propose edits. It cannot silently mutate the approved design or perform consequential actions. Every protected action crosses a visible, page-owned consent gate and produces an evidence receipt.

> Hackathon status: MVP implemented through HSK-06 (contracts, policy, session runtime, studio UI, WebMCP tools, protected actions, receipts) and verified locally — 56 unit/integration tests, Worker dry-run, and a live golden-journey HTTP smoke. Deployment and public release remain gated on owner review (HSK-07/08).

## Architecture

- TypeScript monorepo with pnpm workspaces.
- Cloudflare Worker serves API and static assets.
- One Durable Object per synthetic design session owns authoritative state, proposal versions, idempotency, and audit events.
- D1, KV, and R2 are excluded from the MVP unless an accepted ADR adds them.
- The browser registers WebMCP tools and calls same-origin Worker APIs.
- Deterministic policy code owns authorization, geometry, budget, and state transitions.

## Team

- Ehab Khedr — representative, product owner, final review and demo.
- Mohammed Khedr — engineering and implementation contributor.
- Kholoud — UX, QA, documentation and presentation contributor.
- Coding agent(s) — intentionally unassigned and multi-agent compatible.

## License

Apache License 2.0. See `LICENSE`.
