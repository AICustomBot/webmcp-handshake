# Session runtime

HSK-03 implements the same-origin Worker router and one Durable Object per
synthetic design session. D1, KV and R2 remain excluded.

## Boundary

Static assets continue through `ASSETS`. Only `/api/v1/*` enters the governed
router. Request bodies are checked against the 32 KiB hard limit using their
actual bytes; `Content-Length` is only an early rejection.

`POST /api/v1/sessions` creates a random session ID and a 256-bit capability.
All later session requests require that capability in
`x-handshake-capability`. The Durable Object also verifies that the session in
the route equals the session stored inside it. A capability for one session
therefore cannot address another.

Capabilities are demo-session isolation, not user authentication. Production
identity is explicitly outside this hackathon scope.

## Atomicity

Cloudflare serializes requests to one Durable Object. Every proposal, decision,
apply and direct edit reads and writes the one `session` storage record inside
that object. Expected-version checks happen immediately before mutation.

Proposal application revalidates status, expiry, version and all three hashes.
The state reducer increments committed version exactly once. A retry with the
same idempotency key and payload returns the stored result; changing the payload
under that key returns `IDEMPOTENCY_CONFLICT`.

## Human and agent routes

The outer router assigns actor authority from the selected route, never from a
body field. Agent tools expose state, proposal and apply routes. Approval and
direct-edit routes are not registered as WebMCP tools and are invoked only by
the page UI.

The demo does not claim strong browser-user authentication. Its guarantee is
that model text and tool input cannot select a human-only operation.

## Cleanup

Initialization sets an alarm for the 24-hour session expiry. The alarm deletes
expired session storage. Before expiry, it marks live proposals expired and
reschedules for session cleanup.

## Failure posture

Unknown routes, malformed JSON, oversized bodies, missing proposals, stale
versions, wrong capabilities, cross-session routing and hash mismatches all
return stable fail-closed errors. No failure path silently retries a mutation.
