import { DurableObject } from 'cloudflare:workers';
import { LIMITS, type RoomState, type ToolResult } from '../../../packages/contracts/src/index';
import type { SessionMeta } from './lib/session-core';
import { createSession, routeRequest, sweep, type StorageLike } from './lib/session-core';

export interface Env {
  ASSETS: Fetcher;
  DESIGN_SESSION: DurableObjectNamespace;
}

const INTENT_HEADER = 'x-handshake-intent';

/**
 * Edge entry point. Static assets are served directly; every /api/* route is
 * reserved for the governed session API implemented in HSK-03.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const requestId = crypto.randomUUID();
    const apiError = (status: number, code: string, message: string, retryable = false): Response =>
      Response.json(
        { ok: false, error: { code, message, retryable }, requestId } satisfies ToolResult<never>,
        { status },
      );

    if (url.pathname === '/api/v1/sessions' && request.method === 'POST') {
      const id = env.DESIGN_SESSION.newUniqueId();
      const stub = env.DESIGN_SESSION.get(id);
      const forward = new Request(request, { headers: new Headers(request.headers) });
      forward.headers.set('x-new-session', '1');
      forward.headers.set('x-session-id', id.toString());
      forward.headers.set('x-request-id', requestId);
      const response = await stub.fetch(forward);
      return new Response(response.body, response);
    }

    if (!url.pathname.startsWith('/api/v1/sessions/')) {
      return apiError(404, 'NOT_FOUND', 'unknown API route');
    }

    const sessionId = url.pathname.split('/')[4];
    if (!sessionId) return apiError(400, 'INVALID_INPUT', 'session id required');

    const stub = env.DESIGN_SESSION.get(env.DESIGN_SESSION.idFromString(sessionId));
    const metaRes = await stub.fetch(new Request('https://do.internal/__meta'));
    if (!metaRes.ok) return apiError(404, 'SESSION_EXPIRED', 'session does not exist or expired');
    const meta = (await metaRes.json()) as SessionMeta | null;
    if (!meta) return apiError(404, 'SESSION_EXPIRED', 'session does not exist or expired');

    const capability = request.headers.get('x-handshake-capability');
    if (!capability || capability !== meta.capability) {
      return apiError(403, 'ORIGIN_DENIED', 'valid session capability required');
    }

    const subPath = `/${url.pathname.split('/').slice(5).join('/')}`;
    const isHumanRoute =
      subPath.endsWith('/decision') || subPath === '/protected/confirm' || subPath === '/reset';
    let isHumanIntent = false;
    if (isHumanRoute) {
      const intent = request.headers.get(INTENT_HEADER);
      const fetchSite = request.headers.get('sec-fetch-site');
      const origin = request.headers.get('origin');
      const sameOrigin =
        fetchSite === 'same-origin' || (origin !== null && new URL(origin).host === url.host);
      if (intent !== 'human' || !sameOrigin) {
        return apiError(403, 'ORIGIN_DENIED', 'human-only route: explicit in-page intent required');
      }
      isHumanIntent = true;
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > LIMITS.maxBodyBytes) {
      return apiError(413, 'INVALID_INPUT', 'request body exceeds the size limit');
    }

    let bodyText: string | undefined;
    if (request.method === 'POST') {
      bodyText = await request.text();
      if (bodyText.length > LIMITS.maxBodyBytes) {
        return apiError(413, 'INVALID_INPUT', 'request body exceeds the size limit');
      }
      try {
        JSON.parse(bodyText);
      } catch {
        return apiError(400, 'INVALID_INPUT', 'request body must be valid JSON');
      }
    }

    const forward = new Request('https://do.internal' + url.pathname, {
      method: request.method,
      ...(bodyText !== undefined ? { body: bodyText } : {}),
      headers: {
        'content-type': 'application/json',
        'x-session-id': sessionId,
        'x-request-id': requestId,
        'x-idempotency-key': request.headers.get('idempotency-key') ?? '',
        'x-handshake-intent': isHumanIntent ? 'human' : 'agent',
      },
    });
    const response = await stub.fetch(forward);
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;

/**
 * Authoritative per-session state holder. Owns the committed room version,
 * pending proposals, protected-action confirmations, the idempotency ledger,
 * and append-only audit events. See ADR-0001 and docs/CONSENT-PROTOCOL.md.
 */
export class DesignSession extends DurableObject<Env> {
  private storageLike: StorageLike;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const storage = ctx.storage;
    this.storageLike = {
      async get<T>(key: string): Promise<T | undefined> {
        return storage.get<T>(key);
      },
      async put(key: string, value: unknown): Promise<void> {
        await storage.put(key, value);
      },
      async delete(key: string): Promise<void> {
        await storage.delete(key);
      },
      async list<T>(prefix: string): Promise<Map<string, T>> {
        const map = await storage.list<T>({ prefix });
        return map as Map<string, T>;
      },
    };
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = request.headers.get('x-session-id') ?? '';
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    const isNew = request.headers.get('x-new-session') === '1';
    const method = request.method;

    if (isNew && method === 'POST') {
      const result = await this.ctx.blockConcurrencyWhile(async () => {
        const created = await createSession(this.storageLike, sessionId);
        if (created.created) {
          const alarm = await this.ctx.storage.getAlarm();
          if (alarm === null) await this.ctx.storage.setAlarm(Date.now() + 60_000);
        }
        const { room, capability } = created;
        const envelope: ToolResult<{ sessionId: string; capability: string; room: RoomState }> = {
          ok: true,
          data: { sessionId, capability, room },
          requestId,
        };
        return new Response(JSON.stringify(envelope), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      });
      return result;
    }

    let body: unknown;
    if (method === 'POST') {
      const text = await request.text();
      try {
        body = text.length === 0 ? {} : JSON.parse(text);
      } catch {
        const envelope: ToolResult<never> = {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'request body must be valid JSON',
            retryable: false,
          },
          requestId,
        };
        return Response.json(envelope, { status: 400 });
      }
    }

    const subPath = url.pathname.replace(/^\/api\/v1\/sessions\/[^/]+/, '') || '/';
    const ctx = {
      sessionId,
      requestId,
      idempotencyKey: request.headers.get('x-idempotency-key') || undefined,
      isHumanIntent: request.headers.get('x-handshake-intent') === 'human',
      query: url.searchParams,
      now: new Date(),
    };
    const { status, envelope } = await routeRequest(this.storageLike, method, subPath, ctx, body);
    return Response.json(envelope, {
      status,
      headers: { 'x-handshake-request-id': requestId },
    });
  }

  override async alarm(): Promise<void> {
    const now = new Date();
    await sweep(this.storageLike, now);
    const meta = await this.storageLike.get<SessionMeta>('meta');
    if (
      meta &&
      now.getTime() > new Date(meta.createdAt).getTime() + LIMITS.sessionTtlSeconds * 1000
    ) {
      await this.ctx.storage.deleteAll();
      return;
    }
    const next = now.getTime() + 60_000;
    const current = await this.ctx.storage.getAlarm();
    if (current === null) await this.ctx.storage.setAlarm(next);
  }
}
