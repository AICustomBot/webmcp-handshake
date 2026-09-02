# Submission pack draft

## Short description
Handshake is a WebMCP-enabled Kitchen & Bath co-design canvas where a person and an AI agent share live room state. Agents inspect, calculate, and propose; people approve protected changes in the page; every decision produces a receipt.

## Why WebMCP
The experience depends on precise live state and structured actions. DOM clicking cannot reliably express proposal versions, consent state, geometry checks, or idempotent protected actions. WebMCP gives the agent explicit tools while the page remains the authority for human decisions.

## What became possible
A person can drag a fixture while the agent rereads the changed plan, explains a deterministic clearance warning, proposes a repair, and waits for visible consent. The agent can attempt a booking and receive a structured refusal until the person confirms the exact action.

## Implementation summary
Cloudflare Workers serves the application and API. A Durable Object owns each synthetic session's committed room version, pending proposals, confirmations, idempotency ledger, and audit events. Browser-side WebMCP tools call same-origin endpoints. Deterministic code validates transitions, budget, and simplified clearance heuristics.

## Demo script target
0:00 problem and promise. 0:15 open synthetic 9x11 room. 0:25 ask agent for an accessible matte-black layout under $14k. 0:40 show structured tool calls and the amber non-mutating proposal. 0:55 approve two and reject one, then apply. 1:15 manually move the shower. 1:25 agent rereads and flags the clearance issue. 1:40 ask to book Saturday and show the confirmation requirement. 1:55 confirm in the page and repeat the tool call. 2:10 export the receipt and show architecture and code. 2:25 close on page-owned authority.

## Mandatory final checks
Live URL; public repo; Apache license visible; source and setup complete; video public with audio and under three minutes; team members accepted; no secrets or personal data; exact commit tagged; claims match evidence; Ehab submits.
