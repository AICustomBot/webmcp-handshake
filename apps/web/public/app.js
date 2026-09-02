/* Handshake studio client. Agent tools never mutate: they propose; humans decide. */
'use strict';

const API = '/api/v1';
const CATEGORY_META = {
  vanity: { icon: '🛁', hue: 'linear-gradient(135deg,#d9c8f5,#a78bfa)' },
  storage: { icon: '🗄️', hue: 'linear-gradient(135deg,#c7e2f8,#7cb8e8)' },
  shower: { icon: '🚿', hue: 'linear-gradient(135deg,#c9f0ee,#6cc7c2)' },
  toilet: { icon: '🚽', hue: 'linear-gradient(135deg,#efe9df,#cbbfae)' },
  faucet: { icon: '🚰', hue: 'linear-gradient(135deg,#e3e3e3,#9ca3af)' },
  accessory: { icon: '💡', hue: 'linear-gradient(135deg,#fde8c9,#f0b45c)' },
  fixture: { icon: '🧼', hue: 'linear-gradient(135deg,#e8f4dd,#a9cf8a)' },
};
const CATEGORY_FILTERS = [
  'all',
  'vanity',
  'storage',
  'shower',
  'toilet',
  'faucet',
  'fixture',
  'accessory',
];

const state = {
  sessionId: null,
  capability: null,
  room: null,
  budget: null,
  checks: [],
  proposals: [],
  audit: [],
  catalog: [],
  category: 'all',
  selectedItemId: null,
  webmcpAvailable: false,
  pendingConfirmation: null,
};

/* ---------- utilities ---------- */

const $ = (id) => document.getElementById(id);

function announce(message) {
  $('status-region').textContent = message;
}

function showError(message) {
  const el = $('error-region');
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function idempotencyKey() {
  return (crypto.randomUUID && crypto.randomUUID()) || `key-${Date.now()}-${Math.random()}`;
}

async function api(path, options = {}, human = false) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Handshake-Capability', state.capability || '');
  if (human) headers.set('X-Handshake-Intent', 'human');
  if (options.method === 'POST') headers.set('Idempotency-Key', idempotencyKey());
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}/sessions/${state.sessionId}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (payload === null) {
    showError('Network or server failure. Retrying is safe.');
    throw new Error('invalid envelope');
  }
  showError('');
  return { response, payload };
}

function shortProduct(productId) {
  const product = state.catalog.find((entry) => entry.id === productId);
  return product ? product.name : productId;
}

function describeOperation(operation) {
  switch (operation.type) {
    case 'place':
      return `Place ${shortProduct(operation.productId)} at ${operation.x},${operation.y} (${operation.rotation}°)`;
    case 'move':
      return `Move item ${operation.itemId} to ${operation.x},${operation.y} (${operation.rotation}°)`;
    case 'swap':
      return `Swap ${operation.itemId} → ${shortProduct(operation.replacementProductId)}`;
    case 'remove':
      return `Remove item ${operation.itemId}`;
    default:
      return JSON.stringify(operation);
  }
}

/* ---------- data loading ---------- */

async function refreshRoom() {
  const { payload } = await api('/room');
  if (payload.ok) {
    state.room = payload.data.room;
    state.budget = payload.data.budget;
    state.checks = payload.data.checks;
  }
}

async function refreshProposals() {
  const { payload } = await api('/proposals');
  if (payload.ok) state.proposals = payload.data.proposals;
}

async function refreshAudit() {
  const { payload } = await api('/audit');
  if (payload.ok) state.audit = payload.data.audit;
}

async function loadCatalog() {
  const { payload } = await api('/catalog');
  if (payload.ok) state.catalog = payload.data.products;
}

async function refreshAll() {
  try {
    await Promise.all([refreshRoom(), refreshProposals(), refreshAudit()]);
    renderAll();
  } catch (error) {
    showError('Lost contact with the session. Check the connection and reload.');
  }
}

/* ---------- rendering ---------- */

function renderAll() {
  renderBudget();
  renderChecks();
  renderProposals();
  renderCanvas();
  renderTimeline();
  renderTable();
}

function renderBudget() {
  if (!state.budget) return;
  const { committedCents, limitCents, remainingCents, status } = state.budget;
  const percent = Math.min(100, Math.round((committedCents / Math.max(1, limitCents)) * 100));
  const fill = $('budget-fill');
  fill.style.width = `${percent}%`;
  fill.className = `budget-fill${status === 'near' ? ' near' : status === 'over' ? ' over' : ''}`;
  const dollars = (cents) =>
    `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  $('budget-text').textContent =
    `${dollars(committedCents)} of ${dollars(limitCents)} committed — ${dollars(Math.max(0, remainingCents))} remaining — status: ${status.toUpperCase()}`;
}

function renderChecks() {
  const list = $('checks-list');
  list.textContent = '';
  for (const check of state.checks) {
    const item = document.createElement('li');
    item.className = `check-item check-${check.status}`;
    const icon = document.createElement('span');
    icon.className = 'check-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = check.status === 'pass' ? '✓' : check.status === 'warning' ? '▲' : '✕';
    const body = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = `${check.code.toUpperCase()} — ${check.status.toUpperCase()}`;
    body.append(
      strong,
      document.createTextNode(` ${check.detail} (${check.itemIds.join(', ') || 'room'})`),
    );
    item.append(icon, body);
    list.append(item);
  }
  if (state.checks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'check-item check-pass';
    empty.textContent = 'No items placed yet.';
    list.append(empty);
  }
}

function renderProposals() {
  const list = $('proposals-list');
  list.textContent = '';
  const visible = state.proposals.slice(0, 6);
  for (const proposal of visible) {
    const card = document.createElement('article');
    card.className = 'proposal-card';
    const head = document.createElement('div');
    head.className = 'proposal-head';
    const id = document.createElement('span');
    id.className = 'proposal-id';
    id.textContent = proposal.id;
    const label = document.createElement('span');
    label.className = `state-label state-${proposal.status}`;
    label.textContent = proposal.status.replace('_', ' ').toUpperCase();
    head.append(id, label);
    card.append(head);

    const ops = document.createElement('ul');
    ops.className = 'op-list';
    for (const operation of proposal.operations) {
      const li = document.createElement('li');
      li.textContent = describeOperation(operation);
      ops.append(li);
    }
    card.append(ops);

    const actions = document.createElement('div');
    actions.className = 'proposal-actions';
    if (proposal.status === 'pending_human') {
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'btn btn-primary';
      approve.textContent = 'Approve';
      approve.addEventListener('click', () => decideProposal(proposal, 'approve'));
      const reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'btn btn-danger';
      reject.textContent = 'Reject';
      reject.addEventListener('click', () => decideProposal(proposal, 'reject'));
      actions.append(approve, reject);
    } else if (proposal.status === 'approved') {
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'btn btn-outline';
      apply.textContent = 'Apply now';
      apply.addEventListener('click', () => applyProposal(proposal));
      actions.append(apply);
    } else if (proposal.status === 'applied') {
      const note = document.createElement('span');
      note.className = 'hint';
      note.textContent = 'Applied';
      actions.append(note);
    }
    card.append(actions);
    list.append(card);
  }
  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-note';
    empty.textContent = 'No proposals yet. The agent can propose a layout via WebMCP.';
    list.append(empty);
  }
}

function renderCanvas() {
  const holder = $('svg-holder');
  const room = state.room;
  holder.querySelectorAll('svg').forEach((node) => node.remove());
  $('canvas-empty').hidden = Boolean(
    room && (room.items.length > 0 || state.proposals.some((p) => p.status === 'pending_human')),
  );
  if (!room) return;

  const pad = 10;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute(
    'viewBox',
    `${-pad} ${-pad} ${room.widthIn + pad * 2} ${room.lengthIn + pad * 2}`,
  );
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Room ${room.widthIn} by ${room.lengthIn} inches, ${room.items.length} items`,
  );

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', 'room-rect');
  rect.setAttribute('width', room.widthIn);
  rect.setAttribute('height', room.lengthIn);
  svg.append(rect);

  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  grid.setAttribute('class', 'room-grid');
  for (let x = 12; x < room.widthIn; x += 12) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('y1', 0);
    line.setAttribute('y2', room.lengthIn);
    grid.append(line);
  }
  for (let y = 12; y < room.lengthIn; y += 12) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('x2', room.widthIn);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    grid.append(line);
  }
  svg.append(grid);

  const door = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  door.setAttribute('class', 'door-zone');
  door.setAttribute('width', 36);
  door.setAttribute('height', 30);
  const doorLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  doorLabel.setAttribute('x', 4);
  doorLabel.setAttribute('y', 26);
  doorLabel.textContent = 'DOOR ZONE';
  svg.append(door, doorLabel);

  const catalogById = new Map(state.catalog.map((product) => [product.id, product]));
  for (const item of room.items) {
    const product = catalogById.get(item.productId);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('room-item');
    if (state.selectedItemId === item.id) group.classList.add('is-selected');
    group.setAttribute('data-item-id', item.id);
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    box.setAttribute('class', 'fingerprint');
    const w = product && product.wallMount ? 6 : product ? product.widthIn : 8;
    const l = product && product.wallMount ? 6 : product ? product.lengthIn : 8;
    const swapped = item.rotation === 90 || item.rotation === 270;
    box.setAttribute('x', item.x - (swapped ? l : w) / 2);
    box.setAttribute('y', item.y - (swapped ? w : l) / 2);
    box.setAttribute('width', swapped ? l : w);
    box.setAttribute('height', swapped ? w : l);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', item.x);
    label.setAttribute('y', item.y + 3);
    label.setAttribute('text-anchor', 'middle');
    label.textContent = (product ? product.name : item.id).slice(0, 16);
    group.addEventListener('click', () => {
      state.selectedItemId = item.id;
      renderCanvas();
      renderTable();
    });
    group.append(box, label);
    svg.append(group);
  }

  for (const proposal of state.proposals.filter((entry) => entry.status === 'pending_human')) {
    for (const operation of proposal.operations) {
      if (operation.type !== 'place') continue;
      const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      overlay.setAttribute('class', 'proposal-overlay');
      const product = catalogById.get(operation.productId);
      const w = product && product.wallMount ? 6 : product ? product.widthIn : 8;
      const l = product && product.wallMount ? 6 : product ? product.lengthIn : 8;
      overlay.setAttribute('x', operation.x - w / 2);
      overlay.setAttribute('y', operation.y - l / 2);
      overlay.setAttribute('width', w);
      overlay.setAttribute('height', l);
      svg.append(overlay);
    }
  }

  holder.append(svg);
}

function renderTable() {
  const body = $('item-table-body');
  body.textContent = '';
  if (!state.room) return;
  for (const item of state.room.items) {
    const row = document.createElement('tr');
    for (const value of [
      item.id,
      item.productId,
      String(item.x),
      String(item.y),
      `${item.rotation}°`,
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
}

function renderTimeline() {
  const list = $('timeline-list');
  list.textContent = '';
  for (const entry of state.audit.slice(-12).reverse()) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date(entry.ts).toLocaleTimeString();
    const text = document.createElement('span');
    text.textContent = `${entry.type} — ${entry.detail}`;
    li.append(time, text);
    list.append(li);
  }
  if (state.audit.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No events yet.';
    list.append(li);
  }
}

function renderCatalog() {
  const list = $('catalog-list');
  const filters = $('catalog-filters');
  filters.textContent = '';
  for (const category of CATEGORY_FILTERS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.setAttribute('aria-pressed', String(state.category === category));
    chip.textContent = category;
    chip.addEventListener('click', () => {
      state.category = category;
      renderCatalog();
    });
    filters.append(chip);
  }
  list.textContent = '';
  for (const product of state.catalog) {
    if (state.category !== 'all' && product.category !== state.category) continue;
    const meta = CATEGORY_META[product.category] || CATEGORY_META.fixture;
    const card = document.createElement('article');
    card.className = 'product-card';
    const swatch = document.createElement('div');
    swatch.className = 'product-swatch';
    swatch.style.background = meta.hue;
    swatch.textContent = meta.icon;
    const metaBox = document.createElement('div');
    metaBox.className = 'product-meta';
    const name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = product.name;
    const sub = document.createElement('div');
    sub.className = 'product-sub';
    sub.textContent = `$${(product.priceCents / 100).toFixed(2)} · ${product.widthIn}×${product.lengthIn}in${product.wallMount ? ' · wall-mount' : ''}`;
    metaBox.append(name, sub);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-outline product-add';
    add.textContent = 'Add';
    add.setAttribute('aria-label', `Add ${product.name} at center`);
    add.addEventListener('click', () => manualPlace(product.id));
    card.append(swatch, metaBox, add);
    list.append(card);
  }
}

/* ---------- human actions ---------- */

async function manualPlace(productId) {
  const { payload } = await api('/manual', {
    method: 'POST',
    body: JSON.stringify({ op: { type: 'place', productId, x: 54, y: 66, rotation: 0 } }),
  });
  if (payload.ok) {
    announce('Item placed.');
    await refreshAll();
  } else {
    showError(`Place failed: ${payload.error.code}`);
  }
}

async function decideProposal(proposal, decision) {
  const { payload } = await api(
    `/proposals/${proposal.id}/decision`,
    { method: 'POST', body: JSON.stringify({ decision, expectedHash: proposal.hash }) },
    true,
  );
  if (payload.ok) {
    announce(`Proposal ${decision}d.`);
    await refreshAll();
  } else {
    showError(`Decision failed: ${payload.error.code} — ${payload.error.message}`);
    await refreshAll();
  }
}

async function applyProposal(proposal) {
  const { payload } = await api(`/proposals/${proposal.id}/apply`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (payload.ok) {
    announce(`Proposal applied. Room at version ${payload.data.room.version}.`);
    await refreshAll();
  } else {
    showError(`Apply failed: ${payload.error.code} — ${payload.error.message}`);
    await refreshAll();
  }
}

async function resetSession() {
  const { payload } = await api('/reset', { method: 'POST', body: JSON.stringify({}) }, true);
  if (payload.ok) {
    announce('Session reset.');
    await refreshAll();
  } else {
    showError(`Reset failed: ${payload.error.code}`);
  }
}

function openConfirmDialog(title, summary, onConfirm) {
  const dialog = $('confirm-dialog');
  $('confirm-title').textContent = title;
  $('confirm-summary').textContent = summary;
  const form = $('confirm-form');
  const handler = (event) => {
    event.preventDefault();
    const value = event.submitter && event.submitter.value;
    form.removeEventListener('submit', handler);
    dialog.close();
    if (value === 'confirm') onConfirm();
  };
  form.addEventListener('submit', handler);
  dialog.showModal();
}

async function completeProtected(action, payloadObject) {
  const first = await api(
    '/protected',
    {
      method: 'POST',
      body: JSON.stringify({ action, payload: payloadObject }),
    },
    true,
  );
  if (first.payload.ok) return first.payload;
  if (first.payload.error.code !== 'CONFIRMATION_REQUIRED') return first.payload;
  const { confirmationId, actionDigest } = first.payload.error.data;
  const second = await api(
    '/protected/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ confirmationId, actionDigest }),
    },
    true,
  );
  if (!second.payload.ok) return second.payload;
  const { token } = second.payload.data;
  const third = await api(
    '/protected',
    {
      method: 'POST',
      body: JSON.stringify({ action, payload: payloadObject, confirmationId, token }),
    },
    true,
  );
  return third.payload;
}

function requestBooking() {
  const payloadObject = { showroom: 'Cairo Design District', day: '2026-09-05', time: '14:00' };
  openConfirmDialog(
    'Book showroom visit',
    JSON.stringify({ action: 'book_showroom_visit', ...payloadObject }, null, 2),
    async () => {
      const result = await completeProtected('book_showroom_visit', payloadObject);
      if (result.ok) {
        announce(`Booked. Reference ${result.data.referenceId}.`);
      } else {
        showError(`Booking failed: ${result.error.code}`);
      }
      await refreshAll();
    },
  );
}

function requestQuote() {
  const payloadObject = {
    email: 'demo@example.com',
    roomVersion: state.room ? state.room.version : 1,
  };
  openConfirmDialog(
    'Request quote',
    JSON.stringify({ action: 'submit_quote_request', ...payloadObject }, null, 2),
    async () => {
      const result = await completeProtected('submit_quote_request', payloadObject);
      if (result.ok) {
        announce(`Quote requested. Reference ${result.data.referenceId}.`);
      } else {
        showError(`Quote failed: ${result.error.code}`);
      }
      await refreshAll();
    },
  );
}

async function downloadReceipt() {
  const { payload } = await api('/receipt');
  if (!payload.ok) {
    showError('Receipt unavailable.');
    return;
  }
  const blob = new Blob([JSON.stringify(payload.data.receipt, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `handshake-receipt-${state.sessionId}.json`;
  link.click();
  URL.revokeObjectURL(url);
  announce('Receipt downloaded.');
}

function printSummary() {
  window.print();
}

/* ---------- keyboard nudging ---------- */

function setupKeyboard() {
  $('svg-holder').addEventListener('keydown', (event) => {
    if (!state.selectedItemId || !state.room) return;
    const item = state.room.items.find((entry) => entry.id === state.selectedItemId);
    if (!item) return;
    const step = event.shiftKey ? 6 : 1;
    const deltas = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const [dx, dy] = delta;
    nudgeSelected(item, item.x + dx, item.y + dy);
  });
}

let nudgeTimer = null;
function nudgeSelected(item, x, y) {
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(async () => {
    const { payload } = await api('/manual', {
      method: 'POST',
      body: JSON.stringify({
        op: { type: 'move', itemId: item.id, x, y, rotation: item.rotation },
      }),
    });
    if (payload.ok) {
      announce(`Moved ${item.id} to ${x},${y}.`);
      await refreshAll();
    } else {
      showError(`Move rejected: ${payload.error.code}`);
      await refreshAll();
    }
  }, 120);
}

/* ---------- agent console ---------- */

const consoleLog = [];
function logTool(name, args, result) {
  consoleLog.push({ name, args, result, ts: new Date().toISOString() });
  const list = $('console-log');
  const li = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  const text = document.createElement('span');
  text.textContent = `${name}(${JSON.stringify(args ?? {})}) → ${JSON.stringify(result).slice(0, 220)}`;
  li.append(time, text);
  list.prepend(li);
  while (list.children.length > 50) list.removeChild(list.lastChild);
}

/* ---------- WebMCP adapter (agent surface — never sends human intent) ---------- */

function envelopeData(result) {
  return result.ok ? result.data : { error: result.error };
}

async function toolCall(name, path, body, method = 'POST') {
  try {
    const { payload } = await api(
      path,
      body === undefined ? {} : { method, body: JSON.stringify(body) },
    );
    logTool(name, body, envelopeData(payload));
    return payload.ok
      ? payload.data
      : { error: payload.error.code, message: payload.error.message };
  } catch (error) {
    logTool(name, body, { error: 'NETWORK' });
    return { error: 'NETWORK', message: String(error) };
  }
}

function buildTools() {
  return [
    {
      name: 'get_room_state',
      description: 'Read the committed room snapshot, version and placed items.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => toolCall('get_room_state', '/room', {}, 'GET'),
    },
    {
      name: 'search_catalog',
      description: 'Search the synthetic catalog by name substring and optional category.',
      inputSchema: {
        type: 'object',
        properties: { q: { type: 'string' }, category: { type: 'string' } },
      },
      execute: (args) => {
        const params = new URLSearchParams();
        if (args && typeof args.q === 'string') params.set('q', args.q);
        if (args && typeof args.category === 'string') params.set('category', args.category);
        const suffix = params.toString() ? `?${params}` : '';
        return toolCall('search_catalog', `/catalog${suffix}`, {}, 'GET');
      },
    },
    {
      name: 'get_product_detail',
      description: 'Get one catalog product by id.',
      inputSchema: {
        type: 'object',
        properties: { productId: { type: 'string' } },
        required: ['productId'],
      },
      execute: (args) =>
        toolCall(
          'get_product_detail',
          `/products/${encodeURIComponent(args.productId)}`,
          {},
          'GET',
        ),
    },
    {
      name: 'get_budget_status',
      description: 'Committed budget, limit and ok/near/over status.',
      inputSchema: { type: 'object', properties: {} },
      execute: () =>
        toolCall('get_budget_status', '/room', {}, 'GET').then((data) => data.budget ?? data),
    },
    {
      name: 'check_clearances',
      description: 'Run the deterministic demo clearance checks for the committed room.',
      inputSchema: { type: 'object', properties: {} },
      execute: () =>
        toolCall('check_clearances', '/room', {}, 'GET').then((data) => data.checks ?? data),
    },
    {
      name: 'propose_place_item',
      description: 'Propose placing a product; never mutates the room.',
      inputSchema: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          rotation: { type: 'number', enum: [0, 90, 180, 270] },
        },
        required: ['productId', 'x', 'y'],
      },
      execute: (args) =>
        toolCall('propose_place_item', '/proposals', {
          operations: [
            {
              type: 'place',
              productId: args.productId,
              x: args.x,
              y: args.y,
              rotation: args.rotation ?? 0,
            },
          ],
        }),
    },
    {
      name: 'propose_move_item',
      description: 'Propose moving an existing item; never mutates the room.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          rotation: { type: 'number', enum: [0, 90, 180, 270] },
        },
        required: ['itemId', 'x', 'y'],
      },
      execute: (args) =>
        toolCall('propose_move_item', '/proposals', {
          operations: [
            {
              type: 'move',
              itemId: args.itemId,
              x: args.x,
              y: args.y,
              rotation: args.rotation ?? 0,
            },
          ],
        }),
    },
    {
      name: 'propose_swap_item',
      description: 'Propose swapping an item for another product; never mutates the room.',
      inputSchema: {
        type: 'object',
        properties: { itemId: { type: 'string' }, replacementProductId: { type: 'string' } },
        required: ['itemId', 'replacementProductId'],
      },
      execute: (args) =>
        toolCall('propose_swap_item', '/proposals', {
          operations: [
            { type: 'swap', itemId: args.itemId, replacementProductId: args.replacementProductId },
          ],
        }),
    },
    {
      name: 'propose_full_layout',
      description: 'Propose a batch of operations (max 12); never mutates the room.',
      inputSchema: {
        type: 'object',
        properties: { operations: { type: 'array' } },
        required: ['operations'],
      },
      execute: (args) =>
        toolCall('propose_full_layout', '/proposals', { operations: args.operations }),
    },
    {
      name: 'list_pending_proposals',
      description: 'List proposals and their statuses.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => toolCall('list_pending_proposals', '/proposals', {}, 'GET'),
    },
    {
      name: 'get_proposal_status',
      description: 'Get one proposal by id.',
      inputSchema: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
        required: ['proposalId'],
      },
      execute: (args) =>
        toolCall(
          'get_proposal_status',
          `/proposals/${encodeURIComponent(args.proposalId)}`,
          {},
          'GET',
        ),
    },
    {
      name: 'apply_approved_change',
      description: 'Apply a proposal that the human already approved in the page.',
      inputSchema: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
        required: ['proposalId'],
      },
      execute: (args) =>
        toolCall(
          'apply_approved_change',
          `/proposals/${encodeURIComponent(args.proposalId)}/apply`,
          {},
        ),
    },
    {
      name: 'book_showroom_visit',
      description:
        'Request a synthetic showroom booking; requires the human to confirm in the page.',
      inputSchema: {
        type: 'object',
        properties: { showroom: { type: 'string' }, day: { type: 'string' } },
      },
      execute: (args) =>
        toolCall('book_showroom_visit', '/protected', {
          action: 'book_showroom_visit',
          payload: {
            showroom: args.showroom ?? 'Cairo Design District',
            day: args.day ?? '2026-09-05',
          },
        }),
    },
    {
      name: 'submit_quote_request',
      description: 'Request a synthetic quote; requires the human to confirm in the page.',
      inputSchema: { type: 'object', properties: { email: { type: 'string' } } },
      execute: (args) =>
        toolCall('submit_quote_request', '/protected', {
          action: 'submit_quote_request',
          payload: { email: args.email ?? 'demo@example.com' },
        }),
    },
    {
      name: 'generate_evidence_receipt',
      description: 'Generate the allowlisted evidence receipt for the session.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => toolCall('generate_evidence_receipt', '/receipt', {}, 'GET'),
    },
  ];
}

async function registerWebMCP() {
  const host = navigator.modelContext || window.modelContext || null;
  const tools = buildTools();
  if (host && typeof host.registerTool === 'function') {
    let registered = 0;
    for (const tool of tools) {
      try {
        await host.registerTool(tool);
        registered += 1;
      } catch (error) {
        logTool(tool.name, null, { error: 'REGISTER_FAILED' });
      }
    }
    state.webmcpAvailable = true;
    setChip(true);
    $('console-status').textContent =
      `WebMCP active: ${registered}/${tools.length} tools registered with the agent runtime.`;
    return;
  }
  state.webmcpAvailable = false;
  setChip(false);
  $('console-status').textContent =
    'WebMCP unavailable in this browser. The same 15 tools are listed below; open the page in a WebMCP-capable browser to connect a real agent.';
  const list = $('console-log');
  for (const tool of tools) {
    const li = document.createElement('li');
    li.textContent = `available: ${tool.name} — ${tool.description}`;
    list.append(li);
  }
}

function setChip(on) {
  const chip = $('webmcp-chip');
  chip.className = `chip ${on ? 'chip-on' : 'chip-off'}`;
  chip.textContent = on ? 'WebMCP: connected' : 'WebMCP: unavailable';
}

/* ---------- boot ---------- */

async function createSession() {
  const response = await fetch(`${API}/sessions`, { method: 'POST' });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error ? payload.error.code : 'session create failed');
  state.sessionId = payload.data.sessionId;
  state.capability = payload.data.capability;
  state.room = payload.data.room;
  sessionStorage.setItem(
    'handshake-session',
    JSON.stringify({ sessionId: state.sessionId, capability: state.capability }),
  );
  return payload.data;
}

function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('handshake-session') || 'null');
    if (saved && saved.sessionId && saved.capability) {
      state.sessionId = saved.sessionId;
      state.capability = saved.capability;
      return true;
    }
  } catch (error) {
    /* ignore malformed storage */
  }
  return false;
}

async function boot() {
  const restored = restoreSession();
  let ready = false;
  if (restored) {
    try {
      await refreshRoom();
      ready = Boolean(state.room);
    } catch (error) {
      ready = false;
    }
  }
  if (!ready) {
    try {
      await createSession();
      await loadCatalog();
      await refreshAll();
      ready = true;
    } catch (error) {
      showError(`Could not start a session: ${error.message}`);
      return;
    }
  } else {
    await loadCatalog();
  }
  renderCatalog();
  renderAll();
  setupKeyboard();
  await registerWebMCP();
  announce('Studio ready.');

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAll();
  });
  setInterval(() => {
    if (!document.hidden) refreshAll();
  }, 5000);

  $('btn-reset').addEventListener('click', () => {
    openConfirmDialog(
      'Reset session',
      'The room returns to version 1 and all proposals are cleared.',
      resetSession,
    );
  });
  $('btn-help').addEventListener('click', () => $('help-dialog').showModal());
  $('btn-book').addEventListener('click', requestBooking);
  $('btn-quote').addEventListener('click', requestQuote);
  $('btn-receipt-json').addEventListener('click', downloadReceipt);
  $('btn-receipt-print').addEventListener('click', printSummary);
  $('console-toggle').addEventListener('click', () => {
    const body = $('console-body');
    const open = body.hidden;
    body.hidden = !open;
    $('console-toggle').setAttribute('aria-expanded', String(open));
  });
}

boot();
