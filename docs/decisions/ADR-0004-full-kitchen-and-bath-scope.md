# ADR-0004: Full kitchen and bath scope

- Status: Accepted
- Date: 2026-09-03
- Supersedes: nothing
- Amends: the product scope described in `docs/PRODUCT-SPEC.md`

## Context

`docs/PRODUCT-SPEC.md` and `README.md` both describe Handshake as a "Kitchen &
Bath co-design workspace". The shipped implementation was bath-only, and an
incomplete bath at that:

- `ProductCategory` contained no kitchen categories.
- The synthetic catalog held four bath products. The declared `tub` and
  `lighting` categories had zero products.
- `RoomState` modelled a bare rectangle. There were no walls, doors, windows,
  or service locations, so no rule could reason about door swings, work
  aisles, or plumbing and electrical feasibility.
- No kitchen rule existed: no work triangle, no counter landing areas, no
  appliance door interference, no corner dead zones.
- `PRODUCT-SPEC.md` promised a bill of materials and a printable summary.
  Neither existed in any layer.

The gap between the public claim and the implementation was the single largest
credibility risk in the project. Three options were considered:

- **A** — narrow the claim to bath-only and delete "kitchen" from the specs.
- **B** — a minimum credible kitchen: categories, a wall model, and one rule.
- **C** — full kitchen and bath, with a real planning-rule engine for both.

## Decision

Option **C**. Handshake models kitchens and baths as first-class room types,
and its deterministic engine encodes published planning guidelines for both.

The decision rests on the project's own premise. Handshake exists to prove that
an agent can propose a change and a human can approve it _with proof_. The
proof is only worth reviewing if the checks behind it are the checks a real
designer would apply. A rule engine that only knows "these two boxes overlap"
does not demonstrate the thesis. One that knows the work triangle is 3 inches
over the recommended maximum does.

### Guideline source and its limits

Rule thresholds are taken from the NKBA Kitchen & Bath Planning Guidelines with
Access Standards and from the IRC clearances the NKBA cites. They are recorded
as named constants in `packages/contracts` (`BATH_GUIDELINES`,
`KITCHEN_GUIDELINES`) so that every finding can cite the guideline it came
from, and so that a reviewer can audit a threshold without reading rule code.

These constants are **planning recommendations applied to synthetic data**.
They are not a code-compliance certification, they are not a substitute for a
local building official, and ADR-0003 still holds: no real customer, pricing,
or regulatory data enters this system. Every finding message and the receipt
must keep saying so. Where the NKBA recommendation and the IRC minimum differ,
both numbers are carried, the recommendation drives `warning` severity, and the
code minimum drives `blocked` severity.

### Room geometry stays rectangular

Rooms remain an axis-aligned rectangle of `widthIn` by `lengthIn`. Openings
(doors, windows, cased passages) attach to one of four named walls at an offset
from that wall's origin corner, and service anchors (water, drain, gas, 120V,
240V, vent) attach the same way.

Arbitrary polygons, soffits, islands with overhangs, and multi-level counters
are deliberately out of scope. A rectangle plus openings plus anchors is enough
to evaluate every guideline in this ADR, and it keeps the state small enough to
remain a single canonically hashable Durable Object value. Non-rectangular
rooms need a new ADR.

### Contract compatibility

`CONTRACT_VERSION` moves to `2.0.0` because the domain widened, but every
change is **additive**:

- No existing field was removed, renamed, or retyped.
- No existing error code, proposal status, or finding code changed meaning.
- New `RoomState` members (`roomType`, `openings`, `serviceAnchors`) are
  optional. An older stored session still loads; the engine treats a missing
  `roomType` as `bathroom` and skips every rule whose inputs were never
  modelled.
- New `DesignEvaluation` members (`roomType`, `remainingCents`, `bom`,
  `blockedCount`, `warningCount`, `guidelineSource`) are optional at 2.0.0.
  The policy engine always populates them. Tightening them to required is a
  follow-up once no producer omits them.

The engine never invents geometry it was not given. A room with no `openings`
produces no door findings. This keeps "we only check what was modelled" true,
which matters more than rule coverage: a fabricated door would be a fabricated
proof.

### Rules that fail closed, and rules that advise

Authorization still fails closed. Planning guidance does not, and must not be
confused with it:

- `blocked` findings mean the layout is physically impossible or violates a
  cited code minimum: overlapping fixtures, out of bounds, an obstructed door.
- `warning` findings mean a cited recommendation is unmet.
- `info` findings are advisory.

None of these gate approval. A human may approve a layout carrying warnings;
that is their call, and the receipt records exactly which findings stood at the
moment they approved. What the engine guarantees is that the human saw the same
findings the server computed. The front end must therefore render the server's
evaluation and never recompute a weaker one locally.

## Consequences

- The synthetic catalog grows from 4 products to a kitchen and bath set, and
  becomes server-owned and served over `GET /api/v1/catalog` so that the
  worker, the WebMCP tool layer, and the page stop holding three drifting
  copies of it.
- `Operation` gains `configure_room`, `add_opening`, `move_opening`, and
  `remove_opening`. Room shape and openings become reviewable proposals like
  any other change, rather than hardcoded constants.
- `AGENT_TOOL_NAMES` gains `get_bill_of_materials`. Consent is untouched:
  there is still no agent-callable path to approval or confirmation.
- `HTTP_STATUS_FOR_ERROR` and `ERROR_COPY` move into contracts so the worker
  stops mapping consent failures to `400` and the page stops rendering raw
  error codes at the user.
- Rule count rises, so rule code moves out of `packages/policy/src/index.ts`
  into `geometry.ts` and `guidelines.ts`. `index.ts` keeps the authorization
  gates, which are the part that must stay small enough to read in one sitting.

## Rejected alternatives

**A (bath-only)** was the cheapest honest option and was the recommendation
before this ADR. It was rejected because the kitchen work triangle is the
single most recognisable planning rule in the domain, and a co-design tool that
cannot check it is hard to take seriously as anything but a demo.

**B (minimum kitchen)** was rejected because the expensive part is the wall,
opening, and service model, not the individual rules. Once that model exists,
each further guideline is a small pure function. Stopping at one rule would pay
the whole cost for a fraction of the value.
