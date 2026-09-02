# Consent protocol

This document explains the guarantee Handshake makes. The enforcing code is
`packages/policy/src/index.ts`, and every claim below has a test in
`tests/policy.test.ts` or `tests/consent.test.ts`.

## The guarantee

An agent can look, and it can ask. It cannot commit, and it cannot approve its
own request. Nothing an agent says, and nothing written into the page, can
change that.

## Why authorization comes from the channel

A human decision is recognised because it arrived on a human-only endpoint
from the page UI. It is never recognised because a request said
`actor: "human"`, because a field was named `approved`, or because model text
claimed the user had agreed. Text is data. Only the channel is authority.

This is what makes the demo hostile-input safe: an instruction hidden in a
product description or a room note is read as content, and cannot escalate.

## The lifecycle

A proposal is created `pending_human`. The human approves or rejects it. Only
an `approved` proposal can be applied, and applying it moves it to `applied`.

The terminal statuses are `rejected`, `applied`, `expired`, `superseded` and
`invalidated`. Nothing leaves a terminal status.

## The four gates on the mutating path

Every gate is checked immediately before the write, inside the single
Durable Object that owns the session, so state cannot shift underneath a
decision:

1. **Approval.** Status must be exactly `approved`. Anything else returns the
   code that names the real reason, so an operator can tell a replay from a
   missing approval.
2. **Freshness.** The ten-minute window must not have closed. An unparseable
   timestamp counts as expired.
3. **Version.** The proposal's `baseVersion` must equal the committed version.
   A stale proposal is refused, never quietly rebased onto newer state.
4. **Identity.** The `proposalHash` presented at apply time must equal the
   hash the human approved.

## Why the hash exists

The hash covers the contract version, the session, the base version and the
exact operation list, over canonical JSON with sorted keys. Reordering fields
cannot change it.

Without it, an approval would authorize a proposal identifier. With it, an
approval authorizes specific work. Swapping the contents of an approved
proposal fails with `PROPOSAL_HASH_MISMATCH`.

## Superseding rather than rebasing

When the human edits the room directly, every live proposal computed against
the old version becomes `superseded`. The agent is told the world moved and
must look again. This is deliberately less convenient than rebasing, because
rebasing would apply work to a room the human never reviewed.

## Protected actions

Booking a consultation and requesting a quote reach outside the design canvas,
so proposal approval is not enough. Each needs a separate confirmation that is
single-use, five-minute, bound to that action, and bound to the hash of the
exact payload the human saw.

A missing, mismatched, consumed or expired confirmation denies. There is no
path in which the absence of evidence is read as consent.

## Replay

Mutating calls carry an idempotency key. The same key with the same payload
returns the original result. The same key with a different payload returns
`IDEMPOTENCY_CONFLICT`. A retried network call is safe; a rewritten one is
not.

## What this protocol does not claim

It is not identity, authentication or authorization infrastructure, and
sessions are unauthenticated demo sessions. Layout findings express the
product's own demonstration preferences. They are not building-code or
accessibility compliance, and the data is entirely synthetic.
