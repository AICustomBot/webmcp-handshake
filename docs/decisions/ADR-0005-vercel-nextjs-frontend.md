# ADR-0005: Next.js Frontend on Vercel with Cloudflare Worker Backend

- Status: Accepted
- Date: 2026-09-04
- Supersedes: Partial frontend serving clause of ADR-0001
- Amends: `docs/IMPLEMENTATION-DECISIONS.md`, `docs/ARCHITECTURE.md`

## Context

Handshake was originally scaffolded with a vanilla JavaScript SPA served directly by Cloudflare Workers Static Assets (`apps/web/public`). While this minimized initial deployment infrastructure for the hackathon MVP, a professional-grade Kitchen & Bath co-design studio for real designers and homeowners requires:

1. **Rich 3D Spatial Visualization**: Real-time 3D room rendering (React Three Fiber, Three.js, PBR materials, procedural cabinet/appliance parametric models, walkthrough camera perspectives, and lighting).
2. **Modern Component Ecosystem**: React 19, TypeScript, Tailwind CSS, accessible component primitives (Radix UI/shadcn), dynamic imports, and responsive layout management.
3. **Advanced AI Copilot Integration**: Native integration with the Vercel AI SDK alongside the standard in-browser WebMCP tool surface (`document.modelContext`), enabling seamless copilot chat in browsers lacking experimental WebMCP flags.
4. **Independent Frontend/Backend Scaling & CI/CD**: Deploying the frontend to Vercel provides instant edge preview branches, zero-configuration asset optimization, and CDN edge delivery, while retaining Cloudflare Workers + Durable Objects as the high-integrity stateful edge consensus backend.

## Decision

We decouple the Handshake frontend from Cloudflare Static Assets into a **Next.js 16+ App Router application deployed to Vercel**:

- **Frontend Runtime (`apps/web`)**: Next.js 16 (React 19, App Router, TypeScript, Tailwind CSS, Zustand, React Three Fiber, `@react-three/drei`).
- **Backend Runtime (`apps/worker`)**: Cloudflare Workers + Durable Objects (`DesignSession`). The backend remains the sole authoritative, linearizable, single-threaded source of room state, proposal hashing, NKBA policy validation, rate limiting, and cryptographic audit receipts.
- **Communication Topology**:
  - In production on Vercel, API requests to `/api/v1/*` are proxied directly to the Cloudflare Worker via Next.js Rewrites (`next.config.ts`) or configured via `NEXT_PUBLIC_API_BASE_URL`.
  - Cloudflare Worker CORS headers (`Access-Control-Allow-Origin: *`, credentials, headers) ensure seamless cross-origin communication during development and preview deployments.
- **Constitutional Invariants Preserved**:
  - The Next.js frontend strictly preserves the page-owned consent boundary (`ADR-0002`). The AI agent proposes; only the human UI can approve proposals or grant protected action confirmations.
  - All room mutations remain atomic, version-preconditioned, and idempotency-keyed against the Durable Object backend.
  - Synthetic-only fixture catalog is rendered with real-world physical and architectural dimensions (NKBA guidelines).

## Consequences

- **Positive**: Enables rich 3D visualization, interactive cabinet/appliance configuration, modern developer experience, Vercel preview environments, and seamless copilot interactions.
- **Negative**: Adds Vercel as a deployment target alongside Cloudflare Workers; requires managing cross-service environment variables and proxy rewrites.
