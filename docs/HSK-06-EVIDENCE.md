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

## Protected actions

- `book_consultation`
- `request_quote`

Both actions are synthetic demonstrations. No real appointment, purchase, quote, or external side effect occurs.

## Verification

The automated suite covers exact matching, action/payload/session mismatch, missing proof, expiration, replay, concurrent consumption, audit versioning, and proof redaction. Repository CI also runs formatting, TypeScript checks, unit tests, and a Wrangler dry run.

The final validation run is triggered only after generated integration code and temporary diagnostics have been removed from the branch.
