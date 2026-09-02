# Handshake MVP implementation plan and architecture record

Status: implementation baseline for HSK-02..HSK-06, authored by the coding agent from the frozen docs
(`IMPLEMENTATION-DECISIONS.md`, `PRODUCT-SPEC.md`, `ARCHITECTURE.md`, `CONSENT-PROTOCOL.md`,
`WEBMCP-TOOL-CONTRACTS.md`, `EXPERIENCE-SPEC.md`, `THREAT-MODEL.md`). No frozen decision is contradicted;
extensions are recorded as decisions D1..D6 below and are reviewable in the pull request.

## 1. Component architecture

| Component                    | Location                                     | Responsibility                                                                                                                        |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Worker router                | `apps/worker/src/index.ts`                   | Same-origin `/api/v1` routing, body-size and schema limits, capability checks, human-intent origin checks, static assets via `ASSETS` |
| Session core (pure)          | `apps/worker/src/lib/session-core.ts`        | All session transitions as pure functions over a `StorageLike` interface; unit-testable in Node without `cloudflare:workers`          |
| Durable Object adapter       | `apps/worker/src/index.ts` (`DesignSession`) | Thin `DurableObject` wrapper binding DO storage to `StorageLike`, alarm scheduling, `blockConcurrencyWhile` around transitions        |
| Contracts                    | `packages/contracts/src/index.ts`            | Types, `LIMITS`, stable error codes, canonical JSON + SHA-256 hashing, catalog fixture                                                |
| Policy (pure, deterministic) | `packages/policy/src/index.ts`               | Geometry (bounds, overlap, rotation), clearance heuristics, budget, `mayApply`, `mayConfirm`, operation reducer                       |
| Web UI                       | `apps/web/public/`                           | Vanilla HTML/CSS/JS studio layout, SVG canvas, approvals, confirmations, receipt, WebMCP adapter, agent console                       |

D1, KV and R2 remain excluded. DO storage is the only persistence.

## 2. Data model (DO storage keys)

- `meta`: `{capability, createdAt}` — capability is a 128-bit random secret returned once at session creation.
- `room`: `RoomState` — `version` starts at 1 and increments on every committed mutation (manual edit or applied proposal). Approval never mutates room state.
- `proposal:<id>`: `ProposalRecord` — contract `Proposal` plus `decidedAt`, `appliedAt`, `decidedBy: 'human'`.
- `confirm:<id>`: `{actionType, actionDigest, expiresAt, used}` — single-use, five-minute protected-action confirmations.
- `idem:<scope>:<key>`: `{requestId, status, body}` — idempotency ledger storing the original response.
- `audit`: append-only capped event array (session lifecycle, commits, decisions, applies, protected actions, security failures).

## 3. API surface (`/api/v1`, JSON envelope `{ok, data | error, requestId}`)

| Route                                   | Method | Auth                          | Notes                                                                                                                                                       |
| --------------------------------------- | ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sessions`                             | POST   | none                          | Creates DO session; returns `{sessionId, capability, room}` once                                                                                            |
| `/sessions/:id/room`                    | GET    | capability                    | Room + budget + deterministic checks                                                                                                                        |
| `/sessions/:id/catalog`                 | GET    | capability                    | Synthetic catalog search (`q`, `category`)                                                                                                                  |
| `/sessions/:id/products/:pid`           | GET    | capability                    | Product detail                                                                                                                                              |
| `/sessions/:id/manual`                  | POST   | capability + Idempotency-Key  | `{place \| move, ...}`; increments version, supersedes stale proposals                                                                                      |
| `/sessions/:id/proposals`               | POST   | capability + Idempotency-Key  | Create proposal from operations; server computes canonical hash + TTL                                                                                       |
| `/sessions/:id/proposals`               | GET    | capability                    | List proposals (gate)                                                                                                                                       |
| `/sessions/:id/proposals/:pid`          | GET    | capability                    | Proposal status                                                                                                                                             |
| `/sessions/:id/proposals/:pid/decision` | POST   | capability + **human-origin** | `{decision: 'approve'\|'reject', expectedHash}`; never exposed as an agent tool                                                                             |
| `/sessions/:id/proposals/:pid/apply`    | POST   | capability + Idempotency-Key  | Applies an approved proposal atomically                                                                                                                     |
| `/sessions/:id/protected`               | POST   | capability + Idempotency-Key  | `{action: 'book_showroom_visit'\|'submit_quote_request', payload, confirmationId?}`; without confirmation returns `CONFIRMATION_REQUIRED` + confirmation id |
| `/sessions/:id/protected/confirm`       | POST   | capability + **human-origin** | `{confirmationId, actionDigest}` → single-use token                                                                                                         |
| `/sessions/:id/receipt`                 | GET    | capability                    | Allowlisted evidence receipt                                                                                                                                |
| `/sessions/:id/audit`                   | GET    | capability                    | Audit timeline                                                                                                                                              |
| `/sessions/:id/reset`                   | POST   | capability + Idempotency-Key  | Wipes and reinitializes the same session                                                                                                                    |

Human-origin enforcement: decision and confirm endpoints require same-origin `Origin`/`Sec-Fetch-Site` and header `X-Handshake-Intent: human`; these two routes are absent from the WebMCP tool surface, so the agent has no approval path. This is demo-grade anti-forgery consistent with the threat model.

## 4. State machines

Proposal: `pending_human → approved → applied`; terminal alternatives `rejected`, `expired` (TTL 600s, lazy + alarm sweep), `superseded` (any committed change bumps version above `baseVersion`), `invalidated` (hash mismatch at apply, recorded as a security audit event).

Protected action: request → `CONFIRMATION_REQUIRED` (confirmation id, 5-min TTL, bound to exact `actionDigest`) → human confirm → single-use token → protected call completes; replay or reuse fails closed.

Apply precondition chain (fail-closed order): idempotency replay → proposal exists → status `approved` → not expired → `baseVersion === room.version` → canonical hash recheck → validate all operations (bounds, existence, budget projection) → commit atomically, increment version, supersede other stale proposals, append audit.

## 5. Deterministic policy

- Footprints are axis-aligned rectangles; rotation `90|270` swaps width/length. Wall-mount items have zero footprint (budget-only).
- Checks: `bounds` (inside room), `overlap` (pairwise), `door_zone` (36×30in clear at door), `front_clearance` (fixtures require catalog `clearanceIn` rectangle in front, facing by rotation). Statuses `pass | warning | blocked` with stable codes and item ids; heuristics are labeled demo heuristics, never compliance claims.
- Budget: committed = Σ placed item prices; `ok | near (≥85%) | over`; proposals carry a projected budget.
- Canonical hash: recursively key-sorted JSON → SHA-256 hex over `{operations, baseVersion, sessionId}`; recomputed and compared at decision and apply.

## 6. Recorded decisions (D1..D6)

- **D1** — Add `remove` to the `Operation` union: required by `propose_full_layout` and removal flows; contracts extension, no frozen decision contradicted.
- **D2** — Session capability returned once at creation and sent as `X-Handshake-Capability`; random 128-bit session ids; no list endpoint.
- **D3** — Human-intent endpoints (decision, confirm) enforced by origin header + intent header; everything else authenticates by capability.
- **D4** — Best-effort per-session limits only (body ≤ 32 KiB, ≤ 12 operations, ≤ 5 concurrent pending proposals, ≤ 1000 lifetime mutations); no IP infrastructure.
- **D5** — In-page agent console replays the exact tool adapter over the same REST API when WebMCP is unavailable; registration is feature-detected (`navigator.modelContext.registerTool`) so the golden journey is always demonstrable.
- **D6** — WebMCP tool surface is exactly the 15 contracted tools; `apply_approved_change` is a gate tool (it applies only already-human-approved proposals), approval remains UI-only.

## 7. WebMCP tool mapping

Read: `get_room_state`, `search_catalog`, `get_product_detail`, `get_budget_status`, `check_clearances`. Propose: `propose_place_item`, `propose_move_item`, `propose_swap_item`, `propose_full_layout`. Gate: `list_pending_proposals`, `get_proposal_status`, `apply_approved_change`. Protected: `book_showroom_visit`, `submit_quote_request`. Close: `generate_evidence_receipt`. All return the structured envelope with stable error codes (`INVALID_INPUT`, `VERSION_CONFLICT`, `PROPOSAL_EXPIRED`, `PROPOSAL_NOT_APPROVED`, `PROPOSAL_REJECTED`, `PROPOSAL_SUPERSEDED`, `IDEMPOTENCY_CONFLICT`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_EXPIRED`, `POLICY_BLOCKED`, plus `NOT_FOUND`, `SESSION_EXPIRED`, `RATE_LIMITED`, `ORIGIN_DENIED`).

## 8. Test plan

- Unit (policy): geometry, rotation swap, overlap, door zone, front clearance warning/blocked, budget tiers, `mayApply` truth table, `mayConfirm` expiry/single-use/digest mismatch, canonical hash key-order independence, reducer place/move/swap/remove + failure codes.
- Integration (session core via Node): full golden journey — propose (version unchanged) → approve + reject → apply → manual edit visible → clearance warning → booking `CONFIRMATION_REQUIRED` → human confirm → complete → receipt; negatives — replayed apply, stale version, expired proposal, self-approval blocked (`ORIGIN_DENIED`), idempotency conflict, oversized body, malformed JSON.
- CI gates: format, typecheck, tests, Worker dry-run (already wired).

## 9. Verification and boundaries

Owner-run verification: `pnpm check`, `npx wrangler deploy --dry-run`, and a live `wrangler dev` smoke of the golden journey over the real HTTP API before handoff. Deployment, repository publication, video and Devpost submission remain gated on Ehab's release review (HSK-07/08).
