# Two-phase consent protocol

A model can propose. Only an explicit human interaction in the current page session can approve a protected transition. Applying and approving are separate.

States: `PENDING_HUMAN → APPROVED → APPLIED`; terminal alternatives are `REJECTED`, `EXPIRED`, `SUPERSEDED`, `INVALIDATED`.

Approval records exact proposal hash and base version. Apply atomically revalidates hash, expiry, state, version and idempotency. Booking/quote use a separate five-minute, single-use confirmation bound to exact action payload. Any committed edit increments version and supersedes stale proposals.
