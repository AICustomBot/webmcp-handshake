/**
 * Golden journey smoke test against a live Worker instance (local wrangler dev or production).
 * Usage:
 *   Local:      node scripts/smoke-golden-journey.mjs
 *   Production: SMOKE_BASE=https://handshake.example.workers.dev node scripts/smoke-golden-journey.mjs
 *
 * Verifies all 8 WebMCP-governed workflows + health + boundaries over real HTTP.
 */

const BASE = (process.env.SMOKE_BASE ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
let step = 0;
const passed = [];

/**
 * Asserts a boolean condition, records step progress, and aborts with a diagnostic error on failure.
 * @param {boolean} condition - Boolean condition to assert.
 * @param {string} message - Descriptive label for the assertion.
 */
function assert(condition, message) {
  step += 1;
  if (!condition) {
    console.error(`\n❌ FAIL [Step ${step}]: ${message}`);
    throw new Error(`Smoke assertion failed: ${message}`);
  }
  passed.push(message);
  console.log(`  ✓ [Step ${step}] ${message}`);
}

console.log(`\n🚀 Starting Handshake Golden Journey Smoke Test on: ${BASE}\n`);

// 1. Health check - GET /healthz
const healthRes = await fetch(`${BASE}/healthz`);
assert(healthRes.status === 200, 'GET /healthz returns status 200');
const healthData = await healthRes.json();
assert(
  healthData.ok === true &&
    healthData.service === 'handshake' &&
    typeof healthData.contractVersion === 'string',
  `Health endpoint returns valid liveness metadata (version: ${healthData.contractVersion})`,
);

// 2. Health check rejection - POST /healthz
const healthPostRes = await fetch(`${BASE}/healthz`, { method: 'POST', body: '{}' });
assert(healthPostRes.status === 405, 'POST /healthz returns 405 Method Not Allowed');
assert(healthPostRes.headers.get('allow') === 'GET', 'POST /healthz returns Allow: GET');

// 3. Static assets served
const indexRes = await fetch(`${BASE}/`);
assert(indexRes.status === 200, 'GET / returns studio index HTML');
const indexHtml = await indexRes.text();
assert(
  indexHtml.includes('Handshake') && indexHtml.includes('room-canvas'),
  'Index contains studio DOM',
);

const appJsRes = await fetch(`${BASE}/app.js`);
assert(appJsRes.status === 200, 'GET /app.js returns 200');

const webmcpJsRes = await fetch(`${BASE}/webmcp.js`);
assert(webmcpJsRes.status === 200, 'GET /webmcp.js returns 200');

// 4. Create session
const sessionRes = await fetch(`${BASE}/api/v1/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ widthIn: 108, lengthIn: 132, budgetCents: 1400000 }),
});
assert(sessionRes.status === 201, 'POST /api/v1/sessions returns 201 Created');
const sessionData = await sessionRes.json();
assert(sessionData.ok === true, 'Session response ok is true');
const { sessionId, capability } = sessionData.data;
assert(typeof sessionId === 'string' && sessionId.length > 0, 'Session has valid sessionId');
assert(
  typeof capability === 'string' && capability.length === 64,
  'Capability is 64-character hex',
);

const authHeaders = {
  'content-type': 'application/json',
  'x-handshake-capability': capability,
};

// 5. Unauthorized access check (missing / bad capability)
const unauthRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/state`, {
  headers: { 'x-handshake-capability': 'invalid-capability-000000000000000000000000' },
});
assert(unauthRes.status === 403, 'Bad capability rejected with 403 Forbidden');
const unauthData = await unauthRes.json();
assert(unauthData.error?.code === 'FORBIDDEN_ACTOR', 'Error code is FORBIDDEN_ACTOR');

// 6. Initial room state check
const stateRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/state`, {
  headers: authHeaders,
});
assert(stateRes.status === 200, 'GET state returns 200 OK');
const stateData = await stateRes.json();
assert(stateData.ok === true, 'State payload ok is true');
assert(stateData.data.state.version === 0, 'Initial room state has version 0');
assert(stateData.data.state.items.length === 0, 'Initial room has 0 items');
assert(stateData.data.evaluation.overBudget === false, 'Initial state is within budget');

// 7. Create proposal
const propIdemKey = `idem-prop-${Date.now()}`;
const propRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/proposals`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    expectedVersion: 0,
    operations: [
      {
        type: 'place',
        productId: 'harbor-vanity',
        x: 24,
        y: 24,
        rotation: 0,
      },
    ],
    rationale: 'Propose accessible vanity near water supply',
    idempotencyKey: propIdemKey,
  }),
});
assert(propRes.status === 201, 'POST /proposals returns 201 Created');
const propData = await propRes.json();
assert(propData.ok === true, 'Proposal created ok is true');
const proposal = propData.data.proposal;
assert(proposal.status === 'pending_human', 'Proposal status is pending_human');
assert(
  typeof proposal.hash === 'string' && proposal.hash.length === 64,
  'Proposal has 64-char SHA256 hash',
);
assert(proposal.baseVersion === 0, 'Proposal baseVersion is 0');

// 8. CRITICAL: Proposal must NOT mutate room state
const checkStateAfterProp = await fetch(`${BASE}/api/v1/sessions/${sessionId}/state`, {
  headers: authHeaders,
});
const stateAfterPropData = await checkStateAfterProp.json();
assert(
  stateAfterPropData.data.state.version === 0 && stateAfterPropData.data.state.items.length === 0,
  'Proposal did NOT mutate committed room state (version is still 0, items 0)',
);

// 9. Tampered hash decision rejected
const tamperedDecisionRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/decisions`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    proposalId: proposal.id,
    proposalHash: '0000000000000000000000000000000000000000000000000000000000000000',
    outcome: 'approve',
  }),
});
assert(tamperedDecisionRes.status === 400, 'Decision with mismatched hash returns 400 Bad Request');
const tamperedData = await tamperedDecisionRes.json();
assert(
  tamperedData.error?.code === 'PROPOSAL_HASH_MISMATCH',
  'Error code is PROPOSAL_HASH_MISMATCH',
);

// 10. Cross-session unauthorized decision rejection
const outsiderSessionRes = await fetch(`${BASE}/api/v1/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ widthIn: 108, lengthIn: 132, budgetCents: 1400000 }),
});
const outsiderSessionData = await outsiderSessionRes.json();
const outsiderApproveRes = await fetch(
  `${BASE}/api/v1/sessions/${outsiderSessionData.data.sessionId}/decisions`,
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-handshake-capability': outsiderSessionData.data.capability,
    },
    body: JSON.stringify({
      proposalId: proposal.id,
      proposalHash: proposal.hash,
      outcome: 'approve',
    }),
  },
);
assert(
  outsiderApproveRes.status === 404 || outsiderApproveRes.status === 403,
  'Outsider session cannot decide a proposal belonging to another session',
);

// 11. Human UI approval
const approveRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/decisions`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    proposalId: proposal.id,
    proposalHash: proposal.hash,
    outcome: 'approve',
  }),
});
assert(approveRes.status === 200, 'Approval with exact hash returns 200 OK');
const approveData = await approveRes.json();
assert(approveData.ok === true, 'Approval succeeded');
assert(approveData.data.proposal.status === 'approved', 'Proposal status transitioned to approved');

// 12. Approval did NOT mutate committed room state
const checkStateAfterApprove = await fetch(`${BASE}/api/v1/sessions/${sessionId}/state`, {
  headers: authHeaders,
});
const stateAfterApproveData = await checkStateAfterApprove.json();
assert(
  stateAfterApproveData.data.state.version === 0 &&
    stateAfterApproveData.data.state.items.length === 0,
  'Approval did NOT mutate committed room state (version is still 0, items 0)',
);

// 13. Apply approved proposal
const applyIdemKey = `idem-apply-${Date.now()}`;
const applyRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/apply`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    proposalId: proposal.id,
    proposalHash: proposal.hash,
    expectedVersion: 0,
    idempotencyKey: applyIdemKey,
  }),
});
assert(applyRes.status === 200, 'POST /apply returns 200 OK');
const applyData = await applyRes.json();
assert(applyData.ok === true, 'Apply succeeded');
assert(applyData.data.state.version === 1, 'Room version incremented to 1');
assert(applyData.data.state.items.length === 1, 'Committed items count is 1');
const committedItem = applyData.data.state.items[0];
assert(committedItem.productId === 'harbor-vanity', 'Placed item is harbor-vanity');

// 14. Replay of apply with stale version / applied proposal fails closed
const replayApplyRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/apply`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    proposalId: proposal.id,
    proposalHash: proposal.hash,
    expectedVersion: 0,
    idempotencyKey: `idem-apply-stale-${Date.now()}`,
  }),
});
assert(!replayApplyRes.ok, 'Applying already-applied proposal fails closed');

// 15. Manual edit via human UI route
const editRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/edits`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    expectedVersion: 1,
    operations: [
      {
        type: 'move',
        itemId: committedItem.id,
        x: 30,
        y: 30,
        rotation: 0,
      },
    ],
  }),
});
assert(editRes.status === 200, 'POST /edits returns 200 OK');
const editData = await editRes.json();
assert(editData.ok === true, 'Manual edit succeeded');
assert(editData.data.state.version === 2, 'Room version incremented to 2');
assert(editData.data.state.items[0].x === 30, 'Manual position updated to x: 30');

// 16. Post-edit clearance and design evaluation
const stateAfterEditRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/state`, {
  headers: authHeaders,
});
const stateAfterEditData = await stateAfterEditRes.json();
assert(stateAfterEditData.ok === true, 'GET state after edit returns ok');
assert(
  stateAfterEditData.data.evaluation.committedCents === 248000,
  'Post-edit evaluation reflects committed item pricing ($2,480.00)',
);
assert(
  Array.isArray(stateAfterEditData.data.evaluation.findings),
  'Post-edit evaluation returns clearance and layout findings array',
);

// 17. Protected action without confirmation fails closed
const protectedActionInput = {
  action: 'book_consultation',
  payload: { day: '2026-09-05', showroom: 'Cairo' },
  idempotencyKey: `idem-action-${Date.now()}`,
};
const protectedBlockedRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/protected-actions`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify(protectedActionInput),
});
assert(protectedBlockedRes.status === 400, 'Unconfirmed protected action returns 400');
const protectedBlockedData = await protectedBlockedRes.json();
assert(
  protectedBlockedData.error?.code === 'CONFIRMATION_REQUIRED',
  'Error code is CONFIRMATION_REQUIRED',
);

// 18. Human UI confirmation grant
const confirmRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/confirmations`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    action: protectedActionInput.action,
    payload: protectedActionInput.payload,
  }),
});
assert(confirmRes.status === 201, 'POST /confirmations returns 201 Created');
const confirmData = await confirmRes.json();
assert(confirmData.ok === true, 'Confirmation granted ok is true');
const { confirmation: confRecord, proof } = confirmData.data;
assert(typeof confRecord.id === 'string', 'Confirmation record has id');
assert(typeof proof === 'string' && proof.length > 0, 'Single-use proof token issued');

// 19. Protected action execution with proof
const protectedPerformRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/protected-actions`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    ...protectedActionInput,
    confirmationId: confRecord.id,
    proof,
  }),
});
assert(protectedPerformRes.status === 200, 'Protected action with proof returns 200 OK');
const protectedPerformData = await protectedPerformRes.json();
assert(protectedPerformData.ok === true, 'Protected action completed successfully');
assert(
  typeof protectedPerformData.data.reference === 'string' &&
    protectedPerformData.data.reference.startsWith('SYN-'),
  `Synthetic reference issued (${protectedPerformData.data.reference})`,
);

// 20. Consumed proof cannot be replayed
const replayProofRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/protected-actions`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    ...protectedActionInput,
    idempotencyKey: `idem-action-replay-${Date.now()}`,
    confirmationId: confRecord.id,
    proof,
  }),
});
assert(replayProofRes.status === 400, 'Replayed consumed proof returns 400 Bad Request');
const replayProofData = await replayProofRes.json();
assert(
  replayProofData.error?.code === 'CONFIRMATION_REQUIRED',
  'Reused proof rejected with CONFIRMATION_REQUIRED',
);

// 21. Export decision receipt
const receiptRes = await fetch(`${BASE}/api/v1/sessions/${sessionId}/receipt`, {
  headers: authHeaders,
});
assert(receiptRes.status === 200, 'GET /receipt returns 200 OK');
const receiptData = await receiptRes.json();
assert(receiptData.ok === true, 'Receipt ok is true');
const receipt = receiptData.data.receipt;
assert(receipt.finalVersion === 2, 'Receipt finalVersion matches committed state (v2)');
assert(Array.isArray(receipt.events) && receipt.events.length > 0, 'Receipt contains audit events');

// 22. Privacy & security validation on exported receipt
const receiptString = JSON.stringify(receipt);
assert(!receiptString.includes(capability), 'Receipt does NOT contain session capability secret');
assert(!receiptString.includes(proof), 'Receipt does NOT contain proof tokens');

console.log(`\n🎉 ALL ${passed.length} SMOKE ASSERTIONS PASSED END-TO-END!`);
console.log(`Audited Events: ${receipt.events.map((e) => e.type).join(' → ')}\n`);
