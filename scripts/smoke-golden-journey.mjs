/**
 * Golden journey smoke test against a locally running `wrangler dev` instance.
 * Usage: npx wrangler dev --port 8787 --local   then   node scripts/smoke-golden-journey.mjs
 * Requires 14 assertions over real HTTP: reads, proposal non-mutation, human-only approval,
 * apply, manual edit visibility, clearance heuristics, protected confirmation gate and receipt.
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:8787';
let step = 0;
const ok = [];
function assert(cond, label) {
  if (!cond) throw new Error(`FAIL at step ${step}: ${label}`);
  ok.push(label);
  console.log(`  ✓ ${label}`);
}

const create = await (await fetch(`${BASE}/api/v1/sessions`, { method: 'POST' })).json();
assert(
  create.ok === true && create.data.capability?.length === 32,
  'create session (capability 32-hex, room v1)',
);
const { sessionId: S, capability: C } = create.data;
const H = { 'X-Handshake-Capability': C, 'Content-Type': 'application/json' };
const HUMAN = {
  ...H,
  'X-Handshake-Intent': 'human',
  Origin: BASE,
  'Sec-Fetch-Site': 'same-origin',
};

const room0 = await (await fetch(`${BASE}/api/v1/sessions/${S}/room`, { headers: H })).json();
assert(
  room0.ok && room0.data.room.version === 1 && Array.isArray(room0.data.checks),
  'GET /room (v1, checks array)',
);

const matte = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/catalog?q=matte`, { headers: H })
).json();
assert(
  matte.ok && matte.data.products.length >= 2,
  `GET /catalog?q=matte (${matte.data.products.length} products)`,
);

const prop = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/proposals`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      operations: [{ type: 'place', productId: 'vanity-60-double', x: 40, y: 40, rotation: 0 }],
    }),
  })
).json();
assert(
  prop.ok && prop.data.proposal.status === 'pending_human' && prop.data.proposal.hash.length === 64,
  'POST /proposals (pending_human, canonical hash)',
);
const roomAfterPropose = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/room`, { headers: H })
).json();
assert(
  roomAfterPropose.data.room.version === 1 && roomAfterPropose.data.room.items.length === 0,
  'proposal did NOT mutate committed room (still v1, 0 items)',
);

const noIntent = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/proposals/${prop.data.proposal.id}/decision`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ decision: 'approve', expectedHash: prop.data.proposal.hash }),
  })
).json();
assert(
  noIntent.ok === false && noIntent.error.code === 'ORIGIN_DENIED',
  'agent cannot approve (no human intent → ORIGIN_DENIED)',
);

const dec = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/proposals/${prop.data.proposal.id}/decision`, {
    method: 'POST',
    headers: HUMAN,
    body: JSON.stringify({ decision: 'approve', expectedHash: prop.data.proposal.hash }),
  })
).json();
assert(
  dec.ok && dec.data.proposal.status === 'approved' && dec.data.proposal.decidedBy === 'human',
  'human approve (records decidedBy=human)',
);

const app = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/proposals/${prop.data.proposal.id}/apply`, {
    method: 'POST',
    headers: H,
    body: '{}',
  })
).json();
assert(
  app.ok && app.data.room.version === 2 && app.data.room.items.length === 1,
  'apply approved proposal (v2, 1 item)',
);

const itemId = app.data.room.items[0].id;
const manual = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/manual`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ op: { type: 'move', itemId, x: 30, y: 44, rotation: 0 } }),
  })
).json();
assert(
  manual.ok && manual.data.room.version === 3 && manual.data.room.items[0].x === 30,
  'manual edit committed (v3, position visible)',
);

const checks = await (await fetch(`${BASE}/api/v1/sessions/${S}/room`, { headers: H })).json();
assert(
  checks.ok && checks.data.checks.some((c) => c.code === 'front_clearance'),
  `clearance heuristic ran (${checks.data.checks.map((c) => `${c.code}:${c.status}`).join(', ')})`,
);

const book = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/protected`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      action: 'book_showroom_visit',
      payload: { showroom: 'Cairo', day: '2026-09-05' },
    }),
  })
).json();
assert(
  book.ok === false &&
    book.error.code === 'CONFIRMATION_REQUIRED' &&
    !!book.error.data?.confirmationId,
  'protected booking gated (CONFIRMATION_REQUIRED + confirmation id)',
);

const conf = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/protected/confirm`, {
    method: 'POST',
    headers: HUMAN,
    body: JSON.stringify({
      confirmationId: book.error.data.confirmationId,
      actionDigest: book.error.data.actionDigest,
    }),
  })
).json();
assert(conf.ok && conf.data.token.length === 64, 'human confirm (single-use token issued)');

const complete = await (
  await fetch(`${BASE}/api/v1/sessions/${S}/protected`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      action: 'book_showroom_visit',
      payload: { showroom: 'Cairo', day: '2026-09-05' },
      confirmationId: book.error.data.confirmationId,
      token: conf.data.token,
    }),
  })
).json();
assert(
  complete.ok &&
    complete.data.status === 'completed' &&
    complete.data.referenceId.startsWith('ref-'),
  `protected action completed (${complete.data?.referenceId})`,
);

const receipt = await (await fetch(`${BASE}/api/v1/sessions/${S}/receipt`, { headers: H })).json();
assert(
  receipt.ok &&
    receipt.data.receipt.room.version === 3 &&
    receipt.data.receipt.auditTypes.some((t) => t.type === 'protected_action_completed'),
  'evidence receipt (v3 room, audit summary)',
);

const auditTypes = receipt.data.receipt.auditTypes.map((t) => `${t.type}×${t.count}`).join(', ');
console.log('\nAUDIT TRAIL:', auditTypes);
console.log(`\nGOLDEN JOURNEY PASSED END-TO-END OVER LIVE HTTP: ${ok.length} assertions`);
