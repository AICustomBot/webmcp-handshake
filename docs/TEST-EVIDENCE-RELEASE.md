# Test, evidence, CI/CD and release plan

## Test layers
- Unit: geometry, budget, hashes, expiry, policy, state transitions.
- Contract: every tool input/output and stable error.
- Integration: Worker and Durable Object routing, atomic versioning, idempotency and cleanup.
- E2E: manual edit, agent proposal, approve/reject/apply, clearance warning, protected booking and receipt.
- Security: self-approval, replay, stale version, cross-session, malformed input, XSS strings and receipt leakage.
- Accessibility: automated checks plus manual keyboard, focus, zoom and screen-reader smoke.
- Compatibility: ChatGPT in-app browser and Chrome WebMCP testing flag.

## Golden oracle
9x11 bathroom, $14,000 limit, matte-black preference, simplified accessibility goal. Fixture defines products, initial state, agent proposals, one rejected choice, one manual move causing a clearance warning, protected booking confirmation, and expected receipt events.

## CI gates
Format, typecheck, unit/contract/integration tests, coverage threshold, static security checks, dependency audit, secret scan, license check, Worker dry-run build, browser golden flow, and documentation-link validation.

## Evidence manifest
Every claim maps to requirement ID, test ID, commit, environment, timestamp, artifact and reviewer. Planned, Implemented, Tested, and Demonstrated are distinct states.

## Release gates
1. Foundation green.
2. WebMCP tools verified in a supported browser.
3. Consent and replay tests green.
4. Golden demo under 90 seconds with no manual repair.
5. Public Worker URL and rollback recorded.
6. Repository made public with Apache-2.0 visible.
7. Public video under three minutes checked with audio.
8. Ehab reviews exact commit, URL, video, claims and Devpost fields.
