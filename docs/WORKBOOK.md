# Handshake Engineering Workbook (Jira-Style)

**Project**: Handshake — WebMCP-Enabled Kitchen & Bath Co-Design Studio  
**Project Key**: `HSK`  
**Board**: Scrum / Kanban Board  
**Target Delivery**: Production Readiness & Contest Release  
**Status**: 🟢 ACTIVE (Sprint 5: Production Readiness & Kitchen-Bath Domain Integration)  
**Last Updated**: 2026-09-03T02:00:00Z

---

## 1. Epics Overview

| Epic Key        | Summary                                                       | Status          | Assignee       | Pull Request / Branch                       |
| :-------------- | :------------------------------------------------------------ | :-------------- | :------------- | :------------------------------------------ |
| **HSK-EPIC-1**  | Foundation validation, scaffold sync, toolchain corrections   | **CLOSED**      | Ehab           | PR #1 (`hsk-01-foundation-validation`)      |
| **HSK-EPIC-2**  | Freeze contracts and implement consent policy engine          | **CLOSED**      | Team           | PR #3 (`hsk-02-contracts-policy`)           |
| **HSK-EPIC-3**  | Implement Worker and Durable Object session runtime           | **CLOSED**      | Team           | PR #4 (`hsk-03-worker-runtime`)             |
| **HSK-EPIC-4**  | Shared canvas, exact proposal review, runtime hardening       | **CLOSED**      | Team           | PR #5 (`hsk-04-shared-canvas`)              |
| **HSK-EPIC-5**  | Register the governed WebMCP tool surface                     | **CLOSED**      | Team           | PR #6 (`hsk-05-webmcp`)                     |
| **HSK-EPIC-6**  | Protected actions and evidence receipts                       | **CLOSED**      | Team           | PR #7 (`hsk-06-protected-actions-evidence`) |
| **HSK-EPIC-7**  | Release hardening and verification evidence                   | **CLOSED**      | Team           | PR #8 (`hsk-07-release-hardening`)          |
| **HSK-EPIC-8**  | End-to-end production verification, browser testing & release | **CLOSED**      | Senior AI Pair | PR #10, #12, #14                            |
| **HSK-EPIC-9**  | Kitchen-Bath Domain Integration (Requirement R1)              | **CLOSED**      | Senior AI Pair | PR #15 (`hsk-09-kitchen-bath-integration`)  |
| **HSK-EPIC-10** | Production Frontend Polish (Requirement R2)                   | **IN PROGRESS** | Senior AI Pair | Branch `hsk-10-frontend-polish`             |
| **HSK-EPIC-11** | Backend Hardening for Production Traffic (Requirement R3)     | **TO DO**       | Senior AI Pair | Branch `hsk-11-backend-hardening`           |
| **HSK-EPIC-12** | CI/CD Pipeline & Deployment Automation (Requirement R4)       | **TO DO**       | Senior AI Pair | Branch `hsk-12-cicd-deployment`             |
| **HSK-EPIC-13** | Production Readiness Documentation (Requirement R5)           | **TO DO**       | Senior AI Pair | Branch `hsk-13-production-readiness-docs`   |
| **HSK-EPIC-14** | Requirement-Driven E2E Test Suite & Adversarial Hardening     | **CLOSED**      | Senior AI Pair | Verified (90 Unit, 62 Smoke, 37 E2E)        |

---

## 2. Active Sprint Board (Sprint 5: Production Readiness)

### Sprint Goal

Execute and complete the 5 core requirements (R1 through R5) plus requirement-driven E2E testing: merge the full kitchen-bath planning domain (+2,294 lines, 90 tests), expand catalog to 16 items with NKBA metadata, polish frontend with BOM, reset, loading, and accessible UI, harden backend with rate limiting and CORS, automate CI/CD with Miniflare smoke and Playwright E2E, and publish complete gap analysis documentation.

### Task Board

```text
+------------------------------------+------------------------------------+------------------------------------+
| TO DO                              | IN PROGRESS                        | DONE                               |
+------------------------------------+------------------------------------+------------------------------------+
| [HSK-17] M3 Backend Hardening      | [HSK-16] M2 Frontend Polish        | [HSK-1..14] Foundation, Core DO,   |
| [HSK-18] M4 CI/CD Automation       |                                    |             WebMCP, Smoke & Runbook|
| [HSK-19] M5 Production Docs        |                                    |                                    |
| [HSK-21] M6 Adversarial Hardening  |                                    | [HSK-15] M1 Kitchen-Bath Domain    |
|                                    |                                    |          Integration (R1) (Done)   |
|                                    |                                    |                                    |
|                                    |                                    | [HSK-20] E2E Testing Suite Track   |
|                                    |                                    |          (90 unit, 62 smoke, 37 e2e|
+------------------------------------+------------------------------------+------------------------------------+
```

---

## 3. Work Item Details (Sprint 5)

### [HSK-15] Milestone 1: Kitchen-Bath Domain Integration (R1)

- **Issue**: #15
- **Branch**: `hsk-09-kitchen-bath-integration`
- **Type**: Story / Feature Integration
- **Priority**: P0 (Highest)
- **Status**: `DONE`
- **Assignee**: Sub-Orchestrator M1 & Senior AI Pair
- **Tasks**:
  - [x] Fast-forward merge `origin/hsk-08-kitchen-bath-domain` into `main`.
  - [x] Add `.agents/` to `.gitignore` and verify `pnpm check`.
  - [x] Index ADR-0004 in `docs/IMPLEMENTATION-DECISIONS.md`.
  - [x] Expand `apps/worker/src/catalog.ts` with 16 synthetic kitchen and bath products.
  - [x] Implement `GET /api/v1/catalog` and handle `roomType` on session init in Worker.
  - [x] Initial client catalog and 9 tool names in `webmcp.js`.
  - [x] Complete `webmcp.js` tool implementation: add `roomType` to `search_catalog` and register `get_bill_of_materials` in `tools`.
  - [x] Update `index.html`: add `#room-type-select`, `.bom-panel`, and SVG layer groups (`#openings-layer`, `#anchors-layer`).
  - [x] Update `app.js`: synchronize 16-item catalog, filter 4 bathroom items for bathroom sessions, handle room type change, render SVG openings and anchors, render BOM lines and total.
  - [x] Run full verification suite (`pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm check`).
  - [x] Commit changes referencing HSK-15 and merge `hsk-09-kitchen-bath-integration` into `main`.

---

### [HSK-16] Milestone 2: Production Frontend Polish (R2)

- **Issue**: #16
- **Branch**: `hsk-10-frontend-polish`
- **Type**: Story / UX Polish
- **Priority**: P1 (High)
- **Status**: `IN PROGRESS`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [ ] Session reset button with confirmation dialog.
  - [ ] Loading indicators and disabled states on API calls.
  - [ ] Itemized Bill of Materials panel with costs and totals.
  - [ ] Printable receipt and room spec view with `@media print`.
  - [ ] Actionable error state handling using `ERROR_COPY`.
  - [ ] Text + icon state badges (no color alone).
  - [ ] Responsive 390px mobile layout without horizontal scroll.
  - [ ] Complete keyboard-only golden journey navigation.
  - [ ] Drag-and-drop fixture placement onto SVG canvas.
  - [ ] WebMCP unavailable fallback notice banner.

---

### [HSK-17] Milestone 3: Backend Hardening for Production Traffic (R3)

- **Issue**: #17
- **Branch**: `hsk-11-backend-hardening`
- **Type**: Story / Infrastructure & Security
- **Priority**: P1 (High)
- **Status**: `TO DO`
- **Assignee**: Sub-Orchestrator M3
- **Tasks**:
  - [ ] Rate limiting in `DesignSession` DO returning 429 `RATE_LIMITED`.
  - [ ] CORS preflight and response headers on `/api/v1/*`.
  - [ ] Server-side query parameter filtering on `GET /api/v1/catalog`.
  - [ ] Request body streaming validation (32 KiB cap).
  - [ ] Protected action network retry resilience.
  - [ ] Staging environment configuration in `wrangler.jsonc`.

---

### [HSK-18] Milestone 4: CI/CD Pipeline & Deployment Automation (R4)

- **Issue**: #18
- **Branch**: `hsk-12-cicd-deployment`
- **Type**: Task / DevOps Automation
- **Priority**: P1 (High)
- **Status**: `TO DO`
- **Assignee**: Sub-Orchestrator M4
- **Tasks**:
  - [ ] Miniflare-based smoke test step in GitHub Actions.
  - [ ] Playwright E2E browser test job in CI.
  - [ ] Staging deployment automation on merge to main.
  - [ ] Environment management and secret validation.

---

### [HSK-19] Milestone 5: Production Readiness Documentation & Gap Plan (R5)

- **Issue**: #19
- **Branch**: `hsk-13-production-readiness-docs`
- **Type**: Task / Documentation
- **Priority**: P1 (High)
- **Status**: `TO DO`
- **Assignee**: Sub-Orchestrator M5
- **Tasks**:
  - [ ] Comprehensive Gap Analysis (`docs/GAP-ANALYSIS.md`) across 6 tracks with P0-P3 priorities.
  - [ ] Sprint Plan and Roadmap (`docs/SPRINT-PLAN.md`).
  - [ ] REST API specification (`docs/API.md`).
  - [ ] Update README, docs index, architecture, and runbooks.

---

### [HSK-20] E2E Testing Suite Track (Dual Track)

- **Issue**: #20
- **Branch**: `hsk-14-e2e-test-suite`
- **Type**: Task / Testing Track
- **Priority**: P0 (Highest)
- **Status**: `IN PROGRESS`
- **Assignee**: E2E Testing Orchestrator
- **Tasks**:
  - [ ] Publish `TEST_INFRA.md` with 4-tier methodology (Category-Partition, BVA, Pairwise, Real-World).
  - [ ] Implement Tier 1 Feature Coverage tests (>=5 per feature).
  - [ ] Implement Tier 2 Boundary & Corner Case tests.
  - [ ] Implement Tier 3 Cross-Feature Combination tests.
  - [ ] Implement Tier 4 Real-World Application Scenario tests.
  - [ ] Publish `TEST_READY.md` upon 100% test completion.

---

### [HSK-21] Milestone 6: Final Verification & Adversarial Hardening

- **Issue**: #21
- **Branch**: `hsk-15-final-verification`
- **Type**: Story / Quality Gate
- **Priority**: P0 (Highest)
- **Status**: `TO DO`
- **Assignee**: Sub-Orchestrator M6
- **Tasks**:
  - [ ] Phase 1: Pass 100% of E2E test suite (Tiers 1-4).
  - [ ] Phase 2: White-box adversarial testing (Tier 5) with Challengers.
  - [ ] Forensic Auditor integrity validation (CLEAN verdict).
