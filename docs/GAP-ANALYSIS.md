# Handshake Production Gap Analysis & Strategic Roadmap

**Project**: Handshake — WebMCP-Enabled Kitchen & Bath Co-Design Studio  
**Authoritative Reference**: `docs/IMPLEMENTATION-DECISIONS.md`, `packages/contracts`, `packages/policy`  
**Date**: 2026-09-03  
**Status**: Comprehensive Audit & Production Roadmap

---

## 1. Executive Summary

A comprehensive architectural audit, security review, and full-stack automated verification of **Handshake** was conducted. Handshake is designed to solve the critical trust and authorization gap in agentic web applications by coupling in-browser **WebMCP** tool contracts with a **page-owned, cryptographic consent protocol** backed by Cloudflare Workers and Durable Objects.

### What Was Audited & Verified Live

1. **Machine-Readable Contracts (`packages/contracts`)**: Frozen schema types, error codes (`HTTP_STATUS_FOR_ERROR`), bounding limits (`LIMITS`), and 9 WebMCP tool definitions.
2. **Deterministic Policy Engine (`packages/policy`)**: Canonical JSON hashing (`canonicalize`, `sha256Hex`), immutable proposal hash-binding, version precondition enforcement, and comprehensive NKBA Kitchen & Bath planning rules (`guidelines.ts`).
3. **Stateful Edge Runtime (`apps/worker`)**: Single-threaded linearizable session ownership in Durable Objects (`DesignSession`), single-use proof token generation, atomic CAS consumption, and allowlisted audit receipt exports.
4. **Interactive Studio UI (`apps/web`)**: SVG room canvas, 16-fixture synthetic catalog, room type domain toggling (`bathroom` vs `kitchen`), architectural wall opening/anchor rendering, dynamic Bill of Materials panel, and accessible modal confirmation dialog.
5. **Multi-Layer Automated Testing**:
   - **Unit & Policy Suite**: **90/90 tests passing** across 7 test files (`pnpm check`).
   - **Live HTTP Smoke Suite**: **62/62 assertions passing** over live HTTP (`pnpm test:smoke`).
   - **Playwright Headless Browser & A11y Suite**: **37/37 assertions passing** inside headless Google Chrome (`pnpm test:e2e`).
   - **Worker Packaging**: **0 errors**, 81.76 KiB bundle (`wrangler deploy --dry-run`).

---

## 2. Completed Milestones (HSK-01 through HSK-15)

The table below summarizes the foundational and domain implementation landed:

| Milestone / PR       | Scope Delivered                                                                                                                                                                                                                                                                                                                               | Verification Evidence                                    |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| **HSK-01 to HSK-07** | Foundation scaffold, contracts v1.0, consent policy, Durable Object runtime, initial SVG canvas, 8 WebMCP tools, evidence receipts, release hardening.                                                                                                                                                                                        | 66 unit tests, locked dependencies.                      |
| **HSK-08 (01..03)**  | Live HTTP smoke test suite, Playwright browser test runner, production deployment runbook.                                                                                                                                                                                                                                                    | 62 smoke assertions, 37 browser assertions.              |
| **HSK-15 (M1)**      | **Full Kitchen & Bath Domain Scope (ADR-0004)**: Merged NKBA guidelines engine, expanded synthetic catalog to 16 items with SKUs, clearances, and utility anchors; added `GET /api/v1/catalog` and `/bom` endpoints; registered 9th WebMCP tool `get_bill_of_materials`; built room type switcher, BOM panel, and SVG opening/anchor visuals. | 90 unit tests, 62 smoke tests, 37 browser tests passing. |

---

## 3. Granular Gap Analysis for Production (Tracks 1–6)

To transition Handshake from a hackathon-grade proof-of-concept into a production-hardened web application serving real users and showroom designers, the following gaps must be closed:

```text
+-------------------------------------------------------------------------------+
|                             HANDSHAKE GAPS BY TRACK                           |
+-------------------+-------------------+-------------------+-------------------+
| TRACK 1: FRONTEND | TRACK 2: BACKEND  | TRACK 3: INFRA    | TRACK 4: AGENT    |
| - Session Reset   | - Rate Limiter    | - Staging Env     | - Fallback WebMCP |
| - Loading States  | - CORS Headers    | - Custom Domains  | - Live LLM Demo   |
| - Print Layout    | - Stream Validate | - Live Tail Alert | - Agent Prompting |
| - Drag & Drop SVG | - Alarm Pruning   | - Secret Auditing | - Tool Evals      |
+-------------------+-------------------+-------------------+-------------------+
| TRACK 5: CI/CD & DEVOPS               | TRACK 6: SECURITY & CONSTITUTION      |
| - Miniflare CI Smoke Tests            | - Zero Real Data Preservation         |
| - Playwright Browser Suite in Actions | - Channel Authority Audit             |
| - Staging Deployment Pipeline         | - Single-Use Proof Invariant Verifier |
+---------------------------------------+---------------------------------------+
```

---

### Track 1: Frontend & Studio UX Polish (HSK-EPIC-10)

| Gap ID    | Description                      | Severity | Impact                                                                                                                         | Recommended Solution                                                                                                                                              |
| :-------- | :------------------------------- | :------: | :----------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FE-01** | **No Session Reset Button**      |  **P0**  | Users cannot start a fresh design session without manually clearing `sessionStorage` in DevTools.                              | Add a "New Session" button in the topbar header with a modal confirmation dialog that clears storage and calls `POST /api/v1/sessions`.                           |
| **FE-02** | **No Loading / Progress States** |  **P1**  | Network latency during proposal creation, decision, or apply feels unresponsive.                                               | Disable action buttons and display a spinner / accessible `aria-busy="true"` state on the canvas and button rows during fetch calls.                              |
| **FE-03** | **No Printable Summary View**    |  **P1**  | Promised in `docs/PRODUCT-SPEC.md` but users cannot cleanly print floorplans or quotes.                                        | Implement an `@media print` stylesheet hiding sidebars and formatting the room SVG, Bill of Materials table, and verified receipt signature for paper/PDF export. |
| **FE-04** | **No Drag-and-Drop Placement**   |  **P2**  | Coordinate inputs and keyboard arrows work well for accessibility, but mouse-oriented users expect direct canvas manipulation. | Implement pointer events on SVG fixtures allowing drag-and-drop within room bounding boxes while preserving keyboard controls.                                    |
| **FE-05** | **WebMCP Unavailable Banner**    |  **P1**  | Browsers without `window.document.modelContext` fail silently with a console event.                                            | Display an informational banner explaining that the studio is operating in manual co-design mode with fallback AI tool support.                                   |

---

### Track 2: Backend Runtime & Durable Objects Hardening (HSK-EPIC-11)

| Gap ID    | Description                      | Severity | Impact                                                                                                                                                               | Recommended Solution                                                                                                                                       |
| :-------- | :------------------------------- | :------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BE-01** | **No Active Rate Limiting**      |  **P0**  | Although `RATE_LIMITED` (HTTP 429) exists in `@handshake/contracts`, no rate limiter is enforced in `DesignSession`. A rogue agent loop could exhaust DO CPU budget. | Implement an in-memory token bucket rate limiter inside `DesignSession` (e.g. 60 requests/minute per capability token) returning `RATE_LIMITED` on excess. |
| **BE-02** | **Missing CORS Headers**         |  **P1**  | If a showroom or partner embeds the co-design workspace in an iframe or connects a cross-origin agent, calls fail.                                                   | Implement strict CORS preflight (`OPTIONS`) handling and configurable `Access-Control-Allow-Origin` headers on all `/api/v1/*` routes.                     |
| **BE-03** | **Stream Body Size Enforcement** |  **P1**  | `readBoundedJson()` checks `LIMITS.maxBodyBytes` (32 KiB) after buffer accumulation; chunked streams could buffer unbounded bytes before checking.                   | Enforce chunk byte accumulation caps during stream reading to immediately terminate oversized request payloads fail-closed.                                |
| **BE-04** | **Orphaned Session Pruning**     |  **P2**  | Inactive sessions rely solely on a 24-hour DO storage alarm (`alarm()`). If an alarm fails to reschedule, storage accumulates.                                       | Add an explicit TTL check on session read and schedule periodic batch tombstone sweeps.                                                                    |

---

### Track 3: Infrastructure & DevOps (HSK-EPIC-12)

| Gap ID     | Description                       | Severity | Impact                                                                                              | Recommended Solution                                                                                                                                    |
| :--------- | :-------------------------------- | :------: | :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **INF-01** | **No Staging Environment**        |  **P0**  | `wrangler.jsonc` only defines the root worker configuration. Deployments go directly to production. | Add an `[env.staging]` block in `wrangler.jsonc` with preview domain bindings and dedicated Durable Object namespaces.                                  |
| **INF-02** | **Production Deployment Gated**   |  **P0**  | Production deployment has never been executed to a live Cloudflare zone.                            | Execute pre-flight verification gates (`DEPLOYMENT-RUNBOOK.md`) and deploy to Cloudflare Workers with custom domain SSL proxying.                       |
| **INF-03** | **Observability & Log Streaming** |  **P2**  | Real-time errors in Durable Objects can only be observed via manual `wrangler tail`.                | Configure Cloudflare Workers Tail Workers or Logpush to stream structured audit telemetry into an external log sink without logging capability secrets. |

---

### Track 4: Real AI Agent & WebMCP Ecosystem Integration

| Gap ID    | Description                           | Severity | Impact                                                                                                                                             | Recommended Solution                                                                                                                                                              |
| :-------- | :------------------------------------ | :------: | :------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI-01** | **No Native In-Browser LLM Driver**   |  **P0**  | WebMCP tools are registered on `document.modelContext`, but Chrome with built-in Gemini Nano / Prompt API requires explicit user enablement flags. | Build an optional in-browser simulated agent runner or Gemini Flash bridge allowing users to trigger autonomous agent proposals with a single click.                              |
| **AI-02** | **Agent System Prompt Specification** |  **P1**  | An external LLM connecting via WebMCP needs a standardized system prompt and rule boundary instructions.                                           | Provide `docs/AGENT-INSTRUCTIONS.md` with the official system prompt instructing the agent on proposal structures, rationale generation, and protected action confirmation loops. |

---

### Track 5: CI/CD Pipeline Automation (HSK-EPIC-12)

| Gap ID    | Description                          | Severity | Impact                                                                                                                 | Recommended Solution                                                                                                                |
| :-------- | :----------------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **CI-01** | **No Smoke Test in GitHub Actions**  |  **P1**  | CI only runs unit tests (`pnpm check`) and `wrangler deploy --dry-run`. Live HTTP and DO routes are not tested in PRs. | Add a GitHub Actions step using `wrangler dev` in background and running `pnpm test:smoke`.                                         |
| **CI-02** | **No Browser E2E in GitHub Actions** |  **P1**  | Playwright tests run locally but are not enforced in pull requests.                                                    | Add Playwright browser installation step in `.github/workflows/ci.yml` and execute `pnpm test:e2e`.                                 |
| **CI-03** | **Automated Staging Deployment**     |  **P2**  | Code merged to `main` is not automatically deployed to preview URLs.                                                   | Configure GitHub Actions deployment job on push to `main` deploying to the Cloudflare staging environment using repository secrets. |

---

## 4. Prioritized Sprint Backlog (Sprint 6 & 7)

```text
+-------------------------------------------------------------------------------+
|                           SPRINT 6: HARDENING & UX                            |
+---------+-----------------------------------+----------+-----------+----------+
| Item    | Summary                           | Priority | Estimate  | Assignee |
+---------+-----------------------------------+----------+-----------+----------+
| HSK-16  | M2: Frontend UX Polish & BOM Print| P0       | 2 days    | Frontend |
| HSK-17  | M3: DO Rate Limiting & CORS       | P0       | 1.5 days  | Backend  |
| HSK-22  | Simulated Agent Walkthrough Demo  | P1       | 1 day     | AI/Agent |
| HSK-23  | Staging Env in wrangler.jsonc     | P0       | 0.5 days  | DevOps   |
+---------+-----------------------------------+----------+-----------+----------+
|                           SPRINT 7: CI/CD & LAUNCH                            |
+---------+-----------------------------------+----------+-----------+----------+
| HSK-18  | M4: CI/CD Smoke & Playwright Jobs | P1       | 1.5 days  | DevOps   |
| HSK-24  | Production Live Deployment        | P0       | 1 day     | Ehab     |
| HSK-25  | Devpost Video & Submission Pack   | P0       | 1 day     | Team     |
+---------+-----------------------------------+----------+-----------+----------+
```

---

## 5. Constitutional Governance & Maintenance Guidelines

To preserve system security, maintainability, and contest eligibility, every future change must obey the following rules:

1. **Constitutional Order of Authority**:
   - `docs/IMPLEMENTATION-DECISIONS.md` > Contracts (`packages/contracts`) > Policy (`packages/policy`) > Specs > Code.
2. **Strict Invariants**:
   - Never allow an agent to approve its own proposal.
   - Never mutate committed room state from proposal tools.
   - Never accept model text or DOM descriptions as authorization.
   - All state mutations require monotonic version preconditions and idempotency keys.
   - All data remains 100% synthetic (zero PII, zero real customer records).
3. **Branch & PR Hygiene**:
   - One issue per feature branch.
   - Contracts must be committed before implementation code.
   - All verification suites (`pnpm check`, `pnpm test:smoke`, `pnpm test:e2e`) must pass with 0 warnings/errors before PR merge.
