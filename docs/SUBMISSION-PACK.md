# Handshake — Devpost Submission Pack & Verification Dossier

## 1. Project Overview & Elevator Pitch

**Project Name**: Handshake: Design together. Approve with proof.  
**Tagline**: A WebMCP-governed shared canvas where agents propose and humans approve with cryptographic receipts.

### Elevator Pitch

When AI agents interact with web applications today, they are forced to scrape DOM text and emulate brittle mouse clicks, or operate with unconstrained tool permissions that mutate user state without consent.

**Handshake** solves this fundamental trust and governance gap. It is a live Kitchen & Bath co-design canvas where humans and AI agents collaborate on live room state through explicit, versioned WebMCP tool contracts. Agents inspect geometry, search synthetic catalogs, evaluate clearance rules, and submit structured proposals. The committed room state remains strictly immutable until the human reviews the exact proposal diff and approves it in the page. Every state mutation is atomic and versioned, protected actions require page-owned single-use confirmation proofs, and every session exports a tamper-evident audit receipt.

---

## 2. Why WebMCP?

Traditional DOM automation or server-side MCP lacks the critical guarantees required for human-in-the-loop co-design:

1. **State Ambiguity vs Machine-Readable Contracts**: DOM scraping cannot reliably distinguish committed state from proposed state. WebMCP gives the agent structured tools (`get_room_state`, `evaluate_design`, `propose_changes`) with strictly typed schemas.
2. **Authorization Boundary**: Server-side LLMs cannot be granted direct authority to mutate customer state or authorize bookings. Under WebMCP with Handshake's page-owned consent protocol, the human in the browser UI retains sole authority to decide proposals and grant confirmation proofs.
3. **Deterministic Governance**: Layout clearances, door swing zones, and budget limits are calculated deterministically—never left to probabilistic LLM hallucinations.

---

## 3. What Handshake Makes Possible

- **Live Multi-Actor Co-Design**: The user can manually reposition a fixture using accessible keyboard/coordinate controls while the agent re-evaluates the layout in real time, detecting clearance conflicts or out-of-bounds fixtures.
- **Non-Mutating Proposals**: Proposals display as amber dashed previews on the SVG canvas. The committed room version and items remain untouched until explicit human approval.
- **Fail-Closed Confirmation Barrier**: When an agent requests a protected action (`book_consultation`), the system fails closed with `CONFIRMATION_REQUIRED`. A page-owned modal displays the exact action and payload. Only upon explicit human grant is a single-use proof token issued, allowing the action to succeed exactly once.
- **Tamper-Evident Receipts**: Sessions export complete, allowlisted JSON receipts with session timeline events and version histories, completely scrubbing internal secrets and proof tokens.

---

## 4. Contracted WebMCP Tool Surface

| Tool Name                  | Actor Scope | Description                                                              | Safety Invariant                                    |
| -------------------------- | ----------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `get_room_state`           | Agent       | Retrieves committed room dimensions, version, fixtures, and evaluation.  | Read-only. Returns current committed version.       |
| `search_catalog`           | Agent       | Searches synthetic bathroom catalog by text, category, or accessibility. | Read-only synthetic catalog fixtures only.          |
| `evaluate_design`          | Agent       | Evaluates layout clearances, door swing overlaps, and budget limits.     | Deterministic computation without side effects.     |
| `propose_changes`          | Agent       | Submits proposed place, move, or remove operations with rationale.       | **Zero mutation**. Computes canonical SHA-256 hash. |
| `get_proposal`             | Agent       | Retrieves status, hash, diff, and base version of a proposal.            | Read-only proposal inspection.                      |
| `apply_approved_proposal`  | Agent       | Atomically commits an approved proposal to room state.                   | Requires prior human approval and version match.    |
| `request_protected_action` | Agent       | Executes protected synthetic actions (e.g. consultation booking).        | Requires valid, unconsumed human proof token.       |
| `get_receipt`              | Agent       | Exports sanitized audit trail of all session decisions and events.       | Zero secrets or proof tokens leaked.                |

---

## 5. Technical Architecture

- **Edge Runtime**: Cloudflare Workers with native static asset binding serving HTML, CSS, studio JavaScript, and in-browser WebMCP bridge (`webmcp.js`).
- **State Management**: Cloudflare Durable Objects (`DesignSession`) providing linearizable, single-threaded consistency per room session.
- **Zero External Dependencies**: Zero database (no D1/KV/R2), zero external AI calls, zero external analytics. Purely deterministic TypeScript algorithms.
- **Security & Threat Model**:
  - 128-bit random hex session capabilities (`x-handshake-capability`).
  - Separate actor identity channels: agent routes vs human UI routes (`decisions`, `edits`, `confirmations`).
  - Hash-bound proposals preventing in-flight tampering (`PROPOSAL_HASH_MISMATCH`).
  - Single-use proof tokens with replay rejection.

---

## 6. Comprehensive Verification Evidence

The Handshake codebase has undergone exhaustive automated verification across all layers:

### Unit & Policy Test Suite (Vitest)

- **Command**: `pnpm check`
- **Result**: **66 passed** across 6 test files (`tests/health.test.ts`, `tests/policy.test.ts`, `tests/runtime.test.ts`, `tests/protected-runtime.test.ts`, `tests/consent.test.ts`, `tests/evidence.test.ts`).
- **Guarantees**: Verifies contract schemas, deterministic state machine transitions, agent self-approval blocks, version conflict handling, and receipt generation.

### Golden Journey HTTP Smoke Test Runner

- **Command**: `pnpm test:smoke` (`scripts/smoke-golden-journey.mjs`)
- **Result**: **62 passed** assertions executing over real HTTP against live Durable Objects.
- **Guarantees**: Verifies `/healthz` liveness, capability enforcement, proposal non-mutation, cross-session decision isolation, atomic apply, manual coordinate edits, confirmation proof issuance, single-use proof replay blocking, and redacted receipt export.

### End-to-End Browser & Accessibility Test Suite (Playwright)

- **Command**: `pnpm test:e2e` (`scripts/test-e2e-browser.py`)
- **Result**: **37 passed** assertions executing inside headless Google Chrome.
- **Guarantees**: Verifies studio DOM rendering, SVG canvas display (108 × 132 in), catalog search filtering, proposal preview rendering, human approval flow, version increment to v1, accessible manual edit form committing to v2, confirmation `<dialog>` modal interactions, 375px mobile responsiveness, and zero browser console errors.

---

## 7. Demo Video Script (2:30 Target)

- **0:00 - 0:20 (The Problem & The Vision)**: Introduction to Handshake. Why DOM automation and unconstrained agent tools fail in sensitive applications. The promise of WebMCP + page-owned consent.
- **0:20 - 0:40 (Shared Studio & Synthetic Room)**: Tour of the synthetic 9 × 11 ft bathroom studio. Show the 4-item fixture catalog, the SVG room canvas at Version 0, and the deterministic budget tracker ($14,000 allowance).
- **0:40 - 1:05 (WebMCP Tool Invocation & Proposal)**: Agent calls `propose_changes` with `harbor-vanity`. Point out the amber dashed preview on the canvas. Highlight that room version remains 0 and committed budget remains $0.
- **1:05 - 1:30 (Human Approval & Atomic Apply)**: Human clicks "Approve exact proposal" and then "Apply approved change". Room version increments to 1, fixture turns solid blue, and budget updates to $2,480.
- **1:30 - 1:50 (Accessible Manual Edit & Clearance)**: Human uses the manual coordinate controls to adjust the fixture. State updates to Version 2. Show the deterministic layout check updating in real time.
- **1:50 - 2:15 (Protected Action Barrier & Consent Grant)**: Agent invokes `request_protected_action` to book a showroom consultation. Worker returns `CONFIRMATION_REQUIRED`. Browser opens the page-owned modal showing the exact action and payload. Human clicks "Confirm exact action", granting single-use proof. Action completes with synthetic reference ID `SYN-XXXXXXXX`.
- **2:15 - 2:30 (Receipt Download & Closing)**: Download the tamper-evident JSON receipt. Show the complete event log, verify zero secret leaks, and summarize how WebMCP restores trust to agentic web applications.

---

## 8. Release Gate Checklist for Ehab

- [x] All 66 unit tests passing (`pnpm test`)
- [x] All 62 HTTP smoke assertions passing (`pnpm test:smoke`)
- [x] All 37 browser & accessibility assertions passing (`pnpm test:e2e`)
- [x] Zero external databases, KV, or external AI APIs introduced
- [x] All data is 100% synthetic (allowlisted fixtures only)
- [x] Zero hardcoded secrets, capabilities, or tokens in git
- [x] Complete deployment runbook provided in `docs/DEPLOYMENT-RUNBOOK.md`
- [x] Production release gate awaits Ehab's exact review and sign-off
