const TOOL_NAMES = [
  'get_room_state',
  'search_catalog',
  'evaluate_design',
  'propose_changes',
  'get_proposal',
  'apply_approved_proposal',
  'request_protected_action',
  'get_receipt',
  'get_bill_of_materials',
];

const CATEGORY_ROOM_TYPES = {
  vanity: ['bathroom'],
  shower: ['bathroom'],
  tub: ['bathroom'],
  toilet: ['bathroom'],
  storage: ['bathroom', 'kitchen'],
  lighting: ['bathroom', 'kitchen'],
  base_cabinet: ['kitchen'],
  wall_cabinet: ['kitchen'],
  tall_cabinet: ['kitchen'],
  countertop: ['kitchen'],
  island: ['kitchen'],
  sink: ['kitchen'],
  range: ['kitchen'],
  cooktop: ['kitchen'],
  wall_oven: ['kitchen'],
  refrigerator: ['kitchen'],
  dishwasher: ['kitchen'],
  microwave: ['kitchen'],
  hood: ['kitchen'],
};

const CATALOG = [
  {
    id: 'harbor-vanity',
    name: 'Harbor vanity',
    category: 'vanity',
    finish: 'matte black',
    priceCents: 248000,
    widthIn: 36,
    depthIn: 21,
    heightIn: 34,
    clearanceIn: 30,
    accessible: true,
    sku: 'SYN-VAN-36-MB',
    mount: 'floor',
    doorSwingIn: 18,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'open-shower',
    name: 'Open-entry shower',
    category: 'shower',
    finish: 'clear glass',
    priceCents: 490000,
    widthIn: 42,
    depthIn: 42,
    heightIn: 84,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-SHW-42-CG',
    mount: 'floor',
    doorSwingIn: 0,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'compact-wc',
    name: 'Compact WC',
    category: 'toilet',
    finish: 'white',
    priceCents: 168000,
    widthIn: 20,
    depthIn: 29,
    heightIn: 30,
    clearanceIn: 30,
    accessible: false,
    sku: 'SYN-TOI-20-WH',
    mount: 'floor',
    doorSwingIn: 0,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'linen-tower',
    name: 'Linen tower',
    category: 'storage',
    finish: 'white oak',
    priceCents: 132000,
    widthIn: 18,
    depthIn: 16,
    heightIn: 72,
    clearanceIn: 24,
    accessible: true,
    sku: 'SYN-STR-18-WO',
    mount: 'floor',
    doorSwingIn: 16,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'french-door-fridge',
    name: 'Studio French-door refrigerator',
    category: 'refrigerator',
    finish: 'stainless',
    priceCents: 320000,
    widthIn: 36,
    depthIn: 32,
    heightIn: 70,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-REF-36-SS',
    mount: 'floor',
    workCenter: 'refrigerator',
    doorSwingIn: 30,
    requiresPlumbing: true,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 15,
    counterRun: false,
  },
  {
    id: 'undermount-sink',
    name: 'Undermount kitchen basin',
    category: 'sink',
    finish: 'stainless',
    priceCents: 95000,
    widthIn: 33,
    depthIn: 22,
    heightIn: 10,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-SNK-33-SS',
    mount: 'counter',
    workCenter: 'sink',
    doorSwingIn: 0,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 24,
    landingRightIn: 18,
    counterRun: true,
  },
  {
    id: 'pro-gas-range',
    name: 'Pro-style convection range',
    category: 'range',
    finish: 'stainless',
    priceCents: 280000,
    widthIn: 30,
    depthIn: 26,
    heightIn: 36,
    clearanceIn: 40,
    accessible: false,
    sku: 'SYN-RNG-30-SS',
    mount: 'floor',
    workCenter: 'cooktop',
    doorSwingIn: 24,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: true,
    landingLeftIn: 15,
    landingRightIn: 12,
    counterRun: false,
  },
  {
    id: 'quiet-dishwasher',
    name: 'Integrated quiet dishwasher',
    category: 'dishwasher',
    finish: 'panel ready',
    priceCents: 145000,
    widthIn: 24,
    depthIn: 24,
    heightIn: 34,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-DSH-24-PR',
    mount: 'floor',
    doorSwingIn: 24,
    requiresPlumbing: true,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'base-drawer-unit',
    name: 'Three-drawer base cabinet',
    category: 'base_cabinet',
    finish: 'natural walnut',
    priceCents: 85000,
    widthIn: 30,
    depthIn: 24,
    heightIn: 34.5,
    clearanceIn: 30,
    accessible: true,
    sku: 'SYN-CAB-30-NW',
    mount: 'floor',
    doorSwingIn: 21,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'upper-glass-cabinet',
    name: 'Upper glazed wall cabinet',
    category: 'wall_cabinet',
    finish: 'natural walnut',
    priceCents: 62000,
    widthIn: 30,
    depthIn: 13,
    heightIn: 30,
    clearanceIn: 0,
    accessible: false,
    sku: 'SYN-WCB-30-NW',
    mount: 'wall',
    doorSwingIn: 14,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'pantry-tall-cabinet',
    name: 'Pantry tall cabinet',
    category: 'tall_cabinet',
    finish: 'matte slate',
    priceCents: 175000,
    widthIn: 24,
    depthIn: 24,
    heightIn: 84,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-TCB-24-MS',
    mount: 'floor',
    doorSwingIn: 24,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'induction-cooktop',
    name: 'Four-zone induction cooktop',
    category: 'cooktop',
    finish: 'black ceramic',
    priceCents: 195000,
    widthIn: 30,
    depthIn: 21,
    heightIn: 4,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-CKT-30-BC',
    mount: 'counter',
    workCenter: 'cooktop',
    doorSwingIn: 0,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 15,
    landingRightIn: 12,
    counterRun: true,
  },
  {
    id: 'smart-wall-oven',
    name: 'Single convection wall oven',
    category: 'wall_oven',
    finish: 'stainless',
    priceCents: 235000,
    widthIn: 30,
    depthIn: 25,
    heightIn: 29,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-OVN-30-SS',
    mount: 'wall',
    doorSwingIn: 22,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 15,
    counterRun: false,
  },
  {
    id: 'canopy-range-hood',
    name: 'Wall-mount canopy range hood',
    category: 'hood',
    finish: 'stainless',
    priceCents: 110000,
    widthIn: 30,
    depthIn: 20,
    heightIn: 24,
    clearanceIn: 0,
    accessible: false,
    sku: 'SYN-HOD-30-SS',
    mount: 'wall',
    doorSwingIn: 0,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: true,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'prep-island',
    name: 'Kitchen prep island',
    category: 'island',
    finish: 'butcher block',
    priceCents: 210000,
    widthIn: 60,
    depthIn: 36,
    heightIn: 36,
    clearanceIn: 42,
    accessible: true,
    sku: 'SYN-ISL-60-BB',
    mount: 'floor',
    doorSwingIn: 18,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'flush-mount-light',
    name: 'Architectural LED flush mount',
    category: 'lighting',
    finish: 'warm brass',
    priceCents: 45000,
    widthIn: 16,
    depthIn: 16,
    heightIn: 4,
    clearanceIn: 0,
    accessible: true,
    sku: 'SYN-LGT-16-WB',
    mount: 'ceiling',
    doorSwingIn: 0,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
];

const registered = [];
const proposalCache = new Map();
const confirmationGrants = new Map();
const objectSchema = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const stringField = { type: 'string' };
const numberField = { type: 'number' };
const sessionSchema = objectSchema({ sessionId: stringField }, ['sessionId']);
const result = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: value,
});
const failure = (code, message) =>
  result({ ok: false, error: { code, message, retryable: false } });

function credentials() {
  try {
    return JSON.parse(sessionStorage.getItem('handshake-session')) ?? {};
  } catch {
    return {};
  }
}

function authorize(input) {
  const current = credentials();
  if (!current.sessionId || !current.capability) throw new Error('SESSION_NOT_FOUND');
  if (input.sessionId !== current.sessionId) throw new Error('FORBIDDEN_ACTOR');
  return current;
}

async function call(resource, method, input) {
  const current = authorize(input);
  const headers = { 'x-handshake-capability': current.capability };
  const options = { method, headers };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    const { sessionId: _sessionId, ...body } = input;
    options.body = JSON.stringify(body);
  }
  const response = await fetch(
    `/api/v1/sessions/${encodeURIComponent(current.sessionId)}/${resource}`,
    options,
  );
  return response.json();
}

async function roomState(input) {
  return call('state', 'GET', input);
}

function confirmationKey(input) {
  const payload = Object.fromEntries(
    Object.entries(input.payload).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify([input.sessionId, input.action, payload]);
}

window.addEventListener('handshake:confirmation-granted', (event) => {
  const detail = event.detail;
  if (detail?.key && detail.confirmationId && detail.proof) {
    confirmationGrants.set(detail.key, {
      confirmationId: detail.confirmationId,
      proof: detail.proof,
    });
  }
});

function evaluate(state) {
  let committedCents = 0;
  const findings = [];
  for (const item of state.items) {
    const product = CATALOG.find((entry) => entry.id === item.productId);
    if (!product) {
      findings.push({
        code: 'UNKNOWN_PRODUCT',
        severity: 'blocked',
        message: `Unknown product ${item.productId}.`,
        itemIds: [item.id],
      });
      continue;
    }
    committedCents += product.priceCents;
    const rotated = item.rotation === 90 || item.rotation === 270;
    const width = rotated ? product.depthIn : product.widthIn;
    const depth = rotated ? product.widthIn : product.depthIn;
    if (
      item.x < 0 ||
      item.y < 0 ||
      item.x + width > state.widthIn ||
      item.y + depth > state.lengthIn
    )
      findings.push({
        code: 'OUT_OF_BOUNDS',
        severity: 'blocked',
        message: `${product.name} is outside the room.`,
        itemIds: [item.id],
      });
  }
  if (committedCents > state.budgetCents)
    findings.push({
      code: 'OVER_BUDGET',
      severity: 'blocked',
      message: 'Committed design exceeds the budget.',
      itemIds: [],
    });
  return {
    version: state.version,
    committedCents,
    budgetCents: state.budgetCents,
    overBudget: committedCents > state.budgetCents,
    findings,
  };
}

const tools = [
  {
    name: 'get_room_state',
    description: 'Read the committed room state. This never returns a proposal as committed.',
    inputSchema: sessionSchema,
    execute: async (input) => result(await roomState(input)),
  },
  {
    name: 'search_catalog',
    description: 'Search the synthetic fixture catalog.',
    inputSchema: objectSchema(
      {
        sessionId: stringField,
        query: stringField,
        category: { type: 'string' },
        maxPriceCents: numberField,
        accessibleOnly: { type: 'boolean' },
        roomType: { type: 'string', enum: ['bathroom', 'kitchen'] },
      },
      ['sessionId', 'query'],
    ),
    execute: async (input) => {
      authorize(input);
      const query = input.query.toLowerCase();
      const products = CATALOG.filter(
        (entry) =>
          `${entry.name} ${entry.finish}`.toLowerCase().includes(query) &&
          (!input.category || entry.category === input.category) &&
          (!Number.isFinite(input.maxPriceCents) || entry.priceCents <= input.maxPriceCents) &&
          (!input.accessibleOnly || entry.accessible) &&
          (!input.roomType || CATEGORY_ROOM_TYPES[entry.category]?.includes(input.roomType)),
      );
      return result({ ok: true, data: { products } });
    },
  },
  {
    name: 'evaluate_design',
    description: 'Return deterministic budget and layout findings for committed state.',
    inputSchema: sessionSchema,
    execute: async (input) => {
      const payload = await roomState(input);
      return payload.ok
        ? result({
            ok: true,
            requestId: payload.requestId,
            data: { evaluation: payload.data.evaluation },
          })
        : result(payload);
    },
  },
  {
    name: 'propose_changes',
    description: 'Create a non-mutating proposal for human review.',
    inputSchema: objectSchema(
      {
        sessionId: stringField,
        expectedVersion: { type: 'integer' },
        operations: { type: 'array', maxItems: 12, items: { type: 'object' } },
        rationale: stringField,
        idempotencyKey: stringField,
      },
      ['sessionId', 'expectedVersion', 'operations', 'rationale', 'idempotencyKey'],
    ),
    execute: async (input) => {
      const payload = await call('proposals', 'POST', input);
      if (payload.ok) proposalCache.set(payload.data.proposal.id, payload.data.proposal);
      return result(payload);
    },
  },
  {
    name: 'get_proposal',
    description: 'Read a proposal created in this page session.',
    inputSchema: objectSchema({ sessionId: stringField, proposalId: stringField }, [
      'sessionId',
      'proposalId',
    ]),
    execute: async (input) => {
      authorize(input);
      const proposal = proposalCache.get(input.proposalId);
      return proposal
        ? result({ ok: true, data: { proposal } })
        : failure('PROPOSAL_NOT_FOUND', 'Proposal is not available in this page session.');
    },
  },
  {
    name: 'apply_approved_proposal',
    description:
      'Apply one exact proposal only after the page-owned human approval route approved it.',
    inputSchema: objectSchema(
      {
        sessionId: stringField,
        proposalId: stringField,
        proposalHash: stringField,
        expectedVersion: { type: 'integer' },
        idempotencyKey: stringField,
      },
      ['sessionId', 'proposalId', 'proposalHash', 'expectedVersion', 'idempotencyKey'],
    ),
    execute: async (input) => result(await call('apply', 'POST', input)),
  },
  {
    name: 'request_protected_action',
    description: 'Request a protected synthetic action. Confirmation remains page-owned.',
    inputSchema: objectSchema(
      {
        sessionId: stringField,
        action: { type: 'string', enum: ['book_consultation', 'request_quote'] },
        payload: { type: 'object', additionalProperties: { type: 'string' } },
        idempotencyKey: stringField,
      },
      ['sessionId', 'action', 'payload', 'idempotencyKey'],
    ),
    execute: async (input) => {
      const key = confirmationKey(input);
      const grant = confirmationGrants.get(key);
      const payload = await call('protected-actions', 'POST', { ...input, ...grant });
      if (payload.ok) confirmationGrants.delete(key);
      if (
        !payload.ok &&
        ['CONFIRMATION_REQUIRED', 'CONFIRMATION_EXPIRED'].includes(payload.error?.code)
      ) {
        confirmationGrants.delete(key);
        window.dispatchEvent(
          new CustomEvent('handshake:confirmation-requested', {
            detail: { key, action: input.action, payload: input.payload },
          }),
        );
      }
      return result(payload);
    },
  },
  {
    name: 'get_receipt',
    description: 'Read the exportable decision receipt when available.',
    inputSchema: sessionSchema,
    execute: async (input) => result(await call('receipt', 'GET', input)),
  },
  {
    name: 'get_bill_of_materials',
    description: 'Read the itemized bill of materials and budget summary for committed state.',
    inputSchema: sessionSchema,
    execute: async (input) => {
      try {
        const payload = await call('bom', 'GET', input);
        if (payload.ok) return result(payload);
      } catch {}
      const stateRes = await roomState(input);
      return result(stateRes);
    },
  },
];

export function registerHandshakeTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return false;
  for (const tool of tools) {
    context.registerTool(tool);
    registered.push(tool.name);
  }
  return true;
}

function unregisterHandshakeTools() {
  const context = document.modelContext;
  if (!context?.unregisterTool) return;
  for (const name of registered.splice(0)) context.unregisterTool(name);
}

if (!registerHandshakeTools())
  window.dispatchEvent(new CustomEvent('handshake:webmcp-unavailable'));
window.addEventListener('pagehide', unregisterHandshakeTools, { once: true });
export { TOOL_NAMES };
