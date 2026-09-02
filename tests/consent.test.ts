import { describe, expect, it } from 'vitest';
import type { Actor, Confirmation, Operation, Proposal, RoomState } from '@handshake/contracts';
import {
  applyOperations,
  mayCreateProposal,
  mayDecide,
  mayPerformProtectedAction,
  statusAfterCommittedChange,
  statusAfterExpiry,
} from '@handshake/policy';

const state: RoomState = {
  sessionId: 's1',
  version: 4,
  widthIn: 108,
  lengthIn: 132,
  budgetCents: 1400000,
  items: [],
};

const human: Actor = { kind: 'human_ui', sessionId: 's1' };
const agent: Actor = { kind: 'agent', sessionId: 's1' };

const pending: Proposal = {
  id: 'p1',
  sessionId: 's1',
  baseVersion: 4,
  hash: 'h1',
  status: 'pending_human',
  operations: [{ type: 'remove', itemId: 'i1' }],
  rationale: 'Synthetic fixture.',
  createdAt: '2026-09-02T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
};

const confirmation: Confirmation = {
  id: 'c1',
  sessionId: 's1',
  action: 'book_consultation',
  payloadHash: 'ph1',
  createdAt: '2026-09-02T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
};

const nextItemId = (index: number) => `i${index}`;

describe('page-owned consent', () => {
  it('lets the human decide a pending proposal', () => {
    const decision = mayDecide({ proposal: pending, actor: human, proposalHash: 'h1' });
    expect(decision.allowed).toBe(true);
  });

  it('never lets an agent approve its own proposal', () => {
    const decision = mayDecide({ proposal: pending, actor: agent, proposalHash: 'h1' });
    expect(decision).toEqual({ allowed: false, code: 'FORBIDDEN_ACTOR' });
  });

  it('never lets one session decide another session proposal', () => {
    const outsider: Actor = { kind: 'human_ui', sessionId: 's2' };
    const decision = mayDecide({ proposal: pending, actor: outsider, proposalHash: 'h1' });
    expect(decision).toEqual({ allowed: false, code: 'FORBIDDEN_ACTOR' });
  });

  it('binds the decision to the exact reviewed hash', () => {
    const decision = mayDecide({ proposal: pending, actor: human, proposalHash: 'tampered' });
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_HASH_MISMATCH' });
  });

  it('refuses to decide the same proposal twice', () => {
    const decided: Proposal = { ...pending, status: 'approved' };
    const decision = mayDecide({ proposal: decided, actor: human, proposalHash: 'h1' });
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_ALREADY_DECIDED' });
  });

  it('refuses to decide an expired proposal', () => {
    const stale: Proposal = { ...pending, expiresAt: '2026-09-02T00:10:00Z' };
    const decision = mayDecide({
      proposal: stale,
      actor: human,
      proposalHash: 'h1',
      now: new Date('2026-09-02T00:11:00Z'),
    });
    expect(decision).toEqual({ allowed: false, code: 'PROPOSAL_EXPIRED' });
  });
});

describe('protected actions', () => {
  it('fails closed when no confirmation exists', () => {
    const decision = mayPerformProtectedAction({
      actor: agent,
      action: 'book_consultation',
      payloadHash: 'ph1',
    });
    expect(decision).toEqual({ allowed: false, code: 'CONFIRMATION_REQUIRED' });
  });

  it('allows the action once the human confirmed the exact payload', () => {
    const decision = mayPerformProtectedAction({
      actor: agent,
      action: 'book_consultation',
      payloadHash: 'ph1',
      confirmation,
    });
    expect(decision.allowed).toBe(true);
  });

  it('refuses a confirmation issued for a different payload', () => {
    const decision = mayPerformProtectedAction({
      actor: agent,
      action: 'book_consultation',
      payloadHash: 'ph2',
      confirmation,
    });
    expect(decision).toEqual({ allowed: false, code: 'CONFIRMATION_REQUIRED' });
  });

  it('refuses a confirmation issued for a different action', () => {
    const decision = mayPerformProtectedAction({
      actor: agent,
      action: 'request_quote',
      payloadHash: 'ph1',
      confirmation,
    });
    expect(decision).toEqual({ allowed: false, code: 'CONFIRMATION_REQUIRED' });
  });

  it('refuses a confirmation that was already consumed', () => {
    const used: Confirmation = { ...confirmation, consumedAt: '2026-09-02T00:05:00Z' };
    const decision = mayPerformProtectedAction({
      actor: agent,
      action: 'book_consultation',
      payloadHash: 'ph1',
      confirmation: used,
    });
    expect(decision).toEqual({ allowed: false, code: 'CONFIRMATION_REQUIRED' });
  });

  it('refuses an expired confirmation', () => {
    const stale: Confirmation = { ...confirmation, expiresAt: '2026-09-02T00:05:00Z' };
    const decision = mayPerformProtectedAction({
      actor: agent,
      action: 'book_consultation',
      payloadHash: 'ph1',
      confirmation: stale,
      now: new Date('2026-09-02T00:06:00Z'),
    });
    expect(decision).toEqual({ allowed: false, code: 'CONFIRMATION_EXPIRED' });
  });
});

describe('staleness and replay', () => {
  it('supersedes a live proposal when committed state moves', () => {
    expect(statusAfterCommittedChange(pending, 5)).toBe('superseded');
  });

  it('leaves a terminal proposal untouched', () => {
    const rejected: Proposal = { ...pending, status: 'rejected' };
    expect(statusAfterCommittedChange(rejected, 5)).toBe('rejected');
  });

  it('expires a proposal once its window closes', () => {
    const stale: Proposal = { ...pending, expiresAt: '2026-09-02T00:10:00Z' };
    expect(statusAfterExpiry(stale, new Date('2026-09-02T00:11:00Z'))).toBe('expired');
  });

  it('refuses proposal creation against a stale version', () => {
    const decision = mayCreateProposal({
      actor: agent,
      state,
      expectedVersion: 3,
      operations: pending.operations,
      pendingCount: 0,
    });
    expect(decision).toEqual({ allowed: false, code: 'VERSION_CONFLICT' });
  });

  it('refuses proposal creation from a system actor', () => {
    const system: Actor = { kind: 'system', sessionId: 's1' };
    const decision = mayCreateProposal({
      actor: system,
      state,
      expectedVersion: 4,
      operations: pending.operations,
      pendingCount: 0,
    });
    expect(decision).toEqual({ allowed: false, code: 'FORBIDDEN_ACTOR' });
  });
});

describe('state reducer', () => {
  it('increments the version exactly once per applied proposal', () => {
    const operations: Operation[] = [
      { type: 'place', productId: 'vanity-harbor', x: 0, y: 0, rotation: 0 },
    ];
    const result = applyOperations(state, operations, nextItemId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.version).toBe(5);
    expect(result.state.items).toHaveLength(1);
  });

  it('refuses to touch an item that does not exist', () => {
    const operations: Operation[] = [{ type: 'remove', itemId: 'ghost' }];
    const result = applyOperations(state, operations, nextItemId);
    expect(result).toEqual({ ok: false, code: 'INVALID_INPUT' });
  });
});
