import { describe, expect, it } from 'vitest';
import { CATALOG, LIMITS } from '../packages/contracts/src/index';
import type { RoomState } from '../packages/contracts/src/index';
import {
  applyOperations,
  budgetStatus,
  mayApply,
  mayConfirm,
  validateProposalOperations,
} from '../packages/policy/src/index';

const state: RoomState = {
  sessionId: 's',
  version: 4,
  widthIn: 108,
  lengthIn: 132,
  budgetCents: 1400000,
  items: [],
};
const base = {
  id: 'p',
  baseVersion: 4,
  hash: 'h',
  status: 'approved' as const,
  operations: [],
  createdAt: '2026-09-02T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
};
const vanityPlace = {
  type: 'place' as const,
  productId: 'vanity-60-double',
  x: 0,
  y: 0,
  rotation: 0 as const,
};

describe('proposal gate', () => {
  it('permits fresh approved proposal', () => expect(mayApply(base, state).allowed).toBe(true));
  it('rejects stale version', () =>
    expect(mayApply({ ...base, baseVersion: 3 }, state)).toEqual({
      allowed: false,
      code: 'VERSION_CONFLICT',
    }));
});

describe('applyOperations', () => {
  it('applies place: bumps version, allocates the next item id and commits budget', () => {
    const result = applyOperations(state, CATALOG, [vanityPlace]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.version).toBe(5);
    expect(result.room.items).toEqual([
      { id: 'item-1', productId: 'vanity-60-double', x: 0, y: 0, rotation: 0 },
    ]);
    expect(budgetStatus(result.room, CATALOG).committedCents).toBe(189900);
  });
  it('does not mutate the input room', () => {
    applyOperations(state, CATALOG, [vanityPlace]);
    expect(state.version).toBe(4);
    expect(state.items).toEqual([]);
  });
  it('rejects move of a missing item', () => {
    expect(
      applyOperations(state, CATALOG, [
        { type: 'move', itemId: 'item-9', x: 1, y: 1, rotation: 0 },
      ]),
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });
  it('rejects place of an unknown product', () => {
    expect(applyOperations(state, CATALOG, [{ ...vanityPlace, productId: 'ghost-sauna' }])).toEqual(
      { ok: false, code: 'INVALID_INPUT' },
    );
  });
});

describe('validateProposalOperations', () => {
  it('projects committed cents for a valid proposal', () => {
    expect(validateProposalOperations(state, CATALOG, [vanityPlace])).toEqual({
      ok: true,
      projectedCents: 189900,
    });
  });
  it('rejects more than the operation limit', () => {
    const ops = Array.from({ length: LIMITS.maxOperationsPerProposal + 1 }, () => vanityPlace);
    expect(validateProposalOperations(state, CATALOG, ops)).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
    });
  });
  it('rejects an empty operation list', () => {
    expect(validateProposalOperations(state, CATALOG, [])).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
    });
  });
  it('rejects malformed operations', () => {
    expect(validateProposalOperations(state, CATALOG, [{ type: 'teleport' }])).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
    });
    expect(validateProposalOperations(state, CATALOG, [{ ...vanityPlace, rotation: 45 }])).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
    });
  });
  it('blocks projections over budget', () => {
    const tight = { ...state, budgetCents: 50000 };
    expect(validateProposalOperations(tight, CATALOG, [vanityPlace])).toEqual({
      ok: false,
      code: 'POLICY_BLOCKED',
    });
  });
});

describe('mayConfirm', () => {
  const digest = 'a'.repeat(64);
  const record = (overrides: Partial<{ used: boolean; expiresAt: string }> = {}) => ({
    actionDigest: digest,
    expiresAt: '2099-01-01T00:00:00Z',
    used: false,
    ...overrides,
  });
  it('permits a fresh unused confirmation with a matching digest', () => {
    expect(mayConfirm(record(), digest)).toEqual({ allowed: true });
  });
  it('rejects expired confirmations', () => {
    expect(mayConfirm(record({ expiresAt: '2000-01-01T00:00:00Z' }), digest)).toEqual({
      allowed: false,
      code: 'CONFIRMATION_EXPIRED',
    });
  });
  it('rejects already used confirmations', () => {
    expect(mayConfirm(record({ used: true }), digest)).toEqual({
      allowed: false,
      code: 'CONFIRMATION_ALREADY_USED',
    });
  });
  it('rejects digest mismatch', () => {
    expect(mayConfirm(record(), 'b'.repeat(64))).toEqual({
      allowed: false,
      code: 'DIGEST_MISMATCH',
    });
  });
});
