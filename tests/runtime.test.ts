import { describe, expect, it } from 'vitest';
import { LIMITS } from '@handshake/contracts';
import { parseApiRoute, readBoundedJson } from '../apps/worker/src/runtime-utils';

/** Exercises the outer runtime boundary without requiring a deployed Worker. */
describe('same-origin API router', () => {
  it('parses one exact session resource', () => {
    expect(parseApiRoute('/api/v1/sessions/s-1/state')).toEqual({
      sessionId: 's-1',
      resource: 'state',
    });
  });

  it('refuses extra path segments', () => {
    expect(parseApiRoute('/api/v1/sessions/s-1/state/other')).toBeNull();
  });

  it('does not interpret an encoded slash as a route separator', () => {
    expect(parseApiRoute('/api/v1/sessions/a%2Fb/state')).toEqual({
      sessionId: 'a/b',
      resource: 'state',
    });
  });

  it('fails closed on malformed percent encoding', () => {
    expect(parseApiRoute('/api/v1/sessions/%zz/state')).toBeNull();
  });
});

describe('body limits and safe failures', () => {
  it('accepts a small JSON body', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ value: 1 }),
    });
    await expect(readBoundedJson(request)).resolves.toEqual({ value: 1 });
  });

  it('rejects a body larger than the hard limit', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      body: 'x'.repeat(LIMITS.maxBodyBytes + 1),
    });
    await expect(readBoundedJson(request)).rejects.toThrow(RangeError);
  });

  it('rejects an oversized streamed body without a content-length header', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(LIMITS.maxBodyBytes + 1)));
        controller.close();
      },
    });
    const request = new Request('https://example.test', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    expect(request.headers.has('content-length')).toBe(false);
    await expect(readBoundedJson(request)).rejects.toThrow(RangeError);
  });

  it('rejects malformed JSON without recovering unsafely', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      body: '{not-json',
    });
    await expect(readBoundedJson(request)).rejects.toThrow(SyntaxError);
  });
});

describe('CORS and preflight headers', () => {
  it('responds to OPTIONS preflight on /api/* routes with 204 and CORS headers', async () => {
    const { routeRequest } = await import('../apps/worker/src/index');
    const env = {} as Parameters<typeof routeRequest>[1];
    const response = await routeRequest(
      new Request('https://example.test/api/v1/catalog', { method: 'OPTIONS' }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'x-handshake-capability',
    );
  });

  it('includes CORS headers on GET /api/v1/catalog response', async () => {
    const { routeRequest } = await import('../apps/worker/src/index');
    const env = {} as Parameters<typeof routeRequest>[1];
    const response = await routeRequest(
      new Request('https://example.test/api/v1/catalog', { method: 'GET' }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('Durable Object session rate limiting', () => {
  it('enforces RATE_LIMITED 429 when write ceiling is exceeded', async () => {
    const { DesignSession } = await import('../apps/worker/src/index');
    const store = new Map<string, unknown>();
    const mockCtx = {
      blockConcurrencyWhile: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
      storage: {
        get: async <T>(key: string): Promise<T | undefined> => store.get(key) as T,
        put: async <T>(key: string, val: T): Promise<void> => {
          store.set(key, val);
        },
        setAlarm: async (): Promise<void> => {},
      },
    };
    const session = new DesignSession(mockCtx as unknown as any, {} as any);

    // Initialize session
    const initReq = new Request('https://session.internal/init', {
      method: 'POST',
      headers: {
        'x-handshake-internal': 'init',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'sess-rate-1',
        capability: 'cap-rate-secret-12345',
        roomType: 'bathroom',
      }),
    });
    const initRes = await session.fetch(initReq);
    expect(initRes.status).toBe(201);

    // Send 60 writes (the maximum allowed per minute)
    for (let i = 0; i < LIMITS.maxWritesPerMinute; i++) {
      const confirmReq = new Request('https://session.internal/confirmations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 'sess-rate-1',
          'x-handshake-capability': 'cap-rate-secret-12345',
          'x-handshake-actor': 'human_ui',
        },
        body: JSON.stringify({
          action: 'request_quote',
          payload: { fixture: 'harbor-vanity' },
        }),
      });
      const res = await session.fetch(confirmReq);
      expect(res.status).toBe(201);
    }

    // 61st write must be rate limited
    const rateLimitedReq = new Request('https://session.internal/confirmations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-route-session': 'sess-rate-1',
        'x-handshake-capability': 'cap-rate-secret-12345',
        'x-handshake-actor': 'human_ui',
      },
      body: JSON.stringify({
        action: 'request_quote',
        payload: { fixture: 'harbor-vanity' },
      }),
    });
    const rateLimitedRes = await session.fetch(rateLimitedReq);
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.headers.get('Retry-After')).toBe('5');
    const payload = (await rateLimitedRes.json()) as any;
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('RATE_LIMITED');
    expect(payload.error.retryable).toBe(true);
  });
});
