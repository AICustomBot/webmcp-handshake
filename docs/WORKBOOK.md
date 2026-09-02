# Handshake Engineering Workbook (Jira-Style)

**Project**: Handshake — WebMCP-Enabled Kitchen & Bath Co-Design Studio  
**Project Key**: `HSK`  
**Board**: Scrum / Kanban Board  
**Target Delivery**: Production Readiness & Contest Release  
**Status**: 🟢 ACTIVE (Sprint 4: Final Verification & Release Hardening)  
**Last Updated**: 2026-09-02T22:00:00Z

---

## 1. Epics Overview

| Epic Key       | Summary                                                       | Status          | Assignee       | Pull Request / Branch                       |
| :------------- | :------------------------------------------------------------ | :-------------- | :------------- | :------------------------------------------ |
| **HSK-EPIC-1** | Foundation validation, scaffold sync, toolchain corrections   | **CLOSED**      | Ehab           | PR #1 (`hsk-01-foundation-validation`)      |
| **HSK-EPIC-2** | Freeze contracts and implement consent policy engine          | **CLOSED**      | Team           | PR #3 (`hsk-02-contracts-policy`)           |
| **HSK-EPIC-3** | Implement Worker and Durable Object session runtime           | **CLOSED**      | Team           | PR #4 (`hsk-03-worker-runtime`)             |
| **HSK-EPIC-4** | Shared canvas, exact proposal review, runtime hardening       | **CLOSED**      | Team           | PR #5 (`hsk-04-shared-canvas`)              |
| **HSK-EPIC-5** | Register the governed WebMCP tool surface                     | **CLOSED**      | Team           | PR #6 (`hsk-05-webmcp`)                     |
| **HSK-EPIC-6** | Protected actions and evidence receipts                       | **CLOSED**      | Team           | PR #7 (`hsk-06-protected-actions-evidence`) |
| **HSK-EPIC-7** | Release hardening and verification evidence                   | **CLOSED**      | Team           | PR #8 (`hsk-07-release-hardening`)          |
| **HSK-EPIC-8** | End-to-end production verification, browser testing & release | **IN PROGRESS** | Senior AI Pair | Active                                      |

---

## 2. Active Sprint Board (Sprint 4: Production Delivery)

### Sprint Goal

Deliver an end-to-end working product in production with automated HTTP smoke tests across live Worker and Durable Objects, comprehensive browser test automation, accessibility verification, and a production deployment runbook.

### Task Board

```text
+------------------------------------+------------------------------------+------------------------------------+
| TO DO                              | IN PROGRESS                        | DONE                               |
+------------------------------------+------------------------------------+------------------------------------+
|                                    | [HSK-10] Playwright E2E browser &  | [HSK-1..8] Foundation through      |
|                                    | accessibility test suite           | release hardening (Merged to main) |
|                                    |                                    |                                    |
| [HSK-11] Production release guide, |                                    | [HSK-9] End-to-end HTTP smoke test |
| deployment runbook & submission    |                                    | runner & live runtime verification |
+------------------------------------+------------------------------------+------------------------------------+
```

---

## 3. Work Item Details

### [HSK-9] HSK-08-01: End-to-end HTTP smoke test runner and live runtime verification

- **Issue**: [#9](https://github.com/AICustomBot/webmcp-handshake/issues/9)
- **Branch**: `hsk-08-01-http-smoke`
- **Type**: Task / Integration Test
- **Priority**: High
- **Status**: `DONE`
- **Acceptance Criteria**:
  - [x] Standalone script `scripts/smoke-golden-journey.mjs` verifying the complete golden journey over HTTP against any target (default: `http://127.0.0.1:8787`).
  - [x] Validates 57 assertions over real HTTP:
    1. Public `/healthz` liveness check (status 200, contract metadata).
    2. Non-GET `/healthz` rejection (status 405).
    3. Session creation (`POST /api/v1/sessions`) with random 128-bit capability and room version 0.
    4. Room state check (`GET /api/v1/sessions/:id/state`) matching initial empty state and catalog evaluation.
    5. Synthetic catalog search (`GET /api/v1/sessions/:id/state` + fixture filters).
    6. Proposal creation (`POST /api/v1/sessions/:id/proposals`) computing canonical hash without mutating room version.
    7. Verification that room version remains 0 and items remain empty.
    8. Agent approval prevention (`POST /api/v1/sessions/:id/decisions` with agent actor fails with `FORBIDDEN_ACTOR`).
    9. Human UI approval (`POST /api/v1/sessions/:id/decisions` with `human_ui` actor and exact hash succeeds).
    10. Proposal apply (`POST /api/v1/sessions/:id/apply` commits room version 1 with item placed).
    11. Replay of apply fails closed (`PROPOSAL_ALREADY_DECIDED` or `VERSION_CONFLICT`).
    12. Manual edit via human UI route (`POST /api/v1/sessions/:id/edits` commits version 2).
    13. Layout clearance evaluation reflects modified item positions.
    14. Protected action request (`POST /api/v1/sessions/:id/protected-actions`) fails closed with `CONFIRMATION_REQUIRED`.
    15. Human UI confirmation (`POST /api/v1/sessions/:id/confirmations` grants single-use proof).
    16. Protected action completion with proof succeeds, returning synthetic reference ID.
    17. Receipt export (`GET /api/v1/sessions/:id/receipt`) contains complete sanitized audit log and no secrets.
  - [x] Added `pnpm test:smoke` command in `package.json`.
  - [x] Tested live against local `wrangler dev` background instance (57/57 passed).

---

### [HSK-10] HSK-08-02: Playwright end-to-end browser & accessibility test suite

- **Issue**: [#10](https://github.com/AICustomBot/webmcp-handshake/issues/10) (To be created)
- **Branch**: `hsk-08-02-e2e-browser`
- **Type**: Story / Automated Testing
- **Priority**: High
- **Status**: `TO DO`
- **Acceptance Criteria**:
  - [ ] Playwright test suite in `tests/e2e/studio.spec.ts`.
  - [ ] Verifies full user journey in real browser:
    - Studio page loads, connection status turns connected.
    - SVG canvas renders dimensions (9 × 11 ft / 108 × 132 in).
    - Fixture catalog search and filtering works.
    - Proposal cards display with exact diff and status.
    - Human approval and apply updates SVG canvas with placed fixture.
    - Manual coordinate edit and keyboard arrow manipulation.
    - Protected action modal displays exact action name and payload for human consent.
    - Receipt download triggers valid JSON payload without secrets.
    - WebMCP tools registration verification.
    - Accessibility audit (skip link, ARIA live region, dialog focus management).

---

### [HSK-11] HSK-08-03: Production release guide, deployment runbook, and submission pack

- **Issue**: [#11](https://github.com/AICustomBot/webmcp-handshake/issues/11) (To be created)
- **Branch**: `hsk-08-03-production-release`
- **Type**: Documentation / Ops Runbook
- **Priority**: High
- **Status**: `TO DO`
- **Acceptance Criteria**:
  - [ ] Production Deployment Runbook (`docs/DEPLOYMENT-RUNBOOK.md`) covering Cloudflare Worker deploy, Durable Object migrations, custom domains, monitoring, and instant rollback.
  - [ ] Production Readiness and Release Evidence (`docs/HSK-08-PRODUCTION-READINESS.md`) with release gate checklist for Ehab's final review.
  - [ ] Update `docs/SUBMISSION-PACK.md` and `docs/DOCUMENTATION-INDEX.md` with complete links and instructions.

---

## 4. Quality & Compliance Matrix

| Rule / Principle           | Implementation Mechanism                                                                | Status      |
| :------------------------- | :-------------------------------------------------------------------------------------- | :---------- |
| **No Proposal Mutation**   | Proposals stored in `session.proposals` map only; `room.version` unchanged              | ✅ VERIFIED |
| **No Self-Approval**       | Human-only endpoints route through `human_ui` actor; WebMCP tools have no approval tool | ✅ VERIFIED |
| **Precondition Checks**    | Writes enforce `expectedVersion`, canonical SHA-256 hash, and idempotency key           | ✅ VERIFIED |
| **Fail-Closed Policy**     | Unknown status, hash mismatch, or expired proof return stable error envelopes           | ✅ VERIFIED |
| **Zero Real Secrets/Data** | 100% synthetic catalog, synthetic references (`ref-`), zero external APIs               | ✅ VERIFIED |
| **Clean Repo Hygiene**     | Locked dependencies, zero lint/format errors, strict TypeScript                         | ✅ VERIFIED |
