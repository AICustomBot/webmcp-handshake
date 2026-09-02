import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '@handshake/contracts';
import { healthResponse } from '../apps/worker/src/health';
import { routeRequest } from '../apps/worker/src/index';

describe('release health endpoint', () => {
  it('returns only public liveness metadata', async () => {
    const response = healthResponse(new Request('https://example.test/healthz'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'handshake',
      contractVersion: CONTRACT_VERSION,
    });
  });

  it('routes health checks without invoking static assets', async () => {
    let assetCalls = 0;
    const env = {
      ASSETS: {
        fetch() {
          assetCalls += 1;
          return Promise.resolve(new Response('asset'));
        },
      },
    } as unknown as Parameters<typeof routeRequest>[1];
    const response = await routeRequest(new Request('https://example.test/healthz'), env);
    expect(assetCalls).toBe(0);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: 'handshake',
      contractVersion: CONTRACT_VERSION,
    });
  });

  it('rejects non-GET methods', () => {
    const response = healthResponse(
      new Request('https://example.test/healthz', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
