import { describe, expect, it } from 'vitest';
import { LIMITS } from '@handshake/contracts';
import { DesignSession } from '../apps/worker/src/index';

function mockSessionContext() {
  const store = new Map<string, unknown>();
  return {
    blockConcurrencyWhile: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
    storage: {
      get: async <T>(key: string): Promise<T | undefined> => store.get(key) as T,
      put: async <T>(key: string, val: T): Promise<void> => {
        store.set(key, val);
      },
      setAlarm: async (): Promise<void> => {},
    },
  };
}

describe('Constitutional Adversarial Hardening Suite', () => {
  it('CP-1: Agent channel cannot approve a proposal (FORBIDDEN_ACTOR)', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-1', capability: 'cap-adv-1' }),
      }),
    );

    // Create a real proposal
    const propRes = await session.fetch(
      new Request('https://session.internal/proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-1',
          'x-handshake-capability': 'cap-adv-1',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({
          idempotencyKey: 'k-adv-prop-1',
          expectedVersion: 0,
          rationale: 'Test',
          operations: [{ type: 'place', productId: 'harbor-vanity', x: 10, y: 10, rotation: 0 }],
        }),
      }),
    );
    const propData = (await propRes.json()) as any;
    const proposalId = propData.data.proposal.id;
    const proposalHash = propData.data.proposal.hash;

    // Agent attempts to call decisions endpoint
    const res = await session.fetch(
      new Request('https://session.internal/decisions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-1',
          'x-handshake-capability': 'cap-adv-1',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({ proposalId, proposalHash, outcome: 'approve' }),
      }),
    );
    expect(res.status).toBe(403);
    const payload = (await res.json()) as any;
    expect(payload.error.code).toBe('FORBIDDEN_ACTOR');
  });

  it('CP-2: Proposal cannot be applied without human approval (PROPOSAL_NOT_APPROVED)', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-2', capability: 'cap-adv-2' }),
      }),
    );

    // Create a pending proposal
    const propRes = await session.fetch(
      new Request('https://session.internal/proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-2',
          'x-handshake-capability': 'cap-adv-2',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({
          idempotencyKey: 'k-adv-1',
          expectedVersion: 0,
          rationale: 'Test',
          operations: [{ type: 'place', productId: 'harbor-vanity', x: 10, y: 10, rotation: 0 }],
        }),
      }),
    );
    const propData = (await propRes.json()) as any;
    const proposalId = propData.data.proposal.id;
    const proposalHash = propData.data.proposal.hash;

    // Directly attempt to apply without approval
    const applyRes = await session.fetch(
      new Request('https://session.internal/apply', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-2',
          'x-handshake-capability': 'cap-adv-2',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({
          idempotencyKey: 'k-adv-apply',
          expectedVersion: 0,
          proposalId,
          proposalHash,
        }),
      }),
    );
    expect(applyRes.status).toBe(403);
    const applyPayload = (await applyRes.json()) as any;
    expect(applyPayload.error.code).toBe('PROPOSAL_NOT_APPROVED');
  });

  it('CP-3: Tampered proposal hash during approval fails closed (PROPOSAL_HASH_MISMATCH)', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-3', capability: 'cap-adv-3' }),
      }),
    );

    const propRes = await session.fetch(
      new Request('https://session.internal/proposals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-3',
          'x-handshake-capability': 'cap-adv-3',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({
          idempotencyKey: 'k-adv-3',
          expectedVersion: 0,
          rationale: 'Test',
          operations: [{ type: 'place', productId: 'harbor-vanity', x: 10, y: 10, rotation: 0 }],
        }),
      }),
    );
    const propData = (await propRes.json()) as any;
    const proposalId = propData.data.proposal.id;

    // Approve with forged hash
    const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const decideRes = await session.fetch(
      new Request('https://session.internal/decisions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-3',
          'x-handshake-capability': 'cap-adv-3',
          'x-handshake-actor': 'human_ui',
        },
        body: JSON.stringify({
          proposalId,
          proposalHash: fakeHash,
          outcome: 'approve',
        }),
      }),
    );
    expect(decideRes.status).toBe(409);
    const decidePayload = (await decideRes.json()) as any;
    expect(decidePayload.error.code).toBe('PROPOSAL_HASH_MISMATCH');
  });

  it('CP-4: Protected action replay fails closed (CONFIRMATION_REQUIRED)', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-4', capability: 'cap-adv-4' }),
      }),
    );

    // Issue confirmation
    const confRes = await session.fetch(
      new Request('https://session.internal/confirmations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-4',
          'x-handshake-capability': 'cap-adv-4',
          'x-handshake-actor': 'human_ui',
        },
        body: JSON.stringify({
          action: 'request_quote',
          payload: { item: 'tub' },
        }),
      }),
    );
    const confData = (await confRes.json()) as any;
    const confirmationId = confData.data.confirmation.id;
    const proof = confData.data.proof;

    // First redemption succeeds
    const actRes1 = await session.fetch(
      new Request('https://session.internal/protected-actions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-4',
          'x-handshake-capability': 'cap-adv-4',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({
          idempotencyKey: 'k-adv-act-1',
          action: 'request_quote',
          payload: { item: 'tub' },
          confirmationId,
          proof,
        }),
      }),
    );
    expect(actRes1.status).toBe(200);

    // Replayed redemption must fail closed
    const actRes2 = await session.fetch(
      new Request('https://session.internal/protected-actions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-4',
          'x-handshake-capability': 'cap-adv-4',
          'x-handshake-actor': 'agent',
        },
        body: JSON.stringify({
          idempotencyKey: 'k-adv-act-2',
          action: 'request_quote',
          payload: { item: 'tub' },
          confirmationId,
          proof,
        }),
      }),
    );
    expect(actRes2.status).toBe(428);
    const actPayload2 = (await actRes2.json()) as any;
    expect(actPayload2.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('CP-5: Receipt redacts sensitive capability secrets and single-use proofs', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    const secretCap = 'ultra-secret-capability-token-99999';
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-5', capability: secretCap }),
      }),
    );

    const receiptRes = await session.fetch(
      new Request('https://session.internal/receipt', {
        method: 'GET',
        headers: {
          'x-route-session': 's-adv-5',
          'x-handshake-capability': secretCap,
        },
      }),
    );
    expect(receiptRes.status).toBe(200);
    const receiptText = await receiptRes.text();
    expect(receiptText).not.toContain(secretCap);
  });

  it('CP-6: Adversarial write flooding triggers token bucket rate limit (429 RATE_LIMITED)', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-6', capability: 'cap-adv-6' }),
      }),
    );

    // Flood with writes beyond LIMITS.maxWritesPerMinute (60)
    for (let i = 0; i < LIMITS.maxWritesPerMinute; i++) {
      await session.fetch(
        new Request('https://session.internal/edits', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-route-session': 's-adv-6',
            'x-handshake-capability': 'cap-adv-6',
            'x-handshake-actor': 'human_ui',
          },
          body: JSON.stringify({ expectedVersion: 0, operations: [] }),
        }),
      );
    }

    // Write #61 must be rejected with 429
    const blocked = await session.fetch(
      new Request('https://session.internal/edits', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-6',
          'x-handshake-capability': 'cap-adv-6',
          'x-handshake-actor': 'human_ui',
        },
        body: JSON.stringify({ expectedVersion: 0, operations: [] }),
      }),
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('5');
    const blockedPayload = (await blocked.json()) as any;
    expect(blockedPayload.error.code).toBe('RATE_LIMITED');
  });

  it('CP-7: Oversized body > 32 KiB is rejected with early stream termination (LIMIT_EXCEEDED)', async () => {
    const session = new DesignSession(mockSessionContext() as unknown as any, {} as any);
    await session.fetch(
      new Request('https://session.internal/init', {
        method: 'POST',
        headers: { 'x-handshake-internal': 'init', 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's-adv-7', capability: 'cap-adv-7' }),
      }),
    );

    const oversizedPayload = JSON.stringify({
      expectedVersion: 0,
      operations: [],
      padding: 'x'.repeat(LIMITS.maxBodyBytes + 1024),
    });

    const res = await session.fetch(
      new Request('https://session.internal/edits', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-route-session': 's-adv-7',
          'x-handshake-capability': 'cap-adv-7',
          'x-handshake-actor': 'human_ui',
        },
        body: oversizedPayload,
      }),
    );
    expect(res.status).toBe(413);
    const payload = (await res.json()) as any;
    expect(payload.error.code).toBe('LIMIT_EXCEEDED');
  });
});
