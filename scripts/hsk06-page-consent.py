from pathlib import Path

p=Path('apps/web/public/index.html')
s=p.read_text()
old='''        </section>
      </aside>
    </main>

    <footer>'''
new='''        </section>

        <section class="evidence-actions" aria-labelledby="evidence-title">
          <p class="eyebrow">Exportable proof</p>
          <h2 id="evidence-title">Decision receipt</h2>
          <p class="muted">Download the allowlisted synthetic session evidence as JSON.</p>
          <button id="download-receipt" type="button">Download receipt</button>
        </section>
      </aside>
    </main>

    <dialog id="confirmation-dialog" aria-labelledby="confirmation-title">
      <form method="dialog" class="confirmation-card">
        <p class="eyebrow">Protected synthetic action</p>
        <h2 id="confirmation-title">Confirm exact action</h2>
        <p>This action cannot run until you confirm its exact name and payload.</p>
        <dl>
          <dt>Action</dt>
          <dd><code id="confirmation-action"></code></dd>
          <dt>Payload</dt>
          <dd><pre id="confirmation-payload"></pre></dd>
        </dl>
        <div class="button-row">
          <button id="confirm-action" class="primary" type="button">Confirm exact action</button>
          <button id="cancel-confirmation" value="cancel">Cancel</button>
        </div>
      </form>
    </dialog>

    <footer>'''
if old not in s: raise SystemExit('html anchor missing')
p.write_text(s.replace(old,new))

p=Path('apps/web/public/app.js')
s=p.read_text()
s=s.replace("const app = { sessionId: '', capability: '', state: null, proposal: null, selectedId: '', zoom: 1 };", "const app = {\n  sessionId: '',\n  capability: '',\n  state: null,\n  proposal: null,\n  selectedId: '',\n  zoom: 1,\n  pendingConfirmation: null,\n};")
anchor='''function handle(error) {
  showError(`${error.code ?? 'ERROR'} — ${error.message}`);
  if (error.code === 'VERSION_CONFLICT') refresh().catch(() => {});
}

function nudge(event) {'''
insert='''function handle(error) {
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

function nudge(event) {'''
if anchor not in s: raise SystemExit('app function anchor missing')
s=s.replace(anchor,insert)
anchor="""$('catalog-search').addEventListener('input', renderCatalog);"""
listeners="""window.addEventListener('handshake:confirmation-requested', showConfirmation);
$('confirm-action').addEventListener('click', confirmProtectedAction);
$('confirmation-dialog').addEventListener('close', () => {
  if ($('confirmation-dialog').returnValue !== 'confirmed') app.pendingConfirmation = null;
});
$('download-receipt').addEventListener('click', downloadReceipt);
$('catalog-search').addEventListener('input', renderCatalog);"""
if anchor not in s: raise SystemExit('app listener anchor missing')
s=s.replace(anchor,listeners)
p.write_text(s)

p=Path('apps/web/public/webmcp.js')
s=p.read_text()
s=s.replace("const proposalCache = new Map();", "const proposalCache = new Map();\nconst confirmationGrants = new Map();")
anchor='''async function roomState(input) {
  return call('state', 'GET', input);
}

function evaluate(state) {'''
insert='''async function roomState(input) {
  return call('state', 'GET', input);
}

function confirmationKey(input) {
  const payload = Object.fromEntries(Object.entries(input.payload).sort(([a], [b]) => a.localeCompare(b)));
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

function evaluate(state) {'''
if anchor not in s: raise SystemExit('webmcp helper anchor missing')
s=s.replace(anchor,insert)
old='''        payload: { type: 'object', additionalProperties: { type: 'string' } },
        confirmationId: stringField,
        proof: stringField,
        idempotencyKey: stringField,'''
new='''        payload: { type: 'object', additionalProperties: { type: 'string' } },
        idempotencyKey: stringField,'''
if old not in s: raise SystemExit('webmcp schema anchor missing')
s=s.replace(old,new)
old="""    execute: async (input) => result(await call('protected-actions', 'POST', input)),"""
new="""    execute: async (input) => {
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
    },"""
if old not in s: raise SystemExit('webmcp execute anchor missing')
s=s.replace(old,new)
p.write_text(s)

p=Path('apps/web/public/styles.css')
s=p.read_text()
anchor='''footer {
  display: flex;'''
insert='''.evidence-actions button {
  width: 100%;
}
dialog {
  width: min(520px, calc(100% - 32px));
  border: 0;
  border-radius: 14px;
  padding: 0;
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.3);
}
dialog::backdrop {
  background: rgba(16, 24, 40, 0.58);
}
.confirmation-card {
  padding: 22px;
}
.confirmation-card dl {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
}
.confirmation-card dt {
  font-weight: 800;
}
.confirmation-card dd {
  margin: 0;
  min-width: 0;
}
.confirmation-card pre {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f2f4f7;
  border-radius: 8px;
  padding: 10px;
}
footer {
  display: flex;'''
if anchor not in s: raise SystemExit('css anchor missing')
s=s.replace(anchor,insert)
p.write_text(s)
