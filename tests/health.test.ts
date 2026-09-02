import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '@handshake/contracts';
import { healthResponse } from '../apps/worker/src/health';

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

  it('rejects non-GET methods', () => {
    const response = healthResponse(
      new Request('https://example.test/healthz', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
