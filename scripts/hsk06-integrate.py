from pathlib import Path
p=Path('apps/worker/src/index.ts')
s=p.read_text()
anchor="import { DurableObject } from 'cloudflare:workers';\n"
s=s.replace(anchor, anchor+"import type { AuditEvent, ProtectedAction } from '@handshake/contracts';\nimport type { StoredConfirmation } from './evidence';\nimport { buildReceipt, createHumanConfirmation, performProtectedAction } from './protected-runtime';\nimport type { ProtectedActionOutcome } from './protected-runtime';\n")
s=s.replace("  idempotency: Record<string, IdempotencyRecord>;\n  createdAt: string;", "  idempotency: Record<string, IdempotencyRecord>;\n  confirmations: Record<string, StoredConfirmation>;\n  events: AuditEvent[];\n  actionResults: Record<string, ProtectedActionOutcome>;\n  createdAt: string;")
s=s.replace("      idempotency: {},\n      createdAt: now.toISOString(),", "      idempotency: {},\n      confirmations: {},\n      events: [],\n      actionResults: {},\n      createdAt: now.toISOString(),")
s=s.replace("  mayDecide,\n  proposalHash,", "  mayDecide,\n  evaluateDesign,\n  proposalHash,")
route="""      if (url.pathname === '/edits' && request.method === 'POST') {
        return this.edit(request, requestId, session, actor);
      }
"""
added=route+"""      if (url.pathname === '/confirmations' && request.method === 'POST') {
        return this.confirm(request, requestId, session, actor);
      }
      if (url.pathname === '/protected-actions' && request.method === 'POST') {
        return this.protectedAction(request, requestId, session, actor);
      }
      if (url.pathname === '/receipt' && request.method === 'GET') {
        return this.receipt(requestId, session);
      }
"""
if route not in s: raise SystemExit('route anchor missing')
s=s.replace(route,added)
methods="""
  /** Issues one page-owned, session-bound confirmation. */
  private async confirm(
    request: Request,
    requestId: string,
    session: StoredSession,
    actor: Actor,
  ): Promise<Response> {
    if (actor.kind !== 'human_ui') {
      return failure(requestId, 'FORBIDDEN_ACTOR', 'Only the page can confirm protected actions.');
    }
    const body = (await readBoundedJson(request)) as {
      action?: ProtectedAction;
      payload?: Record<string, string>;
    };
    if (
      !['book_consultation', 'request_quote'].includes(body.action ?? '') ||
      !body.payload ||
      Array.isArray(body.payload) ||
      Object.values(body.payload).some((value) => typeof value !== 'string')
    ) {
      return failure(requestId, 'INVALID_INPUT', 'A valid protected action and string payload are required.');
    }
    const result = await createHumanConfirmation(
      session,
      session.state.sessionId,
      session.state.version,
      body.action!,
      body.payload,
    );
    await this.ctx.storage.put(SESSION_KEY, session);
    return success(requestId, result, 201);
  }

  /** Performs one idempotent synthetic action after consuming exact consent. */
  private async protectedAction(
    request: Request,
    requestId: string,
    session: StoredSession,
    actor: Actor,
  ): Promise<Response> {
    if (actor.kind !== 'agent') {
      return failure(requestId, 'FORBIDDEN_ACTOR', 'Protected actions use the agent route.');
    }
    const body = (await readBoundedJson(request)) as {
      action?: ProtectedAction;
      payload?: Record<string, string>;
      confirmationId?: string;
      proof?: string;
      idempotencyKey?: string;
    };
    if (
      !['book_consultation', 'request_quote'].includes(body.action ?? '') ||
      !body.payload ||
      Array.isArray(body.payload) ||
      !body.idempotencyKey ||
      Object.values(body.payload).some((value) => typeof value !== 'string')
    ) {
      return failure(requestId, 'INVALID_INPUT', 'A valid action, string payload, and idempotency key are required.');
    }
    const digest = await requestHash({
      action: body.action,
      payload: body.payload,
      confirmationId: body.confirmationId,
    });
    const replay = checkIdempotency(session.idempotency[body.idempotencyKey], digest);
    if (replay.outcome === 'conflict') {
      return failure(requestId, replay.code, 'Idempotency key was reused for another action.');
    }
    if (replay.outcome === 'replay') {
      const stored = session.actionResults[replay.record.resultRef];
      return stored?.ok
        ? success(requestId, stored)
        : failure(requestId, 'POLICY_BLOCKED', 'Stored protected-action result is missing.');
    }
    const result = await performProtectedAction(
      session,
      session.state.sessionId,
      session.state.version,
      {
        action: body.action!,
        payload: body.payload,
        confirmationId: body.confirmationId,
        proof: body.proof,
      },
    );
    if (!result.ok) {
      await this.ctx.storage.put(SESSION_KEY, session);
      return failure(
        requestId,
        result.code,
        'Explicit page confirmation is required for this exact protected action.',
      );
    }
    const resultRef = crypto.randomUUID();
    session.actionResults[resultRef] = result;
    session.idempotency[body.idempotencyKey] = {
      key: body.idempotencyKey,
      requestHash: digest,
      resultRef,
      createdAt: result.performedAt,
    };
    await this.ctx.storage.put(SESSION_KEY, session);
    return success(requestId, result);
  }

  /** Returns a public allowlisted evidence receipt. */
  private receipt(requestId: string, session: StoredSession): Response {
    const receipt = buildReceipt(
      session.state.sessionId,
      session.state,
      evaluateDesign(session.state, []),
      Object.values(session.proposals),
      session,
    );
    return success(requestId, { receipt });
  }

"""
anchor2="  /** Deletes an expired session; otherwise expires proposals and reschedules. */"
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
