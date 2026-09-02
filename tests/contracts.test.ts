import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  LIMITS,
  STABLE_ERROR_CODES,
  canonicalHash,
  canonicalJson,
  newCapability,
  newSessionId,
} from '../packages/contracts/src/index';
import { footprintOf } from '../packages/policy/src/index';

describe('canonicalJson', () => {
  it('is independent of key insertion order', () => {
    const a = canonicalJson({
      sessionId: 's',
      baseVersion: 3,
      operations: [{ type: 'place', productId: 'vanity-60-double', x: 1, y: 2, rotation: 0 }],
    });
    const b = canonicalJson({
      operations: [{ rotation: 0, y: 2, x: 1, productId: 'vanity-60-double', type: 'place' }],
      baseVersion: 3,
      sessionId: 's',
    });
    expect(a).toBe(b);
  });
  it('sorts nested object keys and preserves array order', () => {
    expect(
      canonicalJson([
        { b: 1, a: 2 },
        { d: 3, c: 4 },
      ]),
    ).toBe('[{"a":2,"b":1},{"c":4,"d":3}]');
  });
});

describe('canonicalHash', () => {
  it('is deterministic for equal payloads in different key order', async () => {
    const h1 = await canonicalHash({ b: 1, a: [1, 2] });
    const h2 = await canonicalHash({ a: [1, 2], b: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
  it('differs for different payloads', async () => {
    const h1 = await canonicalHash({ a: 1 });
    const h2 = await canonicalHash({ a: 2 });
    expect(h1).not.toBe(h2);
  });
});

describe('random identifiers', () => {
  it('generates uuid session ids and 32-hex-char capabilities', () => {
    const capability = newCapability();
    expect(newSessionId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(capability).toMatch(/^[0-9a-f]{32}$/);
    expect(newCapability()).not.toBe(capability);
  });
});

describe('limits and error codes', () => {
  it('keeps documented limits', () => {
    expect(LIMITS.maxOperationsPerProposal).toBe(12);
    expect(LIMITS.maxBodyBytes).toBe(32768);
    expect(LIMITS.proposalTtlSeconds).toBe(600);
    expect(LIMITS.confirmationTtlSeconds).toBe(300);
    expect(LIMITS.sessionTtlSeconds).toBe(86400);
  });
  it('exposes unique stable error codes', () => {
    expect(STABLE_ERROR_CODES).toContain('INVALID_INPUT');
    expect(STABLE_ERROR_CODES).toContain('POLICY_BLOCKED');
    expect(STABLE_ERROR_CODES).toContain('ORIGIN_DENIED');
    expect(new Set(STABLE_ERROR_CODES).size).toBe(STABLE_ERROR_CODES.length);
  });
});

describe('catalog', () => {
  it('has at least 8 unique products with positive prices', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CATALOG.map((product) => product.id)).size).toBe(CATALOG.length);
    for (const product of CATALOG) {
      expect(product.priceCents).toBeGreaterThan(0);
      expect(product.widthIn).toBeGreaterThan(0);
      expect(product.lengthIn).toBeGreaterThan(0);
    }
  });
  it('zeroes wall-mount footprints via footprintOf', () => {
    const wallMount = CATALOG.filter((product) => product.wallMount);
    expect(wallMount.length).toBeGreaterThanOrEqual(3);
    for (const product of wallMount) {
      for (const rotation of [0, 90, 180, 270] as const) {
        expect(footprintOf({ x: 10, y: 10, rotation }, product)).toEqual({
          x: 10,
          y: 10,
          w: 0,
          l: 0,
        });
      }
    }
  });
});
