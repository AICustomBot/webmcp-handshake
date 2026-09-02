# System architecture and Cloudflare topology

Cloudflare Worker serves static assets and same-origin `/api/v1`. One `DesignSession` Durable Object per random synthetic session owns the authoritative room snapshot, monotonic version, proposals, protected-action confirmations, idempotency ledger and append-only audit events. Deterministic policy owns geometry, budget and authorization. D1, KV and R2 are excluded from MVP.

## Trust boundaries

Agent/model input is untrusted. Browser UI may request but not forge authorization. Worker validates schema, size, origin strategy, capability, expected version and idempotency. The Durable Object is the transition authority. Clearance checks are demonstration heuristics, never code or professional approval.
