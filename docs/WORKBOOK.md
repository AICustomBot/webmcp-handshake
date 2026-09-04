# Handshake Engineering Workbook (Jira-Style)

**Project**: Handshake — WebMCP-Enabled Kitchen & Bath Co-Design Studio  
**Project Key**: `HSK`  
**Board**: Scrum / Kanban Board  
**Target Delivery**: Production Readiness & Contest Release  
**Status**: 🟢 ACTIVE (Sprint 5: Production Readiness & Kitchen-Bath Domain Integration)  
**Last Updated**: 2026-09-03T02:00:00Z

---

## 1. Epics Overview

| Epic Key        | Summary                                                       | Status     | Assignee       | Pull Request / Branch                       |
| :-------------- | :------------------------------------------------------------ | :--------- | :------------- | :------------------------------------------ |
| **HSK-EPIC-1**  | Foundation validation, scaffold sync, toolchain corrections   | **CLOSED** | Ehab           | PR #1 (`hsk-01-foundation-validation`)      |
| **HSK-EPIC-2**  | Freeze contracts and implement consent policy engine          | **CLOSED** | Team           | PR #3 (`hsk-02-contracts-policy`)           |
| **HSK-EPIC-3**  | Implement Worker and Durable Object session runtime           | **CLOSED** | Team           | PR #4 (`hsk-03-worker-runtime`)             |
| **HSK-EPIC-4**  | Shared canvas, exact proposal review, runtime hardening       | **CLOSED** | Team           | PR #5 (`hsk-04-shared-canvas`)              |
| **HSK-EPIC-5**  | Register the governed WebMCP tool surface                     | **CLOSED** | Team           | PR #6 (`hsk-05-webmcp`)                     |
| **HSK-EPIC-6**  | Protected actions and evidence receipts                       | **CLOSED** | Team           | PR #7 (`hsk-06-protected-actions-evidence`) |
| **HSK-EPIC-7**  | Release hardening and verification evidence                   | **CLOSED** | Team           | PR #8 (`hsk-07-release-hardening`)          |
| **HSK-EPIC-8**  | End-to-end production verification, browser testing & release | **CLOSED** | Senior AI Pair | PR #10, #12, #14                            |
| **HSK-EPIC-9**  | Kitchen-Bath Domain Integration (Requirement R1)              | **CLOSED** | Senior AI Pair | PR #15 (`hsk-09-kitchen-bath-integration`)  |
| **HSK-EPIC-10** | Production Frontend Polish (Requirement R2)                   | **CLOSED** | Senior AI Pair | PR #16 (`hsk-10-frontend-polish`)           |
| **HSK-EPIC-11** | Backend Hardening for Production Traffic (Requirement R3)     | **CLOSED** | Senior AI Pair | PR #17 (`hsk-11-backend-hardening`)         |
| **HSK-EPIC-12** | CI/CD Pipeline & Deployment Automation (Requirement R4)       | **CLOSED** | Senior AI Pair | PR #18 (`hsk-12-cicd-deployment`)           |
| **HSK-EPIC-13** | Production Readiness Documentation (Requirement R5)           | **CLOSED** | Senior AI Pair | PR #19 (`hsk-13-production-readiness-docs`) |
| **HSK-EPIC-14** | Requirement-Driven E2E Test Suite & Adversarial Hardening     | **CLOSED** | Senior AI Pair | Verified (100 Unit, 62 Smoke, 37 E2E)       |
| **HSK-EPIC-15** | Brand Identity & Pro Logo/Favicon Design                      | **CLOSED** | Senior AI Pair | PR #22 (`hsk-16-logo-favicon`)              |
| **HSK-EPIC-16** | Deployment Readiness Audit & Pre-flight Hygiene               | **CLOSED** | Senior AI Pair | PR #23 (`hsk-17-deploy-readiness-audit`)    |
| **HSK-EPIC-17** | GitHub Site Polish, Remote Sync & Verification                | **CLOSED** | Senior AI Pair | PR #24 (`hsk-18-github-site-polish`)        |
| **HSK-EPIC-18** | Next.js 16 & 3D Studio Migration to Vercel                    | **ACTIVE** | Senior AI Pair | Sprint 6 (HSK-25..32)                       |

---

## 2. Active Sprint Board (Sprint 6: Next.js 16 & React Three Fiber 3D Studio)

### Sprint Goal

Migrate Handshake's frontend to a production Next.js 16+ App Router application deployed to Vercel. Transform the studio into a real-time architectural and 3D design environment (React Three Fiber, Drei, Rapier) supporting full Kitchen & Bath functionality (procedural parametric cabinets, appliances, fixtures, materials, walkthrough/orbit cameras, and dimension lines). Retain Cloudflare Workers + Durable Objects as the authoritative stateful edge consensus backend via Vercel proxy rewrites. Preserve all constitutional invariants (non-mutating proposals, page-owned human consent barriers, single-use proofs, tamper-evident receipts) and integrate the WebMCP bridge + Vercel AI SDK copilot.

### Task Board

```text
+------------------------------------+------------------------------------+------------------------------------+
| TO DO                              | IN PROGRESS                        | DONE                               |
+------------------------------------+------------------------------------+------------------------------------+
| [HSK-30] WebMCP Bridge & Vercel    |                                    | [HSK-1..24] Sprints 1–5 Closed     |
|          AI SDK Copilot Integration|                                    |             (Full K&B Domain, DO,  |
|                                    |                                    |              WebMCP, Hardening)    |
| [HSK-31] Enterprise Studio UX: BOM,|                                    | [HSK-25] ADR-0005 Next.js Frontend |
|          NKBA Checks, Consent Gates|                                    |          on Vercel Architecture    |
|                                    |                                    |                                    |
| [HSK-32] Vercel Deploy Automation  |                                    | [HSK-26] Next.js 16 App Scaffold   |
|          & Full Stack Verification |                                    |          & Monorepo Integration    |
|                                    |                                    |                                    |
|                                    |                                    | [HSK-27] API Client, Proxy Rewrites|
|                                    |                                    |          & DO Session State Sync   |
|                                    |                                    |                                    |
|                                    |                                    | [HSK-28] 2D Architectural Floorplan|
|                                    |                                    |          & Fixture Drag-and-Drop   |
|                                    |                                    |                                    |
|                                    |                                    | [HSK-29] React Three Fiber 3D      |
|                                    |                                    |          Parametric Studio Canvas  |
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
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [x] Session reset button with confirmation dialog.
  - [x] Loading indicators and disabled states on API calls.
  - [x] Itemized Bill of Materials panel with costs and totals.
  - [x] Printable receipt and room spec view with `@media print`.
  - [x] Actionable error state handling using `ERROR_COPY`.
  - [x] Text + icon state badges (no color alone).
  - [x] Responsive 390px mobile layout without horizontal scroll.
  - [x] Complete keyboard-only golden journey navigation.
  - [x] Drag-and-drop fixture placement onto SVG canvas.
  - [x] WebMCP unavailable fallback notice banner.

---

### [HSK-17] Milestone 3: Backend Hardening for Production Traffic (R3)

- **Issue**: #17
- **Branch**: `hsk-11-backend-hardening`
- **Type**: Story / Infrastructure & Security
- **Priority**: P1 (High)
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [x] Rate limiting in `DesignSession` DO returning 429 `RATE_LIMITED`.
  - [x] CORS preflight and response headers on `/api/v1/*`.
  - [x] Server-side query parameter filtering on `GET /api/v1/catalog`.
  - [x] Request body streaming validation (32 KiB cap).
  - [x] Protected action network retry resilience.
  - [x] Staging environment configuration in `wrangler.jsonc`.

---

### [HSK-18] Milestone 4: CI/CD Pipeline & Deployment Automation (R4)

- **Issue**: #18
- **Branch**: `hsk-12-cicd-deployment`
- **Type**: Task / DevOps Automation
- **Priority**: P1 (High)
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [x] Miniflare-based smoke test step in GitHub Actions.
  - [x] Playwright E2E browser test job in CI.
  - [x] Staging deployment dry-run verification in CI.
  - [x] Environment management and secret validation.

---

### [HSK-19] Milestone 5: Production Readiness Documentation & Gap Plan (R5)

- **Issue**: #19
- **Branch**: `hsk-13-production-readiness-docs`
- **Type**: Task / Documentation
- **Priority**: P1 (High)
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [x] Comprehensive Gap Analysis (`docs/GAP-ANALYSIS.md`) across 6 tracks with P0-P3 priorities.
  - [x] Sprint Plan and Roadmap (`docs/GAP-ANALYSIS.md` §5).
  - [x] REST API specification (`docs/API.md`).
  - [x] Update README, docs index, architecture, and runbooks.

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
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [x] Phase 1: Pass 100% of E2E test suite (100 unit/policy tests, 62 smoke tests, 37 browser E2E tests).
  - [x] Phase 2: White-box adversarial testing (`tests/adversarial.test.ts` covering 7 constitutional prohibitions).
  - [x] Forensic Auditor integrity validation (CLEAN verdict, zero leaks, full redaction in receipts).

---

### [HSK-22] Brand Identity & Pro Logo/Favicon Design

- **Issue**: #22
- **Branch**: `hsk-16-logo-favicon`
- **Type**: Story / Design & UX
- **Priority**: P1 (High)
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
  - [x] Design precision vector SVG brand logo (`apps/web/public/logo.svg`).
  - [x] Design high-contrast scalable favicon (`apps/web/public/favicon.svg`).
  - [x] Generate high-res raster PNG assets (`favicon.ico`, `favicon.png`, `apple-touch-icon.png`, `logo.png`).
  - [x] Integrate logo into Studio SPA header with accessible markup in `apps/web/public/index.html`.
  - [x] Wire favicon `<link>` tags in `<head>` of `apps/web/public/index.html`.
  - [x] Add CSS styling in `apps/web/public/styles.css` for responsive logo presentation.
  - [x] Verify browser rendering, smoke tests, unit tests, and dry-run bundles.

---

### [HSK-23] Production Deployment Readiness Audit & Pre-flight Hygiene

- **Issue**: #23
- **Branch**: `hsk-17-deploy-readiness-audit`
- **Type**: Task / Operations & Audit
- **Priority**: P0 (Highest)
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
- - [x] Audit Cloudflare Workers & Durable Objects deploy configuration (`wrangler.jsonc`, `package.json`).
- - [x] Execute bundle dry-run for production (`wrangler deploy --dry-run`).
- - [x] Execute bundle dry-run for staging (`wrangler deploy --env staging --dry-run`).
- - [x] Verify Cloudflare account authentication (`wrangler whoami`).
- - [x] Create `.prettierignore` and update `.gitignore` with `.workbuddy-ai/` to enforce 100% clean pre-flight verification (`pnpm check`).
- - [x] Map the complete release ecosystem: Cloudflare, GitHub, Devpost, Demo Video hosting, and WebMCP agent ecosystem.
- - [x] Compile comprehensive deploy readiness audit and operational guidance report.

---

### [HSK-24] GitHub Site Polish, Remote Sync & Verification

- **Issue**: #24
- **Branch**: `hsk-18-github-site-polish`
- **Type**: Story / GitHub Operations
- **Priority**: P0 (Highest)
- **Status**: `DONE`
- **Assignee**: Senior AI Pair
- **Tasks**:
- - [x] Push local `main` commits to GitHub `origin/main` (26 commits pushed).
- - [x] Verify remote GitHub pull request #15 auto-merge status upon main branch convergence.
- - [x] Monitor GitHub Actions CI workflow run `33808585198` to complete success on main.
- - [x] Configure repository metadata: add searchable topics (`webmcp`, `cloudflare-workers`, `durable-objects`, `ai-agents`, `human-in-the-loop`, `typescript`, `consent-protocol`).
- - [x] Enhance `README.md` with status badges for CI, License, TypeScript, Cloudflare Workers & Durable Objects, and WebMCP 2.0.0.
- - [x] Run full local verification (`pnpm check`).
- - [x] Open and merge PR for `hsk-18-github-site-polish` into `main` and push upstream.

---

## 4. Sprint 6: Next.js 16 & React Three Fiber 3D Studio (HSK-EPIC-18)

### [HSK-25] Architecture Decision Record: Next.js on Vercel (ADR-0005)

- **Issue**: #25
- **Branch**: `hsk-19-nextjs-migration-plan`
- **Type**: Story / Architecture
- **Priority**: P0 (Highest)
- **Status**: `DONE`
- **Assignee**: Senior Architect & Engineer
- **Tasks**:
  - [x] Author `docs/decisions/ADR-0005-vercel-nextjs-frontend.md` defining decoupled frontend/backend topology.
  - [x] Index ADR-0005 in `docs/IMPLEMENTATION-DECISIONS.md`.
  - [x] Define Vercel rewrites proxy strategy vs direct CORS communication.
  - [x] Establish invariant preservation protocol for WebMCP and page-owned human consent gates.

---

### [HSK-26] Next.js 16 App Scaffold & Monorepo Integration

- **Issue**: #26
- **Branch**: `hsk-20-nextjs-scaffold`
- **Type**: Story / Frontend Infrastructure
- **Priority**: P0 (Highest)
- **Status**: `CLOSED`
- **Assignee**: Senior Frontend Engineer
- **Tasks**:
  - [x] Initialize Next.js 16 App Router application in `apps/web` with React 19 and TypeScript.
  - [x] Configure Tailwind CSS, postcss, and Geist font family.
  - [x] Link monorepo dependencies (`@handshake/contracts`, `@handshake/policy`) via `workspace:*`.
  - [x] Configure `next.config.ts` with Vercel rewrites proxying `/api/v1/:path*` to Cloudflare Worker.
  - [x] Migrate static brand assets (`logo.svg`, favicons, brand illustrations) to `apps/web/public/`.
  - [x] Verify root package scripts (`pnpm dev`, `pnpm build`, `pnpm check`).

---

### [HSK-27] API Client, Proxy Rewrites & DO Session State Sync

- **Issue**: #27
- **Branch**: `hsk-21-api-client-state-sync`
- **Type**: Story / Client Infrastructure
- **Priority**: P0 (Highest)
- **Status**: `CLOSED`
- **Assignee**: Senior Frontend Engineer
- **Tasks**:
  - [x] Implement typed API client (`lib/api-client.ts`) covering all 10 worker endpoints.
  - [x] Enforce session capability header (`x-handshake-capability`) and error envelope mapping (`isErrorCode`).
  - [x] Build central Zustand studio store (`lib/store/studio-store.ts`) for session state, active proposal, zoom, selection, and viewport mode.
  - [x] Implement session persistence with local/session storage recovery and atomic reset action.
  - [x] Unit test API client with mock fetch responses verifying version mismatch (409) and rate limit (429) handling.

---

### [HSK-28] 2D Architectural Floorplan & Fixture Drag-and-Drop

- **Issue**: #28
- **Branch**: `hsk-22-2d-architectural-canvas`
- **Type**: Story / 2D Studio Component
- **Priority**: P1 (High)
- **Status**: `DONE`
- **Assignee**: Senior Frontend Engineer
- **Tasks**:
  - [x] Build React 2D floorplan canvas component (`components/studio/canvas-2d.tsx`).
  - [x] Render wall framing layers with thickness, interior dimensions, and grid units (12-inch snap).
  - [x] Render door swings, window openings, and wall cutouts (`openings-layer`).
  - [x] Render utility service anchors (water, drain, gas, 120V/240V electric, vent).
  - [x] Implement pointer drag-and-drop fixture movement with boundary clamping and coordinate snapping.
  - [x] Render amber dashed proposal shapes with non-mutating preview guarantees.

---

### [HSK-29] React Three Fiber (R3F) 3D Studio Visualizer

- **Issue**: #29
- **Branch**: `hsk-23-r3f-3d-studio`
- **Type**: Story / 3D Graphics
- **Priority**: P0 (Highest)
- **Status**: `DONE`
- **Assignee**: 3D Graphics & Senior Frontend Engineer
- **Tasks**:
  - [x] Scaffold `<Canvas3D>` component using `@react-three/fiber` and `@react-three/drei` with SSR dynamic loading (`next/dynamic ssr: false`).
  - [x] Build procedural parametric 3D models for all 16 catalog items:
    - Base, wall, and tall kitchen cabinets with door/drawer geometry and countertop slabs.
    - Appliances (refrigerator with door swing, range with cooktop burners, hood, dishwasher).
    - Bathroom fixtures (vanity with undermount sink, freestanding tub, open glass shower, toilet).
  - [x] Build 3D wall extrusion with window and door opening cutouts.
  - [x] Implement PBR materials (matte white, shaker gray, walnut woodgrain, quartz countertop, brushed brass, matte black metal).
  - [x] Multi-camera controller: OrbitControls (3D perspective fly-around), First-Person (walkthrough / eye-level 60" elevation), and Orthographic top-down plan.
  - [x] Studio lighting setup: directional sunlight through modeled windows, soft ambient fill, and contact shadows.

---

### [HSK-30] WebMCP Bridge & Vercel AI SDK Copilot Integration

- **Issue**: #30
- **Branch**: `hsk-24-webmcp-ai-sdk`
- **Type**: Story / AI Agent Integration
- **Priority**: P0 (Highest)
- **Status**: `PLANNED`
- **Assignee**: AI Engineer & Senior Architect
- **Tasks**:
  - [ ] Implement `useWebMCP` React hook to register all 9 contracted tools on `document.modelContext` with mount/unmount lifecycle cleanup.
  - [ ] Build in-app AI Copilot chat drawer using Vercel AI SDK (`ai` v6, `useChat`).
  - [ ] Expose the 9 contracted tools to the AI Copilot via client tool execution calling the studio store and Worker API.
  - [ ] Enforce consent gate in copilot: agent calls produce non-mutating proposals only; UI renders human approval action cards.
  - [ ] Fallback banner when neither WebMCP nor AI copilot key is present.

---

### [HSK-31] Enterprise Studio UX: BOM, NKBA Checks & Consent Gates

- **Issue**: #31
- **Branch**: `hsk-25-enterprise-studio-ux`
- **Type**: Story / UX & Design
- **Priority**: P1 (High)
- **Status**: `PLANNED`
- **Assignee**: Senior UX Engineer
- **Tasks**:
  - [ ] Bill of Materials (BOM) interactive summary panel with unit costs, item counts, SKUs, and remaining budget tracker.
  - [ ] Real-time NKBA layout findings overlay (blocked errors, warnings, info badges) with citations.
  - [ ] Proposal review card with exact operation diffs, SHA-256 hash preview, and human Approve/Reject controls.
  - [ ] Protected action confirmation modal (`<dialog>`) generating single-use proof tokens.
  - [ ] Tamper-evident decision receipt export (JSON download and print-ready summary view).
  - [ ] High-resolution 3D canvas snapshot capture (`.toDataURL('image/png')`) for client design presentations.

---

### [HSK-32] Vercel Deployment Automation & Full-Stack Verification

- **Issue**: #32
- **Branch**: `hsk-26-vercel-deploy-verification`
- **Type**: Task / DevOps & QA
- **Priority**: P0 (Highest)
- **Status**: `PLANNED`
- **Assignee**: Infra Expert & Senior QA
- **Tasks**:
  - [ ] Create `vercel.json` with build commands, output directory, and API rewrites.
  - [ ] Update `.github/workflows/ci.yml` to test both Next.js build (`pnpm --filter web build`) and Cloudflare Worker.
  - [ ] Configure environment variables (`NEXT_PUBLIC_CLOUDFLARE_WORKER_URL`, `NEXT_PUBLIC_CONTRACT_VERSION`).
  - [ ] Run Playwright E2E browser test suite against Next.js studio (verifying 2D canvas, 3D WebGL context, proposal flow, and receipt export).
  - [ ] Prepare Vercel project linking guide and manual release checklist for Ehab.
