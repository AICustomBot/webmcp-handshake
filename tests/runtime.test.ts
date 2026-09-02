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

  it('rejects malformed JSON without recovering unsafely', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      body: '{not-json',
    });
    await expect(readBoundedJson(request)).rejects.toThrow(SyntaxError);
  });
});
