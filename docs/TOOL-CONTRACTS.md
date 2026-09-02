# Tool contracts

Frozen at contract version `1.0.0`. Authority follows
`docs/IMPLEMENTATION-DECISIONS.md`, then `packages/contracts/src/index.ts`, then
the deterministic policy engine, then documentation, then the UI. If this
document conflicts with a higher-authority source, this document is the defect.

All data is synthetic. Nothing here represents real pricing, real availability
or real regulatory requirements.

## The shape of every response

Every tool returns a `ToolResult`. Success carries `ok: true`, a `requestId`
and `data`. Failure carries `ok: false`, a `requestId` and an `error` with a
stable `code`, a human-readable `message` and a `retryable` flag.

Only `RATE_LIMITED` is retryable. A consent failure is never retryable,
because retrying it is precisely the behaviour the product refuses.

## Agent-callable tools

- `get_room_state` — returns committed state and the current evaluation. Read
  only. The `version` in the response is the value the agent must echo back.
- `search_catalog` — filters the synthetic catalog. Read only.
- `evaluate_design` — returns deterministic cost and layout findings for
  committed state. The agent never computes these numbers itself.
- `propose_changes` — records up to twelve operations against a named
  `expectedVersion`. Creates a proposal in `pending_human`. Changes nothing.
- `get_proposal` — returns one proposal and its status.
- `apply_approved_proposal` — the only mutating tool. Requires the proposal to
  be `approved`, unexpired, computed against the current version, and matched
  by `proposalHash`.
- `request_protected_action` — booking or quote. Returns
  `CONFIRMATION_REQUIRED` unless a fresh, unconsumed confirmation exists for
  this exact action and payload.
- `get_receipt` — returns the exportable proof of what was decided and when.

## Endpoints no agent can reach

These are authorized by the request channel, not by any parameter an agent
could set:

- `POST /api/v1/sessions/:sessionId/edits` — direct human editing.
- `POST /api/v1/sessions/:sessionId/decisions` — approve or reject.
- `POST /api/v1/sessions/:sessionId/confirmations` — issue a confirmation.

There is no agent tool that approves, confirms, or edits committed state
directly. That absence is the product.

## Error codes

`INVALID_INPUT`, `LIMIT_EXCEEDED`, `SESSION_NOT_FOUND`,
`PROPOSAL_NOT_FOUND`, `VERSION_CONFLICT`, `PROPOSAL_EXPIRED`,
`PROPOSAL_NOT_APPROVED`, `PROPOSAL_REJECTED`, `PROPOSAL_SUPERSEDED`,
`PROPOSAL_INVALIDATED`, `PROPOSAL_ALREADY_DECIDED`,
`PROPOSAL_ALREADY_APPLIED`, `PROPOSAL_HASH_MISMATCH`,
`IDEMPOTENCY_CONFLICT`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_EXPIRED`,
`FORBIDDEN_ACTOR`, `POLICY_BLOCKED`, `RATE_LIMITED`, `NOT_IMPLEMENTED`.

Nine codes were added during HSK-02 to make the surface complete:
`SESSION_NOT_FOUND`, `PROPOSAL_NOT_FOUND`, `PROPOSAL_INVALIDATED`,
`PROPOSAL_ALREADY_DECIDED`, `PROPOSAL_ALREADY_APPLIED`,
`PROPOSAL_HASH_MISMATCH`, `LIMIT_EXCEEDED`, `FORBIDDEN_ACTOR` and
`RATE_LIMITED`. The original set in `docs/IMPLEMENTATION-DECISIONS.md` could
not distinguish invalidation, a replayed apply or an unapproved proposal,
which are cases the demo must explain precisely.

A shipped code is never reworded or repurposed. New conditions get new codes.

## Evaluation finding codes

The evaluation response uses a separate closed union:
`UNKNOWN_PRODUCT`, `OUT_OF_BOUNDS`, `FIXTURE_OVERLAP`, `CLEARANCE_WARNING` and
`OVER_BUDGET`. Adding a finding requires updating the contract, so clients can
handle findings exhaustively.

## Limits

Twelve operations per proposal. Thirty-two kilobyte request bodies. Ten-minute
proposal lifetime. Five-minute confirmation lifetime. Twenty-four-hour
sessions. Eight live proposals and forty items per room. Every limit is
enforced on the server and fails closed.

## Idempotency

Mutating tools take an `idempotencyKey`. A repeated key with an identical
canonical payload replays the stored result. A repeated key with a different
payload returns `IDEMPOTENCY_CONFLICT` and writes nothing.
