from pathlib import Path
p=Path('apps/worker/src/index.ts')
s=p.read_text()
anchor="import { DurableObject } from 'cloudflare:workers';\n"
s=s.replace(anchor, anchor+"import type { ProtectedAction } from '@handshake/contracts';\nimport type { StoredConfirmation } from './evidence';\nimport { buildReceipt, createHumanConfirmation, performProtectedAction } from './protected-runtime';\nimport type { EvidenceLedger, ProtectedActionOutcome } from './protected-runtime';\n")
s=s.replace("  idempotency: Record<string, IdempotencyRecord>;\n  updatedAt: string;", "  idempotency: Record<string, IdempotencyRecord>;\n  confirmations: Record<string, StoredConfirmation>;\n  events: AuditEvent[];\n  actionResults: Record<string, ProtectedActionOutcome>;\n  updatedAt: string;")
s=s.replace("      idempotency: {},\n      updatedAt: now,", "      idempotency: {},\n      confirmations: {},\n      events: [],\n      actionResults: {},\n      updatedAt: now,")
route="""      if (request.method === 'POST' && route.resource === 'edits') {
        return this.edit(request, actor, requestId);
      }
"""
added=route+"""      if (request.method === 'POST' && route.resource === 'confirmations') {
        return this.confirm(request, actor, requestId);
      }
      if (request.method === 'POST' && route.resource === 'protected-actions') {
        return this.protectedAction(request, actor, requestId);
      }
      if (request.method === 'GET' && route.resource === 'receipt') {
        return this.receipt(requestId);
      }
"""
if route not in s: raise SystemExit('route anchor missing')
s=s.replace(route,added)
methods="""
  private async confirm(request: Request, actor: Actor, requestId: string): Promise<Response> {
    if (actor.kind !== 'human_ui') return fail(requestId, 'FORBIDDEN_ACTOR', 'Only the page can confirm protected actions.');
    const parsed = await readBoundedJson<{ action?: ProtectedAction; payload?: Record<string, string> }>(request, LIMITS.maxBodyBytes);
    if (!parsed.ok || !['book_consultation', 'request_quote'].includes(parsed.value.action ?? '') || !parsed.value.payload || Array.isArray(parsed.value.payload)) {
      return fail(requestId, 'INVALID_INPUT', 'A valid protected action and string payload are required.');
    }
    if (Object.values(parsed.value.payload).some((value) => typeof value !== 'string')) return fail(requestId, 'INVALID_INPUT', 'Protected action payload values must be strings.');
    const state = await this.load();
    const result = await createHumanConfirmation(state, state.state.sessionId, parsed.value.action!, parsed.value.payload);
    state.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(SESSION_KEY, state);
    return ok(requestId, result);
  }

  private async protectedAction(request: Request, actor: Actor, requestId: string): Promise<Response> {
    if (actor.kind !== 'agent') return fail(requestId, 'FORBIDDEN_ACTOR', 'Protected actions are requested through the agent tool.');
    const parsed = await readBoundedJson<{ action?: ProtectedAction; payload?: Record<string, string>; confirmationId?: string; proof?: string; idempotencyKey?: string }>(request, LIMITS.maxBodyBytes);
    const body = parsed.ok ? parsed.value : undefined;
    if (!body || !['book_consultation', 'request_quote'].includes(body.action ?? '') || !body.payload || Array.isArray(body.payload) || !body.idempotencyKey || Object.values(body.payload).some((value) => typeof value !== 'string')) return fail(requestId, 'INVALID_INPUT', 'A valid action, string payload, and idempotency key are required.');
    const state = await this.load();
    const digest = await requestHash({ action: body.action, payload: body.payload, confirmationId: body.confirmationId });
    const prior = checkIdempotency(state.idempotency[body.idempotencyKey], digest);
    if (prior.outcome === 'conflict') return fail(requestId, prior.code, 'The idempotency key was reused for a different action.');
    if (prior.outcome === 'replay') {
      const stored = state.actionResults[prior.record.resultRef];
      return stored?.ok ? ok(requestId, stored) : fail(requestId, 'POLICY_BLOCKED', 'Stored protected-action result is unavailable.');
    }
    const result = await performProtectedAction(state, state.state.sessionId, state.state.version, { action: body.action!, payload: body.payload, confirmationId: body.confirmationId, proof: body.proof });
    state.updatedAt = new Date().toISOString();
    if (!result.ok) {
      await this.ctx.storage.put(SESSION_KEY, state);
      return fail(requestId, result.code, 'Explicit page confirmation is required for this exact protected action.');
    }
    const resultRef = crypto.randomUUID();
    state.actionResults[resultRef] = result;
    state.idempotency[body.idempotencyKey] = { key: body.idempotencyKey, requestHash: digest, resultRef, createdAt: state.updatedAt };
    await this.ctx.storage.put(SESSION_KEY, state);
    return ok(requestId, result);
  }

  private async receipt(requestId: string): Promise<Response> {
    const state = await this.load();
    return ok(requestId, { receipt: buildReceipt(state.state.sessionId, state.state, evaluateDesign(state.state, CATALOG), Object.values(state.proposals), state) });
  }

"""
anchor2="  private async load(): Promise<StoredSession> {"
if anchor2 not in s: raise SystemExit('method anchor missing')
s=s.replace(anchor2,methods+anchor2)
p.write_text(s)

w=Path('apps/web/public/webmcp.js')
t=w.read_text()
t=t.replace("        confirmationId: stringField,\n        idempotencyKey: stringField,", "        confirmationId: stringField,\n        proof: stringField,\n        idempotencyKey: stringField,")
t=t.replace("""    execute: async (input) => {
      authorize(input);
      return failure(
        'CONFIRMATION_REQUIRED',
        'Use the page-owned confirmation flow before retrying this action.',
      );
    },
  },
  {
    name: 'get_receipt',""", """    execute: async (input) => result(await call('protected-actions', 'POST', input)),
  },
  {
    name: 'get_receipt',""")
t=t.replace("""    execute: async (input) => {
      authorize(input);
      return failure('NOT_IMPLEMENTED', 'Receipt generation is introduced in HSK-06.');
    },
  },
];""", """    execute: async (input) => result(await call('receipt', 'GET', input)),
  },
];""")
w.write_text(t)
