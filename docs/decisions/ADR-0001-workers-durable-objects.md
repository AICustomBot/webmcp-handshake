# ADR-0001: Cloudflare Worker and Durable Object

Accepted. One Worker serves assets and API; one Durable Object owns each session. This minimizes infrastructure and provides ordered atomic state. D1, KV and R2 are excluded.
