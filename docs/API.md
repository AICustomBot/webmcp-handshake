# Handshake REST API Specification

This document is the authoritative developer reference for the versioned HTTP API provided by the Handshake Cloudflare Worker and Durable Objects session runtime (`@handshake/contracts` v2.0.0).

---

## 1. Global Conventions & Protocol

### Base URL

- **Local**: `http://127.0.0.1:8787`
- **Staging / Production**: `https://<domain>`

### Headers & Authentication

- `x-handshake-capability`: A 64-character hexadecimal unguessable token issued at session creation. Required for all session-scoped routes (`/api/v1/sessions/:sessionId/*`).
- `x-request-id`: Optional client-provided UUID or worker-generated identifier echoed in every response envelope.
- `content-type`: `application/json` for all request bodies.
- `x-handshake-actor`: Inferred by the worker routing layer. Routes `decisions`, `edits`, and `confirmations` are stamped as `human_ui`; all other routes are stamped as `agent`.

### Cross-Origin Resource Sharing (CORS)

All `/api/*` endpoints emit standard CORS headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: content-type, x-handshake-capability, x-handshake-actor, x-request-id`
- `Access-Control-Max-Age: 86400`
  Preflight `OPTIONS` requests return `204 No Content`.

### Envelope Shapes

#### Success Envelope (`200 OK` / `201 Created`)

```json
{
  "ok": true,
  "requestId": "4c94f1c7-7e61-46bb-9f6b-8711469e88d1",
  "data": { ... }
}
```

#### Error Envelope (`4xx` / `5xx`)

```json
{
  "ok": false,
  "requestId": "4c94f1c7-7e61-46bb-9f6b-8711469e88d1",
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Committed state changed.",
    "retryable": false
  }
}
```

### Rate Limits

Enforced per session in Durable Object memory:

- **Total Requests**: 240 requests / minute
- **Write Operations** (`POST`, `PUT`, `DELETE`): 60 writes / minute
- When exceeded, returns HTTP `429 Too Many Requests` with error code `RATE_LIMITED`, `retryable: true`, and header `Retry-After: 5`.

---

## 2. Public Endpoints

### `GET /healthz` or `GET /api/v1/health`

Returns public liveness and contract metadata without exposing internal secrets.

**Response `200 OK`**:

```json
{
  "ok": true,
  "service": "handshake",
  "contractVersion": "2.0.0"
}
```

---

### `GET /api/v1/catalog`

Queries the synthetic 16-item Kitchen and Bathroom product catalog.

**Query Parameters**:

- `roomType` (optional): Filter products applicable to `"bathroom"` or `"kitchen"`.
- `category` (optional): Filter by category (e.g. `"vanity"`, `"shower"`, `"range"`, `"refrigerator"`).
- `maxPriceCents` (optional): Maximum unit price in integer cents.
- `accessibleOnly` (optional): `"true"` to filter only ADA/universal design compliant fixtures.

**Response `200 OK`**:

```json
{
  "ok": true,
  "requestId": "...",
  "contractVersion": "2.0.0",
  "products": [ ... ],
  "guidelineSource": "NKBA Kitchen & Bathroom Planning Guidelines (2023) + IRC 2024",
  "data": { ... }
}
```

---

## 3. Session Management

### `POST /api/v1/sessions`

Initializes a new isolated co-design session backed by a Cloudflare Durable Object.

**Request Body**:

```json
{
  "roomType": "bathroom",
  "widthIn": 108,
  "lengthIn": 132,
  "budgetCents": 1400000
}
```

**Response `201 Created`**:

```json
{
  "ok": true,
  "requestId": "...",
  "data": {
    "sessionId": "4a73db63-a2cb-4bc1-bf87-6eec4d57c790",
    "capability": "9f82ab...64-char-hex...",
    "contractVersion": "2.0.0"
  }
}
```

---

## 4. Session Operations (Capability-Protected)

All routes below require the header:
`x-handshake-capability: <capability>`

### `GET /api/v1/sessions/:id/state`

Returns the current authoritative room state and deterministic evaluation findings.

---

### `POST /api/v1/sessions/:id/proposals`

Submits a proposed set of operations. **This endpoint is strictly non-mutating**; committed room state version and items remain unchanged.

**Request Body**:

```json
{
  "idempotencyKey": "uuid",
  "expectedVersion": 0,
  "rationale": "Place Harbor vanity near plumbing anchor.",
  "operations": [
    {
      "type": "place",
      "productId": "harbor-vanity",
      "x": 12,
      "y": 12,
      "rotation": 0
    }
  ]
}
```

---

### `POST /api/v1/sessions/:id/decisions`

Records a human decision (approve or reject) for a pending proposal.
_Channel constraint: Only callable via human UI route (`x-handshake-actor: human_ui`)._

---

### `POST /api/v1/sessions/:id/apply`

Applies an exact approved proposal to committed state. Increments the room `version`.

---

### `POST /api/v1/sessions/:id/edits`

Direct human manual manipulation (move, rotate, swap, remove). Increments room `version` and supersedes any outdated proposals.
_Channel constraint: Only callable via human UI route (`x-handshake-actor: human_ui`)._

---

### `GET /api/v1/sessions/:id/bom`

Returns the itemized Bill of Materials and remaining budget balance for committed state.

---

### `POST /api/v1/sessions/:id/confirmations`

Issues a single-use proof token for a protected synthetic action.
_Channel constraint: Only callable via human UI route (`x-handshake-actor: human_ui`)._

---

### `POST /api/v1/sessions/:id/protected-actions`

Executes a protected synthetic action by redeeming a single-use proof token.

---

### `GET /api/v1/sessions/:id/receipt`

Exports the tamper-evident cryptographic session audit receipt. All sensitive capability tokens and proof tokens are redacted.

---

## 5. Stable Error Code Reference

| Error Code                 | HTTP Status | Description                                                        |
| :------------------------- | :---------: | :----------------------------------------------------------------- |
| `INVALID_INPUT`            |    `400`    | Malformed JSON, missing fields, or empty operations array.         |
| `LIMIT_EXCEEDED`           |    `413`    | Body size > 32 KiB or item count exceeds room capacity.            |
| `SESSION_NOT_FOUND`        |    `404`    | Session ID does not exist or has expired.                          |
| `PROPOSAL_NOT_FOUND`       |    `404`    | Proposal ID does not exist in session.                             |
| `VERSION_CONFLICT`         |    `409`    | Expected version precondition does not match committed version.    |
| `PROPOSAL_HASH_MISMATCH`   |    `409`    | Provided proposal hash does not match computed SHA-256 digest.     |
| `PROPOSAL_NOT_APPROVED`    |    `403`    | Attempted to apply a proposal that was not approved by human.      |
| `PROPOSAL_ALREADY_APPLIED` |    `409`    | Proposal was already committed to room state.                      |
| `IDEMPOTENCY_CONFLICT`     |    `409`    | Idempotency key reused with different request payload.             |
| `CONFIRMATION_REQUIRED`    |    `428`    | Protected action attempted without single-use proof token.         |
| `CONFIRMATION_EXPIRED`     |    `403`    | Proof token expired or was already redeemed.                       |
| `FORBIDDEN_ACTOR`          |    `403`    | Channel boundary violation (e.g. agent attempting human decision). |
| `RATE_LIMITED`             |    `429`    | Request ceiling reached (> 240 req/min or > 60 writes/min).        |
| `NOT_IMPLEMENTED`          |    `501`    | Route or method not supported.                                     |
