# Threat model, privacy and audit policy

## Protected assets
Committed design state, human decisions, session capability, proposal integrity, protected-action confirmations, audit receipts, availability, and truthful public claims.

## Primary threats and controls
- Agent self-approval: no agent-facing approval tool; UI-origin decision endpoint with current proposal/hash binding.
- Forged UI event: same-origin checks, session capability, anti-replay token, state/version validation.
- Stale proposal overwrite: expected-version precondition and atomic DO transition.
- Replay/double apply: idempotency ledger and terminal proposal state.
- Prompt/DOM injection: page/catalog text treated as data; tool schemas and deterministic policy are authoritative.
- Cross-session access: random IDs plus unguessable session capability; no list-all endpoint.
- Oversized/malformed input: strict schema, body and operation-count limits.
- Receipt leakage: synthetic-only data; allowlisted fields; no hidden prompts/reasoning.
- Misleading code-compliance claim: demo clearance wording and persistent disclaimer.
- Denial of service: per-session/IP best-effort limits, operation bounds, DO alarms and retention.

## Retention
Synthetic session expires after 24 hours by alarm. No analytics cookies or third-party trackers in MVP. Logs contain route, safe reason code, latency, request ID and opaque session hash only.
