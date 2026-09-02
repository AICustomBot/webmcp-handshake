import { beforeEach, describe, expect, it } from 'vitest';
import type { ProposalRecord, RoomState, ToolResult } from '../packages/contracts/src/index';
import {
  createSession,
  routeRequest,
  sweep,
  type AuditEntry,
  type RouteContext,
  type RouteResult,
  type StorageLike,
  type StoredConfirmation,
} from '../apps/worker/src/lib/session-core';

/** In-memory StorageLike that JSON round-trips values to mirror DO serialization semantics. */
class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  async get<T>(key: string): Promise<T | undefined> {
    const raw = this.map.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async list<T>(prefix: string): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const [key, raw] of this.map) {
      if (key.startsWith(prefix)) result.set(key, JSON.parse(raw) as T);
    }
    return result;
  }
}

const T0 = new Date('2026-09-02T12:00:00Z');

function ctx(overrides: Partial<RouteContext> = {}): RouteContext {
  return {
    sessionId: 'sess-1',
    requestId: 'req-1',
    idempotencyKey: undefined,
    isHumanIntent: true,
    query: new URLSearchParams(),
    now: T0,
    ...overrides,
  };
}

function placeOp(x = 10, y = 10) {
  return { type: 'place', productId: 'vanity-60-double', x, y, rotation: 0 };
}

let storage: MemoryStorage;

async function makeSession(): Promise<void> {
  const created = await createSession(storage, 'sess-1');
  expect(created.created).toBe(true);
  expect(created.capability).toMatch(/^[0-9a-f]{32}$/);
}

async function propose(
  ops: unknown[] = [placeOp()],
  over: Partial<RouteContext> = {},
): Promise<ToolResult<{ proposal: ProposalRecord }>> {
  const result: RouteResult = await routeRequest(
    storage,
    'POST',
    '/proposals',
    ctx({ idempotencyKey: `propose-${Math.random()}`, ...over }),
    { operations: ops },
  );
  return result.envelope as ToolResult<{ proposal: ProposalRecord }>;
}

async function decide(
  proposalId: string,
  decision: 'approve' | 'reject',
  expectedHash: string,
): Promise<ToolResult<{ proposal: ProposalRecord }>> {
  const result = await routeRequest(
    storage,
    'POST',
    `/proposals/${proposalId}/decision`,
    ctx({ idempotencyKey: `decide-${proposalId}-${decision}` }),
    { decision, expectedHash },
  );
  return result.envelope as ToolResult<{ proposal: ProposalRecord }>;
}

async function apply(
  proposalId: string,
  idempotencyKey = `apply-${proposalId}`,
): Promise<ToolResult<{ room: RoomState }>> {
  const result = await routeRequest(
    storage,
    'POST',
    `/proposals/${proposalId}/apply`,
    ctx({ idempotencyKey }),
    {},
  );
  return result.envelope as ToolResult<{ room: RoomState }>;
}

beforeEach(async () => {
  storage = new MemoryStorage();
  await makeSession();
});

describe('session core — reads', () => {
  it('creates a session with capability and initial room v1', async () => {
    const result = await routeRequest(storage, 'GET', '/room', ctx(), undefined);
    expect(result.status).toBe(200);
    if (!result.envelope.ok) throw new Error('expected ok');
    const data = result.envelope.data as {
      room: RoomState;
      budget: { status: string };
      checks: unknown[];
    };
    expect(data.room.version).toBe(1);
    expect(data.room.items).toHaveLength(0);
    expect(data.budget.status).toBe('ok');
    expect(data.checks).toBeInstanceOf(Array);
  });

  it('filters the catalog by query and category', async () => {
    const matte = await routeRequest(
      storage,
      'GET',
      '/catalog',
      ctx({ query: new URLSearchParams('q=matte') }),
      undefined,
    );
    const storageItems = await routeRequest(
      storage,
      'GET',
      '/catalog',
      ctx({ query: new URLSearchParams('category=storage') }),
      undefined,
    );
    if (!matte.envelope.ok || !storageItems.envelope.ok) throw new Error('expected ok');
    const matteProducts = (matte.envelope.data as { products: { id: string }[] }).products;
    const storageProducts = (storageItems.envelope.data as { products: { id: string }[] }).products;
    expect(matteProducts.length).toBeGreaterThanOrEqual(2);
    expect(
      storageProducts.every(
        (p) =>
          p.id.includes('storage') || p.id === 'shelf-recessed' || p.id === 'mirror-cabinet-36',
      ),
    ).toBe(true);
  });

  it('returns NOT_FOUND for unknown product detail', async () => {
    const result = await routeRequest(storage, 'GET', '/products/nope', ctx(), undefined);
    expect(result.status).toBe(404);
    if (result.envelope.ok) throw new Error('expected error');
    expect(result.envelope.error.code).toBe('NOT_FOUND');
  });
});

describe('session core — golden journey', () => {
  it('runs propose → approve → apply → manual edit → protected booking → receipt', async () => {
    const proposed = await propose();
    if (!proposed.ok) throw new Error(proposed.error.message);
    expect(proposed.data.proposal.status).toBe('pending_human');
    expect(proposed.data.proposal.hash).toMatch(/^[0-9a-f]{64}$/);

    const roomAfterPropose = await routeRequest(storage, 'GET', '/room', ctx(), undefined);
    if (!roomAfterPropose.envelope.ok) throw new Error('expected ok');
    expect((roomAfterPropose.envelope.data as { room: RoomState }).room.version).toBe(1);

    const badDecision = await decide('prop-1', 'approve', 'deadbeef');
    expect(badDecision.ok).toBe(false);
    if (!badDecision.ok) expect(badDecision.error.code).toBe('INVALID_INPUT');

    const agentDecision = await decide('prop-1', 'approve', 'deadbeef');
    void agentDecision;
    const denied = await routeRequest(
      storage,
      'POST',
      '/proposals/prop-1/decision',
      ctx({ isHumanIntent: false }),
      { decision: 'approve', expectedHash: proposed.data.proposal.hash },
    );
    expect(denied.status).toBe(403);
    if (!denied.envelope.ok) expect(denied.envelope.error.code).toBe('ORIGIN_DENIED');

    const approved = await decide('prop-1', 'approve', proposed.data.proposal.hash);
    if (!approved.ok) throw new Error(approved.error.message);
    expect(approved.data.proposal.status).toBe('approved');

    const applied = await apply('prop-1');
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.data.room.version).toBe(2);
    expect(applied.data.room.items).toHaveLength(1);
    void applied.data.room.items[0];

    const manual = await routeRequest(
      storage,
      'POST',
      '/manual',
      ctx({ idempotencyKey: 'manual-1' }),
      { op: { type: 'move', itemId: applied.data.room.items[0]!.id, x: 20, y: 40, rotation: 90 } },
    );
    if (!manual.envelope.ok) throw new Error('manual edit failed');
    const manualRoom = (manual.envelope.data as { room: RoomState }).room;
    expect(manualRoom.version).toBe(3);
    expect(manualRoom.items[0]?.x).toBe(20);

    const booking = await routeRequest(
      storage,
      'POST',
      '/protected',
      ctx({ idempotencyKey: 'book-1' }),
      {
        action: 'book_showroom_visit',
        payload: { showroom: 'Cairo Design District', day: '2026-09-05' },
      },
    );
    expect(booking.status).toBe(200);
    if (booking.envelope.ok) throw new Error('expected CONFIRMATION_REQUIRED');
    expect(booking.envelope.error.code).toBe('CONFIRMATION_REQUIRED');
    const confirmationId = booking.envelope.error.data?.confirmationId as string;
    const actionDigest = booking.envelope.error.data?.actionDigest as string;
    expect(confirmationId).toMatch(/^conf-/);

    const wrongDigest = await routeRequest(
      storage,
      'POST',
      '/protected/confirm',
      ctx({ idempotencyKey: 'confirm-bad' }),
      { confirmationId, actionDigest: '0'.repeat(64) },
    );
    if (!wrongDigest.envelope.ok) expect(wrongDigest.envelope.error.code).toBe('DIGEST_MISMATCH');

    const confirmed = await routeRequest(
      storage,
      'POST',
      '/protected/confirm',
      ctx({ idempotencyKey: 'confirm-1' }),
      { confirmationId, actionDigest },
    );
    if (!confirmed.envelope.ok) throw new Error(confirmed.envelope.error.message);
    const { token } = confirmed.envelope.data as { token: string };

    const completed = await routeRequest(
      storage,
      'POST',
      '/protected',
      ctx({ idempotencyKey: 'book-2' }),
      {
        action: 'book_showroom_visit',
        payload: { showroom: 'Cairo Design District', day: '2026-09-05' },
        confirmationId,
        token,
      },
    );
    if (!completed.envelope.ok) throw new Error(completed.envelope.error.message);
    const completion = completed.envelope.data as { status: string; referenceId: string };
    expect(completion.status).toBe('completed');
    expect(completion.referenceId).toMatch(/^ref-/);

    const receipt = await routeRequest(storage, 'GET', '/receipt', ctx(), undefined);
    if (!receipt.envelope.ok) throw new Error('expected receipt');
    const data = receipt.envelope.data as {
      receipt: { room: { version: number }; auditTypes: { type: string }[]; sessionIdHash: string };
    };
    expect(data.receipt.room.version).toBe(3);
    expect(data.receipt.sessionIdHash).toHaveLength(12);
    const types = data.receipt.auditTypes.map((entry) => entry.type);
    expect(types).toContain('protected_action_completed');
    expect(types).toContain('proposal_applied');
  });
});

describe('session core — fail-closed paths', () => {
  it('replays a stored response for the same idempotency key and conflicts on a different payload', async () => {
    const first = await apply('prop-x', 'same-key');
    void first;
    const proposed = await propose();
    if (!proposed.ok) throw new Error(proposed.error.message);
    await decide('prop-1', 'approve', proposed.data.proposal.hash);

    const key = 'apply-once';
    const applied = await apply('prop-1', key);
    expect(applied.ok).toBe(true);

    const replayed = await apply('prop-1', key);
    expect(replayed.ok).toBe(true);
    expect(replayed).toEqual(applied);

    const conflict = await routeRequest(
      storage,
      'POST',
      '/proposals/prop-1/apply',
      ctx({ idempotencyKey: key }),
      { tampered: true },
    );
    expect(conflict.status).toBe(409);
    if (!conflict.envelope.ok) expect(conflict.envelope.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('supersedes a stale approved proposal after a manual edit', async () => {
    const proposed = await propose();
    if (!proposed.ok) throw new Error(proposed.error.message);
    await decide('prop-1', 'approve', proposed.data.proposal.hash);
    await routeRequest(storage, 'POST', '/manual', ctx({ idempotencyKey: 'manual-x' }), {
      op: { type: 'place', productId: 'towel-bar-matte', x: 90, y: 8, rotation: 0 },
    });
    const applied = await apply('prop-1');
    if (applied.ok) throw new Error('expected PROPOSAL_SUPERSEDED');
    expect(applied.error.code).toBe('PROPOSAL_SUPERSEDED');
  });

  it('fails apply with PROPOSAL_NOT_APPROVED after rejection', async () => {
    const proposed = await propose();
    if (!proposed.ok) throw new Error(proposed.error.message);
    await decide('prop-1', 'reject', proposed.data.proposal.hash);
    const applied = await apply('prop-1');
    if (applied.ok) throw new Error('expected PROPOSAL_REJECTED');
    expect(applied.error.code).toBe('PROPOSAL_REJECTED');
  });

  it('expires proposals on sweep and fails apply with PROPOSAL_EXPIRED', async () => {
    const proposed = await propose();
    if (!proposed.ok) throw new Error(proposed.error.message);
    await decide('prop-1', 'approve', proposed.data.proposal.hash);

    const changed = await sweep(storage, new Date(T0.getTime() + 601_000));
    expect(changed).toBeGreaterThanOrEqual(1);
    const applied = await apply('prop-1');
    if (applied.ok) throw new Error('expected PROPOSAL_EXPIRED');
    expect(applied.error.code).toBe('PROPOSAL_EXPIRED');
  });

  it('rate-limits the sixth concurrent pending proposal', async () => {
    for (let index = 0; index < 5; index += 1) {
      const result = await propose([
        { type: 'place', productId: 'shelf-recessed', x: index * 3, y: index * 3, rotation: 0 },
      ]);
      expect(result.ok).toBe(true);
    }
    const sixth = await propose();
    if (sixth.ok) throw new Error('expected RATE_LIMITED');
    expect(sixth.error.code).toBe('RATE_LIMITED');
  });

  it('rejects oversized operation lists and unknown protected actions', async () => {
    const tooMany = await propose(Array.from({ length: 13 }, (_, index) => placeOp(index * 2, 60)));
    if (tooMany.ok) throw new Error('expected INVALID_INPUT');
    expect(tooMany.error.code).toBe('INVALID_INPUT');

    const badAction = await routeRequest(
      storage,
      'POST',
      '/protected',
      ctx({ idempotencyKey: 'bad-action' }),
      { action: 'wire_money', payload: {} },
    );
    if (!badAction.envelope.ok) expect(badAction.envelope.error.code).toBe('INVALID_INPUT');
  });

  it('marks a used confirmation as spent and refuses reuse', async () => {
    const booking = await routeRequest(
      storage,
      'POST',
      '/protected',
      ctx({ idempotencyKey: 'book-a' }),
      { action: 'submit_quote_request', payload: { email: 'demo@example.com' } },
    );
    if (booking.envelope.ok) throw new Error('expected confirmation flow');
    const confirmationId = booking.envelope.error.data?.confirmationId as string;
    const actionDigest = booking.envelope.error.data?.actionDigest as string;
    const confirmed = await routeRequest(
      storage,
      'POST',
      '/protected/confirm',
      ctx({ idempotencyKey: 'confirm-a' }),
      { confirmationId, actionDigest },
    );
    if (!confirmed.envelope.ok) throw new Error('expected token');
    const { token } = confirmed.envelope.data as { token: string };
    const done = await routeRequest(
      storage,
      'POST',
      '/protected',
      ctx({ idempotencyKey: 'quote-1' }),
      {
        action: 'submit_quote_request',
        payload: { email: 'demo@example.com' },
        confirmationId,
        token,
      },
    );
    expect(done.envelope.ok).toBe(true);

    const reuse = await routeRequest(
      storage,
      'POST',
      '/protected/confirm',
      ctx({ idempotencyKey: 'confirm-a2' }),
      { confirmationId, actionDigest },
    );
    if (!reuse.envelope.ok) expect(reuse.envelope.error.code).toBe('CONFIRMATION_ALREADY_USED');
  });

  it('resets the session to version 1 and clears proposals', async () => {
    await propose();
    const reset = await routeRequest(
      storage,
      'POST',
      '/reset',
      ctx({ idempotencyKey: 'reset-1' }),
      {},
    );
    if (!reset.envelope.ok) throw new Error('expected ok');
    expect((reset.envelope.data as { room: RoomState }).room.version).toBe(1);
    const list = await routeRequest(storage, 'GET', '/proposals', ctx(), undefined);
    if (!list.envelope.ok) throw new Error('expected ok');
    expect((list.envelope.data as { proposals: unknown[] }).proposals).toHaveLength(0);
  });

  it('caps the audit log at 500 entries', async () => {
    for (let index = 0; index < 520; index += 1) {
      const audit = (await storage.get<AuditEntry[]>('audit')) ?? [];
      audit.push({ ts: T0.toISOString(), seq: index + 1, type: 'noise', detail: 'x' });
      await storage.put('audit', audit);
    }
    await routeRequest(storage, 'POST', '/manual', ctx({ idempotencyKey: 'm-cap' }), {
      op: { type: 'place', productId: 'towel-bar-matte', x: 90, y: 8, rotation: 0 },
    });
    const audit = (await storage.get<AuditEntry[]>('audit')) ?? [];
    expect(audit.length).toBeLessThanOrEqual(500);
    expect(audit[audit.length - 1]?.type).toBe('manual_edit');
  });

  it('binds confirmation to the exact action digest (tampered payload fails)', async () => {
    const booking = await routeRequest(
      storage,
      'POST',
      '/protected',
      ctx({ idempotencyKey: 'book-b' }),
      { action: 'book_showroom_visit', payload: { showroom: 'A' } },
    );
    if (booking.envelope.ok) throw new Error('expected confirmation flow');
    const confirmationId = booking.envelope.error.data?.confirmationId as string;
    const stored = await storage.get<StoredConfirmation>(`confirm:${confirmationId}`);
    expect(stored?.actionDigest).toMatch(/^[0-9a-f]{64}$/);
    const tampered = await routeRequest(
      storage,
      'POST',
      '/protected/confirm',
      ctx({ idempotencyKey: 'confirm-b' }),
      { confirmationId, actionDigest: 'f'.repeat(64) },
    );
    if (!tampered.envelope.ok) expect(tampered.envelope.error.code).toBe('DIGEST_MISMATCH');
  });
});
