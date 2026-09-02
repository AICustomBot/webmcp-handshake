import { describe, expect, it } from 'vitest';
import { LIMITS } from '@handshake/contracts';
import type { Operation, Product, Proposal, RoomState } from '@handshake/contracts';
import {
  canonicalize,
  checkIdempotency,
  evaluateDesign,
  mayApply,
  mayApplyWithHash,
  proposalHash,
  validateOperations,
} from '@handshake/policy';

const state: RoomState = {
  sessionId: 's1',
  version: 4,
  widthIn: 108,
  lengthIn: 132,
  budgetCents: 1400000,
  items: [],
};

const approved: Proposal = {
  id: 'p1',
  sessionId: 's1',
  baseVersion: 4,
  hash: 'h1',
  status: 'approved',
  operations: [],
  rationale: 'Synthetic fixture.',
  createdAt: '2026-09-02T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
};

const catalog: Product[] = [
  {
    id: 'vanity-harbor',
    name: 'Harbor vanity',
    category: 'vanity',
    finish: 'matte black',
    priceCents: 248000,
    widthIn: 36,
    depthIn: 21,
    clearanceIn: 30,
    accessible: false,
  },
  {
    id: 'shower-open',
    name: 'Open-entry shower',
    category: 'shower',
    finish: 'matte black',
    priceCents: 490000,
    widthIn: 42,
    depthIn: 42,
    clearanceIn: 30,
    accessible: true,
  },
];

const record = {
  key: 'k1',
  requestHash: 'r1',
  resultRef: 'p1',
  createdAt: '2026-09-02T00:00:00Z',
};

describe('proposal gate', () => {
  it('permits a fresh approved proposal', () => {
    expect(mayApply(approved, state).allowed).toBe(true);
  });

  it('rejects a stale base version', () => {
    const decision = mayApply({ ...approved, baseVersion: 3 }, state);
    expect(decision).toEqual({ allowed: false, code: 'VERSION_CONFLICT' });
  });

  it('refuses work the human has not approved', () => {
    const decision = mayApply({ ...approved, status: 'pending_human' }, state);
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_NOT_APPROVED' });
  });

  it('refuses an approved proposal whose review window has closed', () => {
    const stale: Proposal = { ...approved, expiresAt: '2026-09-02T00:10:00Z' };
    const decision = mayApply(stale, state, new Date('2026-09-02T00:11:00Z'));
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_EXPIRED' });
  });

  it('refuses to replay a proposal that was already applied', () => {
    const decision = mayApply({ ...approved, status: 'applied' }, state);
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_ALREADY_APPLIED' });
  });

  it('refuses a rejected proposal', () => {
    const decision = mayApply({ ...approved, status: 'rejected' }, state);
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_REJECTED' });
  });

  it('refuses a proposal belonging to another session', () => {
    const decision = mayApply({ ...approved, sessionId: 's2' }, state);
    expect(decision).toEqual({ allowed: false, code: 'FORBIDDEN_ACTOR' });
  });

  it('binds application to the exact approved hash', () => {
    const decision = mayApplyWithHash({ proposal: approved, state, proposalHash: 'tampered' });
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_HASH_MISMATCH' });
  });
});

describe('canonical hashing', () => {
  it('ignores key order', () => {
    const first = canonicalize({ b: 1, a: [1, 2], c: { y: true, x: null } });
    const second = canonicalize({ c: { x: null, y: true }, a: [1, 2], b: 1 });
    expect(first).toBe(second);
  });

  it('drops undefined members instead of encoding them', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('is stable for the same proposal input', async () => {
    const operations: Operation[] = [{ type: 'remove', itemId: 'i1' }];
    const input = { sessionId: 's1', baseVersion: 4, operations };
    const first = await proposalHash(input);
    const second = await proposalHash(input);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it('changes when the operations change', async () => {
    const first = await proposalHash({
      sessionId: 's1',
      baseVersion: 4,
      operations: [{ type: 'remove', itemId: 'i1' }],
    });
    const second = await proposalHash({
      sessionId: 's1',
      baseVersion: 4,
      operations: [{ type: 'remove', itemId: 'i2' }],
    });
    expect(second).not.toBe(first);
  });

  it('changes when the base version changes', async () => {
    const operations: Operation[] = [{ type: 'remove', itemId: 'i1' }];
    const first = await proposalHash({ sessionId: 's1', baseVersion: 4, operations });
    const second = await proposalHash({ sessionId: 's1', baseVersion: 5, operations });
    expect(second).not.toBe(first);
  });
});

describe('idempotency', () => {
  it('proceeds when the key has never been used', () => {
    expect(checkIdempotency(undefined, 'r1')).toEqual({ outcome: 'proceed' });
  });

  it('replays the stored result for an identical payload', () => {
    expect(checkIdempotency(record, 'r1')).toEqual({ outcome: 'replay', record });
  });

  it('refuses to reuse a key with a different payload', () => {
    const outcome = checkIdempotency(record, 'r2');
    expect(outcome).toEqual({ outcome: 'conflict', code: 'IDEMPOTENCY_CONFLICT' });
  });
});

describe('operation validation', () => {
  it('refuses an empty operation list', () => {
    expect(validateOperations([])).toEqual({ allowed: false, code: 'INVALID_INPUT' });
  });

  it('refuses more operations than the contract allows', () => {
    const many: Operation[] = [];
    for (let i = 0; i <= LIMITS.maxOperationsPerProposal; i += 1) {
      many.push({ type: 'remove', itemId: `i${i}` });
    }
    expect(validateOperations(many)).toEqual({ allowed: false, code: 'LIMIT_EXCEEDED' });
  });

  it('refuses a placement outside the supported coordinate range', () => {
    const operations: Operation[] = [
      { type: 'place', productId: 'vanity-harbor', x: -4, y: 0, rotation: 0 },
    ];
    expect(validateOperations(operations)).toEqual({ allowed: false, code: 'INVALID_INPUT' });
  });
});

describe('deterministic evaluation', () => {
  it('reports an empty room as clean', () => {
    const evaluation = evaluateDesign(state, catalog);
    expect(evaluation.committedCents).toBe(0);
    expect(evaluation.overBudget).toBe(false);
    expect(evaluation.findings).toEqual([]);
  });

  it('blocks overlapping fixtures', () => {
    const occupied: RoomState = {
      ...state,
      items: [
        { id: 'i1', productId: 'vanity-harbor', x: 10, y: 10, rotation: 0 },
        { id: 'i2', productId: 'shower-open', x: 20, y: 12, rotation: 0 },
      ],
    };
    const codes = evaluateDesign(occupied, catalog).findings.map((finding) => finding.code);
    expect(codes).toContain('FIXTURE_OVERLAP');
  });

  it('warns when approach space is blocked', () => {
    const tight: RoomState = {
      ...state,
      items: [
        { id: 'i1', productId: 'vanity-harbor', x: 0, y: 0, rotation: 0 },
        { id: 'i2', productId: 'shower-open', x: 0, y: 25, rotation: 0 },
      ],
    };
    const codes = evaluateDesign(tight, catalog).findings.map((finding) => finding.code);
    expect(codes).toContain('CLEARANCE_WARNING');
  });

  it('flags an item that is not in the synthetic catalog', () => {
    const unknown: RoomState = {
      ...state,
      items: [{ id: 'i1', productId: 'not-real', x: 0, y: 0, rotation: 0 }],
    };
    const codes = evaluateDesign(unknown, catalog).findings.map((finding) => finding.code);
    expect(codes).toContain('UNKNOWN_PRODUCT');
  });
});
