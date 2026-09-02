# HSK-06 protected-action evidence

Handshake keeps approval and confirmation page-owned. The agent tool can request a synthetic protected action, but cannot issue its own confirmation.

## Guarantees

- Confirmation proofs use 256 bits of server-generated randomness.
- Each proof is bound to one session, protected action, and canonical payload hash.
- Proofs expire after five minutes and are consumed with an atomic compare-and-set before execution.
- Successful protected actions are idempotent and return synthetic references only.
- Receipts are generated from authoritative Durable Object state and deterministic catalog evaluation.
- Public receipts exclude session capabilities, secret proofs, personal data, and hidden model reasoning.
- Audit events are bounded by the frozen contract limit.
- Sessions created before the evidence schema are normalized and persisted before protected routes execute.

## Page-owned confirmation

The frozen `request_protected_action` tool schema does not accept proof material. When an exact action first needs consent, the page opens a modal that displays the exact action and JSON payload. A human confirmation issues a short-lived proof through the page-only route. The proof remains in page memory and is injected only into the next matching tool retry; cancel or Escape grants nothing.

## Protected actions

- `book_consultation`
- `request_quote`

Both actions are synthetic demonstrations. No real appointment, purchase, quote, or external side effect occurs.

## Receipt export

The page downloads the allowlisted receipt as JSON and revokes its temporary blob URL after the download begins.

## Verification

The automated suite covers exact matching, action/payload/session mismatch, missing proof, expiration, replay, concurrent consumption, audit versioning, and proof redaction. Repository CI also runs formatting, TypeScript checks, 62 unit tests, and a Wrangler dry run.
