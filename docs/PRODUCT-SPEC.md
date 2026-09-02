# Product specification and MVP scope

## Definition

Handshake is a synthetic Kitchen & Bath co-design workspace built to demonstrate a safer agent-native web. A person and an in-browser agent operate on one live design. The agent reads authoritative page state, searches a synthetic catalog, computes deterministic checks, and proposes changes. The person alone authorizes protected transitions.

## Primary users

- Homeowner/design customer collaborating with an AI assistant.
- Showroom designer observing decisions and receiving a structured handoff.
- Judge evaluating WebMCP leverage, execution, impact, and creativity.

## Required outcome

A completed synthetic room plan with a bill of materials, budget/clearance checks, complete proposal history, explicit protected-action decisions, and a downloadable evidence receipt.

## MVP capabilities

- Create/reset one anonymous synthetic design session.
- View and manually edit room state.
- Search a fixed synthetic fixture catalog.
- Register the agreed WebMCP tool surface.
- Create non-mutating proposals with visible diffs.
- Approve/reject proposals in the page UI.
- Apply only approved proposals with version and idempotency checks.
- Deterministically calculate budget and simplified demo clearances.
- Gate synthetic booking and quote-request actions behind fresh human confirmation.
- Export a JSON receipt and printable summary.

## Explicit exclusions

Real commerce, payments, production bookings, user accounts, personal data, CRM writes, legal/code compliance determinations, photorealistic design, generative images, multi-tenant production operation, D1/KV/R2, external AI API, and autonomous background agents.

## Success criteria

- Agent completes the golden journey through structured tools, not DOM guessing.
- No proposal mutates committed state before approval.
- Agent cannot approve or bypass confirmation.
- Manual human edits are visible to subsequent tool calls.
- Expired/replayed/stale proposals fail closed with stable reason codes.
- Keyboard-only golden flow works at desktop and 390px mobile.
- Live Worker URL, public Apache-2.0 repo, and a public video under three minutes exist before submission.
