# Implementation decision record v0.1

Frozen by Ehab on 2 September 2026 unless superseded through an accepted ADR.

- Product: Handshake; “Design together. Approve with proof.”
- Team: Ehab, Mohammed, Kholoud.
- Repository: `AICustomBot/webmcp-handshake`; Apache-2.0; private during build, public only at release gate.
- Runtime: Next.js 16 on Vercel (Frontend), Cloudflare Workers and Durable Objects (Backend API and Session Authority, amended by ADR-0005).
- Storage: DO storage only; no D1, KV or R2 in MVP.
- Consent: two-phase proposal approval and separate protected-action confirmation.
- Data: synthetic only.
- Domain scope: Full kitchen and bath scope (amended by `docs/decisions/ADR-0004-full-kitchen-and-bath-scope.md`).
- Coding agents: unassigned; multiple bounded agents may contribute with one accountable owner per issue.
- Deployment, public repository, video, claims and Devpost submission require final Ehab review.

## Accepted Architecture Decision Records

- [ADR-0001: Cloudflare Worker and Durable Object](decisions/ADR-0001-workers-durable-objects.md)
- [ADR-0002: Page-owned consent](decisions/ADR-0002-page-owned-consent.md)
- [ADR-0003: Synthetic-only data](decisions/ADR-0003-synthetic-only.md)
- [ADR-0004: Full kitchen and bath scope](decisions/ADR-0004-full-kitchen-and-bath-scope.md)
- [ADR-0005: Next.js Frontend on Vercel with Cloudflare Worker Backend](decisions/ADR-0005-vercel-nextjs-frontend.md)
