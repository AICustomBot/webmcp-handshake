const PRODUCTS = [
  {
    id: 'harbor-vanity',
    name: 'Harbor vanity',
    category: 'Vanity',
    priceCents: 248000,
    width: 36,
    depth: 21,
  },
  {
    id: 'open-shower',
    name: 'Open-entry shower',
    category: 'Shower',
    priceCents: 490000,
    width: 42,
    depth: 42,
  },
  {
    id: 'compact-wc',
    name: 'Compact WC',
    category: 'Toilet',
    priceCents: 168000,
    width: 20,
    depth: 29,
  },
  {
    id: 'linen-tower',
    name: 'Linen tower',
    category: 'Storage',
    priceCents: 132000,
    width: 18,
    depth: 16,
  },
];

const app = {
  sessionId: '',
  capability: '',
  state: null,
  proposal: null,
  selectedId: '',
  zoom: 1,
  pendingConfirmation: null,
};
const $ = (id) => document.getElementById(id);
const money = (cents) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
const product = (id) => PRODUCTS.find((entry) => entry.id === id);
const key = () => crypto.randomUUID();

function announce(message) {
  $('status').textContent = message;
}
function showError(message = '') {
  $('error').hidden = !message;
  $('error').textContent = message;
}

async function api(resource, method = 'GET', body) {
  const headers = { 'x-handshake-capability': app.capability };
  const options = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(
    `/api/v1/sessions/${encodeURIComponent(app.sessionId)}/${resource}`,
    options,
  );
  const payload = await response.json();
  if (!payload.ok)
    throw Object.assign(new Error(payload.error.message), { code: payload.error.code });
  return payload.data;
}

async function createSession() {
  const response = await fetch('/api/v1/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error.message);
  app.sessionId = payload.data.sessionId;
  app.capability = payload.data.capability;
  sessionStorage.setItem(
    'handshake-session',
    JSON.stringify({ sessionId: app.sessionId, capability: app.capability }),
  );
}

function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('handshake-session'));
    if (!saved?.sessionId || !saved?.capability) return false;
    app.sessionId = saved.sessionId;
    app.capability = saved.capability;
    return true;
  } catch {
    return false;
  }
}

async function refresh() {
  const data = await api('state');
  app.state = data.state;
  render();
}

function rectFor(item) {
  const entry = product(item.productId) ?? { width: 16, depth: 16 };
  const rotated = item.rotation === 90 || item.rotation === 270;
  return {
    width: rotated ? entry.depth : entry.width,
    height: rotated ? entry.width : entry.depth,
  };
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [attribute, value] of Object.entries(attributes))
    node.setAttribute(attribute, String(value));
  return node;
}

function renderCanvas() {
  const layer = $('committed-layer');
  const preview = $('proposal-layer');
  layer.replaceChildren();
  preview.replaceChildren();
  if (!app.state) return;
  $('room-canvas').setAttribute(
    'viewBox',
    `-4 -4 ${app.state.widthIn + 8} ${app.state.lengthIn + 8}`,
  );
  for (const item of app.state.items) {
    const size = rectFor(item);
    const group = svgElement('g', {
      tabindex: 0,
      role: 'button',
      'aria-label': `${product(item.productId)?.name ?? item.productId} at ${item.x}, ${item.y}`,
    });
    const shape = svgElement('rect', {
      x: item.x,
      y: item.y,
      width: size.width,
      height: size.height,
      rx: 2,
      class: `fixture${item.id === app.selectedId ? ' selected' : ''}`,
    });
    const label = svgElement('text', {
      x: item.x + size.width / 2,
      y: item.y + size.height / 2 + 1.5,
      class: 'fixture-label',
    });
    label.textContent = product(item.productId)?.name.split(' ')[0] ?? 'Item';
    group.append(shape, label);
    group.addEventListener('click', () => selectItem(item.id));
    group.addEventListener('focus', () => selectItem(item.id));
    layer.append(group);
  }
  for (const operation of app.proposal?.operations ?? []) {
    if (operation.type !== 'place') continue;
    const size = rectFor({ ...operation, id: 'preview' });
    preview.append(
      svgElement('rect', {
        x: operation.x,
        y: operation.y,
        width: size.width,
        height: size.height,
        rx: 2,
        class: 'proposal-shape',
      }),
    );
  }
}

function selectItem(id) {
  app.selectedId = id;
  const item = app.state?.items.find((entry) => entry.id === id);
  if (item) {
    $('item-select').value = id;
    $('move-x').value = item.x;
    $('move-y').value = item.y;
    $('move-rotation').value = item.rotation;
  }
  renderCanvas();
  $('canvas-shell').focus();
}

function renderCatalog() {
  const query = $('catalog-search').value.trim().toLowerCase();
  const entries = PRODUCTS.filter((entry) =>
    `${entry.name} ${entry.category}`.toLowerCase().includes(query),
  );
  $('catalog-count').textContent = entries.length;
  $('catalog-list').replaceChildren(
    ...entries.map((entry) => {
      const card = document.createElement('article');
      card.className = 'product';
      const title = document.createElement('h3');
      title.textContent = entry.name;
      const meta = document.createElement('div');
      meta.className = 'product-meta';
      meta.innerHTML = `<span>${entry.category}</span><strong>${money(entry.priceCents)}</strong>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Propose at center';
      button.addEventListener('click', () => propose(entry));
      card.append(title, meta, button);
      return card;
    }),
  );
}

function evaluation() {
  let total = 0;
  const findings = [];
  for (const item of app.state?.items ?? []) {
    const entry = product(item.productId);
    if (!entry) {
      findings.push({ severity: 'blocked', text: `Unknown product ${item.productId}` });
      continue;
    }
    total += entry.priceCents;
    const size = rectFor(item);
    if (
      item.x < 0 ||
      item.y < 0 ||
      item.x + size.width > app.state.widthIn ||
      item.y + size.height > app.state.lengthIn
    )
      findings.push({ severity: 'blocked', text: `${entry.name} is outside the room.` });
  }
  return { total, findings };
}

function render() {
  if (!app.state) return;
  $('version-label').textContent =
    `Version ${app.state.version} · ${app.state.widthIn} × ${app.state.lengthIn} inches`;
  const select = $('item-select');
  select.replaceChildren(new Option('Select item', ''));
  for (const item of app.state.items)
    select.add(new Option(product(item.productId)?.name ?? item.id, item.id));
  const check = evaluation();
  $('budget-total').textContent = money(check.total);
  const percent = Math.min(
    100,
    Math.round((check.total / Math.max(1, app.state.budgetCents)) * 100),
  );
  $('budget-fill').style.width = `${percent}%`;
  $('budget-copy').textContent =
    `${money(app.state.budgetCents - check.total)} remaining of ${money(app.state.budgetCents)}.`;
  const findings = check.findings.length
    ? check.findings
    : [{ severity: '', text: 'No deterministic layout blocks.' }];
  $('findings').replaceChildren(
    ...findings.map((finding) => {
      const li = document.createElement('li');
      li.className = finding.severity;
      li.textContent = finding.text;
      return li;
    }),
  );
  renderCanvas();
  renderProposal();
}

function renderProposal() {
  const proposal = app.proposal;
  $('proposal-empty').hidden = Boolean(proposal);
  $('proposal-card').hidden = !proposal;
  if (!proposal) return;
  $('proposal-status').textContent = proposal.status.replace('_', ' ');
  $('proposal-id').textContent = proposal.id;
  $('proposal-rationale').textContent = proposal.rationale;
  $('proposal-diff').replaceChildren(
    ...proposal.operations.map((operation) => {
      const li = document.createElement('li');
      li.textContent =
        operation.type === 'place'
          ? `Place ${product(operation.productId)?.name ?? operation.productId} at X ${operation.x}, Y ${operation.y}, rotation ${operation.rotation}°.`
          : `${operation.type} ${operation.itemId}.`;
      return li;
    }),
  );
  const pending = proposal.status === 'pending_human';
  $('approve').hidden = !pending;
  $('reject').hidden = !pending;
  $('apply').hidden = proposal.status !== 'approved';
}

async function propose(entry) {
  try {
    showError();
    const data = await api('proposals', 'POST', {
      expectedVersion: app.state.version,
      operations: [
        {
          type: 'place',
          productId: entry.id,
          x: Math.round((app.state.widthIn - entry.width) / 2),
          y: Math.round((app.state.lengthIn - entry.depth) / 2),
          rotation: 0,
        },
      ],
      rationale: `Add ${entry.name} to the shared layout.`,
      idempotencyKey: key(),
    });
    app.proposal = data.proposal;
    render();
    announce('Proposal created. Committed state is unchanged.');
  } catch (error) {
    handle(error);
  }
}

async function decide(outcome) {
  try {
    const data = await api('decisions', 'POST', {
      proposalId: app.proposal.id,
      proposalHash: app.proposal.hash,
      outcome,
    });
    app.proposal = data.proposal;
    render();
    announce(`Proposal ${outcome === 'approve' ? 'approved' : 'rejected'}.`);
  } catch (error) {
    handle(error);
  }
}

async function applyProposal() {
  try {
    const data = await api('apply', 'POST', {
      proposalId: app.proposal.id,
      proposalHash: app.proposal.hash,
      expectedVersion: app.state.version,
      idempotencyKey: key(),
    });
    app.proposal = data.proposal;
    app.state = data.state;
    render();
    announce('Approved proposal applied with proof.');
  } catch (error) {
    handle(error);
  }
}

async function moveSelected() {
  const item = app.state.items.find((entry) => entry.id === $('item-select').value);
  if (!item) return showError('Select a committed item first.');
  const operation = {
    type: 'move',
    itemId: item.id,
    x: Number($('move-x').value),
    y: Number($('move-y').value),
    rotation: Number($('move-rotation').value),
  };
  try {
    const data = await api('edits', 'POST', {
      expectedVersion: app.state.version,
      operations: [operation],
    });
    app.state = data.state;
    if (app.proposal && ['pending_human', 'approved'].includes(app.proposal.status))
      app.proposal.status = 'superseded';
    render();
    announce('Manual edit committed. Older proposals were superseded.');
  } catch (error) {
    handle(error);
  }
}

function handle(error) {
  showError(`${error.code ?? 'ERROR'} — ${error.message}`);
  if (error.code === 'VERSION_CONFLICT') refresh().catch(() => {});
}

function showConfirmation(event) {
  const detail = event.detail;
  if (!detail || !['book_consultation', 'request_quote'].includes(detail.action)) return;
  app.pendingConfirmation = detail;
  $('confirmation-action').textContent = detail.action;
  $('confirmation-payload').textContent = JSON.stringify(detail.payload, null, 2);
  $('confirmation-dialog').showModal();
  $('confirm-action').focus();
}

async function confirmProtectedAction() {
  const pending = app.pendingConfirmation;
  if (!pending) return;
  try {
    const data = await api('confirmations', 'POST', {
      action: pending.action,
      payload: pending.payload,
    });
    window.dispatchEvent(
      new CustomEvent('handshake:confirmation-granted', {
        detail: {
          key: pending.key,
          confirmationId: data.confirmation.id,
          proof: data.proof,
        },
      }),
    );
    $('confirmation-dialog').close('confirmed');
    app.pendingConfirmation = null;
    announce('Exact action confirmed. The agent may retry it once.');
  } catch (error) {
    handle(error);
  }
}

async function downloadReceipt() {
  try {
    const data = await api('receipt');
    const blob = new Blob([JSON.stringify(data.receipt, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `handshake-receipt-${app.sessionId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Decision receipt downloaded.');
  } catch (error) {
    handle(error);
  }
}

function nudge(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || !app.selectedId)
    return;
  event.preventDefault();
  const item = app.state.items.find((entry) => entry.id === app.selectedId);
  if (!item) return;
  const step = event.shiftKey ? 6 : 1;
  const delta = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[event.key];
  $('move-x').value = item.x + delta[0];
  $('move-y').value = item.y + delta[1];
  moveSelected();
}

async function boot() {
  try {
    if (!restoreSession()) await createSession();
    await refresh();
    $('connection-dot').classList.add('ready');
    $('connection-label').textContent = 'Session isolated';
    renderCatalog();
    announce('Shared studio ready.');
  } catch (error) {
    sessionStorage.removeItem('handshake-session');
    showError(`Could not start: ${error.message}`);
  }
}

window.addEventListener('handshake:confirmation-requested', showConfirmation);
$('confirm-action').addEventListener('click', confirmProtectedAction);
$('confirmation-dialog').addEventListener('close', () => {
  if ($('confirmation-dialog').returnValue !== 'confirmed') app.pendingConfirmation = null;
});
$('download-receipt').addEventListener('click', downloadReceipt);
$('catalog-search').addEventListener('input', renderCatalog);
$('item-select').addEventListener('change', (event) => selectItem(event.target.value));
$('move-item').addEventListener('click', moveSelected);
$('approve').addEventListener('click', () => decide('approve'));
$('reject').addEventListener('click', () => decide('reject'));
$('apply').addEventListener('click', applyProposal);
$('canvas-shell').addEventListener('keydown', nudge);
$('zoom-in').addEventListener('click', () => {
  app.zoom = Math.min(1.5, app.zoom + 0.1);
  $('room-canvas').style.transform = `scale(${app.zoom})`;
  $('zoom-label').value = `${Math.round(app.zoom * 100)}%`;
});
$('zoom-out').addEventListener('click', () => {
  app.zoom = Math.max(0.7, app.zoom - 0.1);
  $('room-canvas').style.transform = `scale(${app.zoom})`;
  $('zoom-label').value = `${Math.round(app.zoom * 100)}%`;
});
boot();
