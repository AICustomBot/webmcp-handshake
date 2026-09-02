const TOOL_NAMES = [
  'get_room_state',
  'search_catalog',
  'evaluate_design',
  'propose_changes',
  'get_proposal',
  'apply_approved_proposal',
  'request_protected_action',
  'get_receipt',
];

const CATALOG = [
  {
    id: 'harbor-vanity',
    name: 'Harbor vanity',
    category: 'vanity',
    finish: 'matte black',
    priceCents: 248000,
    widthIn: 36,
    depthIn: 21,
    clearanceIn: 30,
    accessible: true,
  },
  {
    id: 'open-shower',
    name: 'Open-entry shower',
    category: 'shower',
    finish: 'clear glass',
    priceCents: 490000,
    widthIn: 42,
    depthIn: 42,
    clearanceIn: 36,
    accessible: true,
  },
  {
    id: 'compact-wc',
    name: 'Compact WC',
    category: 'toilet',
    finish: 'white',
    priceCents: 168000,
    widthIn: 20,
    depthIn: 29,
    clearanceIn: 30,
    accessible: false,
  },
  {
    id: 'linen-tower',
    name: 'Linen tower',
    category: 'storage',
    finish: 'white oak',
    priceCents: 132000,
    widthIn: 18,
    depthIn: 16,
    clearanceIn: 24,
    accessible: true,
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
          (!input.accessibleOnly || entry.accessible),
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
