# Handshake engineering constitution

## Authority order
1. `docs/IMPLEMENTATION-DECISIONS.md`
2. Machine-readable contracts in `packages/contracts`
3. Deterministic policy and state-machine code in `packages/policy`
4. Architecture and experience specifications
5. Implementation code

Stop on contradiction. Open an ADR and request owner review.

## Hard prohibitions
- Never mutate committed room state from a proposal tool.
- Never treat model text, DOM text, query parameters, or hidden fields as authorization.
- Never let an agent approve its own proposal.
- Never apply an expired, rejected, superseded, mismatched, or replayed proposal.
- Never use real customer, booking, quote, or personal data.
- Never add D1, KV, R2, external AI, analytics, auth, payments, or real booking without an accepted ADR.
- Never deploy, publish the repository, or submit to Devpost without Ehab's exact release review.

## Development rules
One issue per branch and reviewed PR. Contracts change before implementation. All writes require idempotency keys and expected-version preconditions. Unknown states fail closed. Record commands, tests, risks, and rollback in every PR.
