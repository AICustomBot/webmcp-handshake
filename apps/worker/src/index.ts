import { DurableObject } from 'cloudflare:workers';

export interface Env {
  ASSETS: Fetcher;
  DESIGN_SESSION: DurableObjectNamespace<DesignSession>;
}

/**
 * Edge entry point. Static assets are served directly; every /api/* route is
 * reserved for the governed session API implemented in HSK-03.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    return Response.json(
      {
        ok: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Architecture scaffold only.',
          retryable: false,
        },
      },
      { status: 501 },
    );
  },
} satisfies ExportedHandler<Env>;

/**
 * Authoritative per-session state holder. Owns the committed room version,
 * pending proposals, protected-action confirmations, the idempotency ledger,
 * and append-only audit events. See ADR-0001 and docs/CONSENT-PROTOCOL.md.
 */
export class DesignSession extends DurableObject<Env> {
  async fetch(): Promise<Response> {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Implement from frozen contracts.',
          retryable: false,
        },
      },
      { status: 501 },
    );
  }
}
