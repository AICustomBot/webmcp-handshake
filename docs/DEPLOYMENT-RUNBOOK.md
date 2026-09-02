# Handshake Production Deployment & Operations Runbook

## 1. Overview and Infrastructure Topology

Handshake is designed and architected as an edge-native, zero-external-dependency web application deployed to Cloudflare Workers with Durable Objects.

```text
                                  +---------------------------------------+
                                  |         Cloudflare Edge Network       |
                                  +---------------------------------------+
                                                     |
                         +---------------------------+---------------------------+
                         |                                                       |
                         v                                                       v
        +---------------------------------+                     +---------------------------------+
        |     Static Asset Binding        |                     |      Cloudflare Worker API      |
        |  (HTML, CSS, Studio JS, WebMCP) |                     |  (/healthz, /api/v1/sessions)   |
        +---------------------------------+                     +---------------------------------+
                                                                                 |
                                                                                 v
                                                                +---------------------------------+
                                                                |       Durable Object Class      |
                                                                |         `DesignSession`         |
                                                                |   - In-memory committed state   |
                                                                |   - Immutable proposal hashes   |
                                                                |   - Single-use proof tokens     |
                                                                |   - Redacted audit trail        |
                                                                +---------------------------------+
```

### Architectural Characteristics

- **Zero Database / Zero KV**: State is owned exclusively within ephemeral, session-isolated Durable Objects (`DesignSession`).
- **No External AI or Analytics**: All layout validation, budgeting, and clearance heuristics run deterministically.
- **Page-Owned Human Authority**: Browser-side human interactions own the approval and confirmation endpoints; agent tools are strictly bounded.
- **Synthetic-Only Operation**: Uses allowlisted synthetic catalog fixtures (`harbor-vanity`, `open-shower`, `compact-wc`, `linen-tower`). Real customer or personal data is strictly forbidden.

---

## 2. Prerequisites and Environment Provisioning

### Required Tooling

- Node.js `v20.18+` or `v22.0+`
- pnpm `v10.15.0+`
- Cloudflare Wrangler CLI `v4.128.0+` (bundled in devDependencies)
- Python `3.11+` with `uv` (for Playwright browser verification)
- Google Chrome browser (for local headless browser tests)

### Cloudflare Account Configuration

1. Log in to Cloudflare CLI:
   ```bash
   pnpm exec wrangler login
   ```
2. Verify authenticated account:
   ```bash
   pnpm exec wrangler whoami
   ```
3. Cloudflare Subscription Requirements:
   - **Workers Paid Plan**: Required for Durable Objects binding.
   - **Compatibility Flags**: Configured in `wrangler.jsonc` (`compatibility_date: "2026-09-01"`, flags: `["nodejs_compat"]`).

---

## 3. Pre-Flight Verification Gates

Before deploying to staging or production, all deterministic validation gates must pass locally:

```bash
# 1. Code style, type integrity, and unit/integration tests (66 tests)
pnpm check

# 2. Local background dev server smoke test (62 assertions)
# Ensure `wrangler dev` is running on port 8787
pnpm test:smoke

# 3. Headless Chrome browser and accessibility test suite (37 assertions)
pnpm test:e2e
```

All 66 unit tests, 62 smoke assertions, and 37 browser assertions must pass with **0 errors**.

---

## 4. Deployment Instructions

### Staging Deployment

Deploy to a staging preview environment:

```bash
pnpm exec wrangler deploy --env staging
```

The CLI will output the staging preview URL:
`https://handshake-staging.<your-subdomain>.workers.dev`

### Production Deployment

> [!IMPORTANT]
> In accordance with the project constitution (`AGENTS.md`), deployment to production requires Ehab's exact release review and explicit approval.

Deploy directly to the production environment:

```bash
pnpm exec wrangler deploy
```

The CLI will output the production URL:
`https://webmcp-handshake.<your-subdomain>.workers.dev`

### Custom Domain Configuration (Optional)

To bind the Worker to a custom apex domain or subdomain (e.g. `handshake.example.com`):

1. In the Cloudflare Dashboard, navigate to **Workers & Pages** > **webmcp-handshake** > **Settings** > **Domains & Routes**.
2. Click **Add Custom Domain** and enter your desired FQDN (e.g., `handshake.example.com`).
3. Ensure DNS proxy status is enabled (orange cloud) with **Full (Strict)** SSL/TLS encryption.

---

## 5. Post-Deployment Live Verification Runbook

Immediately following any deployment, execute the live verification runbook against the target deployment URL:

### 5.1 Public Liveness Probe

```bash
curl -f -i https://<DEPLOYMENT_URL>/healthz
```

Expected HTTP Response:

- HTTP Status: `200 OK`
- Headers: `content-type: application/json; charset=utf-8`
- Body:
  ```json
  {
    "ok": true,
    "service": "handshake",
    "contractVersion": "1.0.0"
  }
  ```

Test method rejection:

```bash
curl -f -i -X POST https://<DEPLOYMENT_URL>/healthz
# Expected: 405 Method Not Allowed, Allow: GET
```

### 5.2 Live HTTP Golden Journey Smoke Suite

Run the full 62-assertion HTTP smoke suite over public HTTPS against the live Durable Objects runtime:

```bash
SMOKE_BASE=https://<DEPLOYMENT_URL> pnpm test:smoke
```

**Verification Checklist**:

- [ ] Liveness probe returns 200 with contract version `1.0.0`
- [ ] Static studio DOM, `app.js`, and `webmcp.js` served
- [ ] Session creation issues 128-bit random capability secret
- [ ] Bad capability fails closed with `403 FORBIDDEN_ACTOR`
- [ ] Initial room state is version 0 with 0 items
- [ ] Proposal creation computes canonical SHA-256 hash
- [ ] Proposal does NOT mutate committed room state (v0)
- [ ] Tampered hash decision returns 400 `PROPOSAL_HASH_MISMATCH`
- [ ] Cross-session approval attempt rejected fail-closed
- [ ] Human UI approval transitions status to `approved`
- [ ] Human approval does NOT mutate room state (v0)
- [ ] Proposal apply atomically increments version to 1 with item placed
- [ ] Stale or replayed apply fails closed
- [ ] Manual edit increments room version to 2
- [ ] Clearance and design evaluation reflects new coordinates
- [ ] Protected synthetic action without confirmation returns 400 `CONFIRMATION_REQUIRED`
- [ ] Page-owned human confirmation grants single-use proof token
- [ ] Protected action execution with proof succeeds with `SYN-XXXXXXXX` reference
- [ ] Replay of consumed proof fails closed with `CONFIRMATION_REQUIRED`
- [ ] Exported decision receipt contains complete audit trail and excludes all secrets

### 5.3 Remote Browser & Accessibility Suite

Execute the headless Playwright suite against the live deployment:

```bash
E2E_BASE=https://<DEPLOYMENT_URL> pnpm test:e2e
```

**Verification Checklist**:

- [ ] Connection indicator shows `Session isolated`
- [ ] SVG room canvas renders 108 × 132 inches grid
- [ ] Fixture search and category filters work
- [ ] Proposal card displays diff and `PENDING HUMAN` badge
- [ ] Human approval and apply updates SVG canvas with placed fixture
- [ ] Accessible manual edit form commits version 2
- [ ] Protected action modal opens, displays exact action and payload, and confirms
- [ ] Decision receipt export downloads valid JSON
- [ ] WebMCP bridge registers all 8 contracted tools
- [ ] 375px mobile responsive layout renders cleanly
- [ ] Zero unhandled browser console or page errors

---

## 6. Observability, Monitoring & Operations

### Live Tail Logs

Stream live Worker and Durable Object execution logs during user sessions:

```bash
pnpm exec wrangler tail
```

Filter by status or IP if debugging specific sessions:

```bash
pnpm exec wrangler tail --status error
```

### Metrics & Alarms

In the Cloudflare Dashboard (**Analytics & Logs** > **Workers & Pages**):

- **Requests & CPU Time**: Monitor CPU time per request (standard budget: < 10ms).
- **Durable Object Invocations**: Monitor active session objects and request counts.
- **Error Rates**: 4xx responses are expected for blocked agent self-approvals, tampered hashes, and unconfirmed actions. 5xx responses must remain at 0%.

### Rollback Procedure

If any regression or defect is detected post-deployment:

1. List recent deployments:
   ```bash
   pnpm exec wrangler deployments list
   ```
2. Rollback to the previous stable deployment ID:
   ```bash
   pnpm exec wrangler rollback [DEPLOYMENT_ID]
   ```
3. Re-run health check and smoke test:
   ```bash
   curl -f https://<DEPLOYMENT_URL>/healthz
   SMOKE_BASE=https://<DEPLOYMENT_URL> pnpm test:smoke
   ```

---

## 7. Incident Response & Failure Modes

| Failure Scenario           | Manifestation                                | Root Cause / Resolution                                                                              |
| -------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Capability Mismatch**    | `403 Forbidden` (`FORBIDDEN_ACTOR`)          | Client session lost or capability corrupted. Reset session storage in browser or create new session. |
| **Tampered Proposal Hash** | `400 Bad Request` (`PROPOSAL_HASH_MISMATCH`) | Proposal payload modified in transit between creation and approval. Human UI must re-evaluate.       |
| **Version Conflict**       | `409 Conflict` (`VERSION_CONFLICT`)          | Concurrent edit or stale base version applied. Client refreshes room state and rebases proposal.     |
| **Replayed Proof Token**   | `400 Bad Request` (`CONFIRMATION_REQUIRED`)  | Single-use proof already consumed or expired. Human must re-grant confirmation.                      |
| **Cold Start / Memory**    | Durable Object evicts inactive session       | Session state in memory is reset. New session created automatically on page refresh.                 |

---

## 8. Final Release Sign-Off Gate

Per `AGENTS.md` and constitutional governance, before public release or Devpost submission:

- [ ] All 66 unit & integration tests pass (`pnpm check`)
- [ ] All 62 HTTP smoke assertions pass (`pnpm test:smoke`)
- [ ] All 37 browser & accessibility assertions pass (`pnpm test:e2e`)
- [ ] Apache-2.0 License file verified
- [ ] Zero personal, customer, or non-synthetic data verified
- [ ] Pre-flight and post-deployment runbooks tested
- [ ] Ehab's exact release review and explicit approval obtained
