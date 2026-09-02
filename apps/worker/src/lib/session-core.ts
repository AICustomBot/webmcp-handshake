import {
  CATALOG,
  LIMITS,
  canonicalHash,
  canonicalJson,
  newCapability,
  type CatalogProduct,
  type ErrorCode,
  type Operation,
  type ProposalRecord,
  type RoomState,
} from '../../../../packages/contracts/src/index';
import {
  applyOperations,
  budgetStatus,
  checkClearances,
  mayConfirm,
  validateProposalOperations,
} from '../../../../packages/policy/src/index';

/** Map-like storage port so the session engine stays testable in plain Node (plan §1). */
export interface StorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<Map<string, T>>;
}

export interface AuditEntry {
  ts: string;
  seq: number;
  type: string;
  detail: string;
}

export interface SessionMeta {
  capability: string;
  createdAt: string;
}

export interface StoredConfirmation {
  confirmationId: string;
  actionType: string;
  actionDigest: string;
  expiresAt: string;
  used: boolean;
}

export interface RouteContext {
  sessionId: string;
  requestId: string;
  idempotencyKey?: string | undefined;
  isHumanIntent: boolean;
  query?: URLSearchParams | undefined;
  now: Date;
}

export interface EnvelopeError {
  code: string;
  message: string;
  retryable: boolean;
  data?: Record<string, unknown>;
}

export type Envelope<T = unknown> =
  { ok: true; data: T; requestId: string } | { ok: false; error: EnvelopeError; requestId: string };

export interface RouteResult {
  status: number;
  envelope: Envelope;
}

interface IdemEntry {
  requestId: string;
  status: number;
  body: Envelope;
  requestFingerprint: string;
  expiresAt: string;
}

const PROPOSAL_PREFIX = 'proposal:';
const CONFIRM_PREFIX = 'confirm:';
const IDEM_PREFIX = 'idem:';
const AUDIT_CAP = 500;
const MAX_PENDING_PROPOSALS = 5;
const MAX_MANUAL_OPS = 4;
const ROOM_WIDTH_IN = 108;
const ROOM_LENGTH_IN = 132;
const ROOM_BUDGET_CENTS = 1400000;
const PROTECTED_ACTIONS = ['book_showroom_visit', 'submit_quote_request'] as const;
const CONFIRMATION_MESSAGE =
  'Protected action requires an explicit human confirmation in the page. Present the confirmation to the person; approval remains human-only.';

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  VERSION_CONFLICT: 409,
  PROPOSAL_EXPIRED: 409,
  PROPOSAL_NOT_APPROVED: 409,
  PROPOSAL_REJECTED: 409,
  PROPOSAL_SUPERSEDED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CONFIRMATION_REQUIRED: 200,
  CONFIRMATION_EXPIRED: 410,
  POLICY_BLOCKED: 422,
  NOT_FOUND: 404,
  SESSION_EXPIRED: 404,
  RATE_LIMITED: 429,
  ORIGIN_DENIED: 403,
};

function fail(
  code: string,
  message: string,
  requestId: string,
  extra?: { retryable?: boolean; data?: Record<string, unknown> },
): RouteResult {
  const error: EnvelopeError = { code, message, retryable: extra?.retryable ?? false };
  if (extra?.data) error.data = extra.data;
  return { status: STATUS_BY_CODE[code] ?? 400, envelope: { ok: false, error, requestId } };
}

function done(data: unknown, requestId: string, status = 200): RouteResult {
  return { status, envelope: { ok: true, data, requestId } };
}

function initialRoom(sessionId: string): RoomState {
  return {
    sessionId,
    version: 1,
    widthIn: ROOM_WIDTH_IN,
    lengthIn: ROOM_LENGTH_IN,
    budgetCents: ROOM_BUDGET_CENTS,
    items: [],
  };
}

async function appendAudit(
  storage: StorageLike,
  type: string,
  detail: string,
  now: Date,
): Promise<void> {
  const audit = (await storage.get<AuditEntry[]>('audit')) ?? [];
  const last = audit.length > 0 ? audit[audit.length - 1] : undefined;
  audit.push({ ts: now.toISOString(), seq: (last?.seq ?? 0) + 1, type, detail });
  while (audit.length > AUDIT_CAP) audit.shift();
  await storage.put('audit', audit);
}

async function randomHex(charCount: number): Promise<string> {
  const bytes = new Uint8Array(Math.ceil(charCount / 2));
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, charCount);
}

/** Creates the synthetic session once; later calls return the existing capability unchanged (plan D2). */
export async function createSession(
  storage: StorageLike,
  sessionId: string,
): Promise<{ capability: string; room: RoomState; created: boolean }> {
  const existing = await storage.get<SessionMeta>('meta');
  if (existing) {
    const room = (await storage.get<RoomState>('room')) ?? initialRoom(sessionId);
    return { capability: existing.capability, room, created: false };
  }
  const meta: SessionMeta = { capability: newCapability(), createdAt: new Date().toISOString() };
  await storage.put('meta', meta);
  await storage.put('room', initialRoom(sessionId));
  await appendAudit(storage, 'session_created', 'synthetic session initialized', new Date());
  return { capability: meta.capability, room: initialRoom(sessionId), created: true };
}

async function nextProposalId(storage: StorageLike): Promise<string> {
  const existing = await storage.list<ProposalRecord>(PROPOSAL_PREFIX);
  let max = 0;
  for (const key of existing.keys()) {
    const suffix = Number(key.slice(PROPOSAL_PREFIX.length).replace('prop-', ''));
    if (Number.isFinite(suffix) && suffix > max) max = suffix;
  }
  return `prop-${max + 1}`;
}

/** Supersedes pending/approved proposals left stale by a committed version bump (plan §4). */
async function supersedeStale(storage: StorageLike, room: RoomState, now: Date): Promise<number> {
  const entries = await storage.list<ProposalRecord>(PROPOSAL_PREFIX);
  let count = 0;
  for (const [key, proposal] of entries) {
    if (
      (proposal.status === 'pending_human' || proposal.status === 'approved') &&
      proposal.baseVersion < room.version
    ) {
      const updated: ProposalRecord = { ...proposal, status: 'superseded' };
      await storage.put(key, updated);
      count += 1;
    }
  }
  if (count > 0) {
    await appendAudit(
      storage,
      'proposal_superseded',
      `${count} stale proposal(s) superseded by committed version ${room.version}`,
      now,
    );
  }
  return count;
}

async function readRoom(storage: StorageLike): Promise<RoomState | undefined> {
  return storage.get<RoomState>('room');
}

function roomView(room: RoomState) {
  return {
    room,
    budget: budgetStatus(room, CATALOG),
    checks: checkClearances(room, CATALOG),
  };
}

function terminalCodeFor(status: ProposalRecord['status']): string {
  switch (status) {
    case 'rejected':
      return 'PROPOSAL_REJECTED';
    case 'superseded':
      return 'PROPOSAL_SUPERSEDED';
    case 'expired':
      return 'PROPOSAL_EXPIRED';
    default:
      return 'PROPOSAL_NOT_APPROVED';
  }
}

async function loadProposal(
  storage: StorageLike,
  proposalId: string,
): Promise<ProposalRecord | undefined> {
  return storage.get<ProposalRecord>(`${PROPOSAL_PREFIX}${proposalId}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lazily expires proposals, confirmations and idempotency entries; called on every DO hit and alarm. */
export async function sweep(storage: StorageLike, now: Date): Promise<number> {
  let changed = 0;
  let expiredProposals = 0;
  const proposals = await storage.list<ProposalRecord>(PROPOSAL_PREFIX);
  for (const [key, proposal] of proposals) {
    if (
      (proposal.status === 'pending_human' || proposal.status === 'approved') &&
      new Date(proposal.expiresAt) <= now
    ) {
      await storage.put(key, { ...proposal, status: 'expired' } satisfies ProposalRecord);
      expiredProposals += 1;
      changed += 1;
    }
  }
  if (expiredProposals > 0) {
    await appendAudit(
      storage,
      'proposal_expired',
      `${expiredProposals} stale proposal(s) expired`,
      now,
    );
  }
  const confirmations = await storage.list<StoredConfirmation>(CONFIRM_PREFIX);
  for (const [key, confirmation] of confirmations) {
    if (new Date(confirmation.expiresAt) <= now) {
      await storage.delete(key);
      changed += 1;
    }
  }
  const idemEntries = await storage.list<IdemEntry>(IDEM_PREFIX);
  for (const [key, entry] of idemEntries) {
    if (new Date(entry.expiresAt) <= now) {
      await storage.delete(key);
      changed += 1;
    }
  }
  return changed;
}

async function dispatch(
  storage: StorageLike,
  method: string,
  subPath: string,
  ctx: RouteContext,
  body: unknown,
): Promise<RouteResult> {
  const path = subPath.replace(/\/+$/, '') || '/';
  const segments = path.split('/').filter(Boolean);

  if (path === '/__meta') {
    return done((await storage.get<SessionMeta>('meta')) ?? null, ctx.requestId);
  }

  const room = await readRoom(storage);
  if (!room) return fail('SESSION_EXPIRED', 'session storage missing room', ctx.requestId);
  const meta = await storage.get<SessionMeta>('meta');
  if (!meta) return fail('SESSION_EXPIRED', 'session not initialized', ctx.requestId);

  if (method === 'GET') {
    if (path === '/room') return done(roomView(room), ctx.requestId);

    if (path === '/catalog') {
      const q = ctx.query?.get('q')?.trim().toLowerCase() ?? '';
      const category = ctx.query?.get('category')?.trim() ?? '';
      const products = CATALOG.filter((product: CatalogProduct) => {
        const matchesQuery = q.length === 0 || product.name.toLowerCase().includes(q);
        const matchesCategory = category.length === 0 || product.category === category;
        return matchesQuery && matchesCategory;
      });
      return done({ products }, ctx.requestId);
    }

    if (segments[0] === 'products' && segments.length === 2) {
      const productId = segments[1] ?? '';
      const product = CATALOG.find((entry) => entry.id === productId);
      if (!product) return fail('NOT_FOUND', 'unknown product', ctx.requestId);
      return done({ product }, ctx.requestId);
    }

    if (path === '/proposals') {
      const proposals = await storage.list<ProposalRecord>(PROPOSAL_PREFIX);
      const sorted = [...proposals.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([, proposal]) => proposal);
      return done({ proposals: sorted }, ctx.requestId);
    }

    if (segments[0] === 'proposals' && segments.length === 2) {
      const proposal = await loadProposal(storage, segments[1] ?? '');
      if (!proposal) return fail('NOT_FOUND', 'unknown proposal', ctx.requestId);
      return done({ proposal }, ctx.requestId);
    }

    if (path === '/receipt') {
      const audit = (await storage.get<AuditEntry[]>('audit')) ?? [];
      const proposals = await storage.list<ProposalRecord>(PROPOSAL_PREFIX);
      const counts = new Map<string, number>();
      for (const entry of audit) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
      const sessionIdHash = (await canonicalHash(ctx.sessionId)).slice(0, 12);
      return done(
        {
          receipt: {
            sessionIdHash,
            generatedAt: ctx.now.toISOString(),
            disclaimer:
              'Synthetic demo evidence. No real customer, booking, quote, or payment data.',
            room: {
              version: room.version,
              widthIn: room.widthIn,
              lengthIn: room.lengthIn,
              itemCount: room.items.length,
            },
            budget: budgetStatus(room, CATALOG),
            checks: checkClearances(room, CATALOG),
            proposals: [...proposals.values()]
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((proposal) => ({
                id: proposal.id,
                status: proposal.status,
                baseVersion: proposal.baseVersion,
                decidedAt: proposal.decidedAt ?? null,
                appliedAt: proposal.appliedAt ?? null,
              })),
            protectedActions: audit
              .filter((entry) => entry.type === 'protected_action_completed')
              .map((entry) => ({ ts: entry.ts, detail: entry.detail })),
            auditTypes: [...counts.entries()].map(([type, count]) => ({ type, count })),
          },
        },
        ctx.requestId,
      );
    }

    if (path === '/audit') {
      return done({ audit: (await storage.get<AuditEntry[]>('audit')) ?? [] }, ctx.requestId);
    }
  }

  if (method === 'POST') {
    if (path === '/manual') {
      const op = isRecord(body) ? body.op : undefined;
      if (!isRecord(op)) return fail('INVALID_INPUT', 'missing manual operation', ctx.requestId);
      const validation = validateProposalOperations(room, CATALOG, [op], MAX_MANUAL_OPS);
      if (!validation.ok) {
        return fail(validation.code, 'manual edit rejected by policy', ctx.requestId);
      }
      const applied = applyOperations(room, CATALOG, [op as Operation]);
      if (!applied.ok) return fail(applied.code, 'manual edit failed', ctx.requestId);
      await storage.put('room', applied.room);
      await supersedeStale(storage, applied.room, ctx.now);
      await appendAudit(
        storage,
        'manual_edit',
        `manual ${String(op.type)} committed at version ${applied.room.version}`,
        ctx.now,
      );
      return done(roomView(applied.room), ctx.requestId);
    }

    if (path === '/proposals') {
      const operations = isRecord(body) ? body.operations : undefined;
      if (!Array.isArray(operations)) {
        return fail('INVALID_INPUT', 'operations array required', ctx.requestId);
      }
      const validation = validateProposalOperations(room, CATALOG, operations);
      if (!validation.ok) {
        return fail(validation.code, 'proposal rejected by policy', ctx.requestId);
      }
      const pending = await storage.list<ProposalRecord>(PROPOSAL_PREFIX);
      const activeCount = [...pending.values()].filter(
        (proposal) => proposal.status === 'pending_human' || proposal.status === 'approved',
      ).length;
      if (activeCount >= MAX_PENDING_PROPOSALS) {
        return fail(
          'RATE_LIMITED',
          'too many pending proposals; resolve existing ones first',
          ctx.requestId,
        );
      }
      const id = await nextProposalId(storage);
      const hash = await canonicalHash({
        operations,
        baseVersion: room.version,
        sessionId: ctx.sessionId,
      });
      const proposal: ProposalRecord = {
        id,
        baseVersion: room.version,
        hash,
        status: 'pending_human',
        operations: operations as Operation[],
        createdAt: ctx.now.toISOString(),
        expiresAt: new Date(ctx.now.getTime() + LIMITS.proposalTtlSeconds * 1000).toISOString(),
      };
      await storage.put(`${PROPOSAL_PREFIX}${id}`, proposal);
      await appendAudit(
        storage,
        'proposal_created',
        `${id} proposed (${operations.length} op(s))`,
        ctx.now,
      );
      return done({ proposal }, ctx.requestId, 201);
    }

    const decisionMatch = path.match(/^\/proposals\/([^/]+)\/decision$/);
    if (decisionMatch) {
      if (!ctx.isHumanIntent) {
        return fail('ORIGIN_DENIED', 'proposal decisions are human-only', ctx.requestId);
      }
      const proposal = await loadProposal(storage, decisionMatch[1] ?? '');
      if (!proposal) return fail('NOT_FOUND', 'unknown proposal', ctx.requestId);
      const decision = isRecord(body) ? body.decision : undefined;
      const expectedHash = isRecord(body) ? body.expectedHash : undefined;
      if (decision !== 'approve' && decision !== 'reject') {
        return fail('INVALID_INPUT', 'decision must be approve or reject', ctx.requestId);
      }
      if (typeof expectedHash !== 'string' || expectedHash !== proposal.hash) {
        return fail(
          'INVALID_INPUT',
          'expectedHash does not match the presented proposal',
          ctx.requestId,
        );
      }
      if (proposal.status !== 'pending_human') {
        return fail('INVALID_INPUT', `proposal already ${proposal.status}`, ctx.requestId);
      }
      const updated: ProposalRecord = {
        ...proposal,
        status: decision === 'approve' ? 'approved' : 'rejected',
        decidedAt: ctx.now.toISOString(),
        decidedBy: 'human',
      };
      await storage.put(`${PROPOSAL_PREFIX}${proposal.id}`, updated);
      await appendAudit(
        storage,
        decision === 'approve' ? 'proposal_approved' : 'proposal_rejected',
        `${proposal.id} ${updated.status} by human`,
        ctx.now,
      );
      return done({ proposal: updated }, ctx.requestId);
    }

    const applyMatch = path.match(/^\/proposals\/([^/]+)\/apply$/);
    if (applyMatch) {
      const proposal = await loadProposal(storage, applyMatch[1] ?? '');
      if (!proposal) return fail('NOT_FOUND', 'unknown proposal', ctx.requestId);
      if (proposal.status !== 'approved') {
        return fail(
          terminalCodeFor(proposal.status),
          `proposal is ${proposal.status}`,
          ctx.requestId,
        );
      }
      if (new Date(proposal.expiresAt) <= ctx.now) {
        await storage.put(`${PROPOSAL_PREFIX}${proposal.id}`, {
          ...proposal,
          status: 'expired',
        } satisfies ProposalRecord);
        return fail('PROPOSAL_EXPIRED', 'approval window elapsed', ctx.requestId);
      }
      if (proposal.baseVersion !== room.version) {
        return fail('VERSION_CONFLICT', 'room changed after approval', ctx.requestId);
      }
      const recomputed = await canonicalHash({
        operations: proposal.operations,
        baseVersion: proposal.baseVersion,
        sessionId: ctx.sessionId,
      });
      if (recomputed !== proposal.hash) {
        await storage.put(`${PROPOSAL_PREFIX}${proposal.id}`, {
          ...proposal,
          status: 'invalidated',
        } satisfies ProposalRecord);
        await appendAudit(
          storage,
          'security_hash_mismatch',
          `${proposal.id} hash mismatch at apply; invalidated`,
          ctx.now,
        );
        return fail('INVALID_INPUT', 'proposal hash mismatch; invalidated', ctx.requestId);
      }
      const validation = validateProposalOperations(room, CATALOG, proposal.operations);
      if (!validation.ok) {
        return fail(
          validation.code,
          'proposal no longer valid against current room',
          ctx.requestId,
        );
      }
      const applied = applyOperations(room, CATALOG, proposal.operations);
      if (!applied.ok) return fail(applied.code, 'proposal failed to apply', ctx.requestId);
      await storage.put('room', applied.room);
      await storage.put(`${PROPOSAL_PREFIX}${proposal.id}`, {
        ...proposal,
        status: 'applied',
        appliedAt: ctx.now.toISOString(),
      } satisfies ProposalRecord);
      await supersedeStale(storage, applied.room, ctx.now);
      await appendAudit(
        storage,
        'proposal_applied',
        `${proposal.id} applied at version ${applied.room.version}`,
        ctx.now,
      );
      return done(
        { ...roomView(applied.room), proposal: { ...proposal, status: 'applied' } },
        ctx.requestId,
      );
    }

    if (path === '/protected/confirm') {
      if (!ctx.isHumanIntent) {
        return fail('ORIGIN_DENIED', 'protected confirmations are human-only', ctx.requestId);
      }
      const confirmationId = isRecord(body) ? body.confirmationId : undefined;
      const actionDigest = isRecord(body) ? body.actionDigest : undefined;
      if (typeof confirmationId !== 'string' || typeof actionDigest !== 'string') {
        return fail('INVALID_INPUT', 'confirmationId and actionDigest required', ctx.requestId);
      }
      const confirmation = await storage.get<StoredConfirmation>(
        `${CONFIRM_PREFIX}${confirmationId}`,
      );
      if (!confirmation) return fail('NOT_FOUND', 'unknown confirmation', ctx.requestId);
      const decision = mayConfirm(
        {
          actionDigest: confirmation.actionDigest,
          expiresAt: confirmation.expiresAt,
          used: confirmation.used,
        },
        actionDigest,
        ctx.now,
      );
      if (!decision.allowed) return fail(decision.code, 'confirmation rejected', ctx.requestId);
      const token = await canonicalHash({
        confirmationId,
        actionDigest: confirmation.actionDigest,
        capability: meta.capability,
      });
      await appendAudit(
        storage,
        'protected_confirmed',
        `${confirmation.actionType} confirmed by human`,
        ctx.now,
      );
      return done({ token, expiresAt: confirmation.expiresAt }, ctx.requestId);
    }

    if (path === '/protected') {
      const action = isRecord(body) ? body.action : undefined;
      const payload = isRecord(body) ? body.payload : undefined;
      if (action !== 'book_showroom_visit' && action !== 'submit_quote_request') {
        return fail('INVALID_INPUT', 'unknown protected action', ctx.requestId);
      }
      if (!isRecord(payload))
        return fail('INVALID_INPUT', 'payload object required', ctx.requestId);
      const confirmationId =
        typeof (isRecord(body) ? body.confirmationId : undefined) === 'string'
          ? (body as { confirmationId: string }).confirmationId
          : undefined;
      const token =
        typeof (isRecord(body) ? body.token : undefined) === 'string'
          ? (body as { token: string }).token
          : undefined;

      if (confirmationId && token) {
        const confirmation = await storage.get<StoredConfirmation>(
          `${CONFIRM_PREFIX}${confirmationId}`,
        );
        if (!confirmation || confirmation.actionType !== action) {
          return fail('NOT_FOUND', 'unknown confirmation', ctx.requestId);
        }
        const expectedToken = await canonicalHash({
          confirmationId,
          actionDigest: confirmation.actionDigest,
          capability: meta.capability,
        });
        if (token !== expectedToken) {
          return fail('ORIGIN_DENIED', 'confirmation token mismatch', ctx.requestId);
        }
        const decision = mayConfirm(
          {
            actionDigest: confirmation.actionDigest,
            expiresAt: confirmation.expiresAt,
            used: confirmation.used,
          },
          confirmation.actionDigest,
          ctx.now,
        );
        if (!decision.allowed) return fail(decision.code, 'confirmation rejected', ctx.requestId);
        confirmation.used = true;
        await storage.put(`${CONFIRM_PREFIX}${confirmationId}`, confirmation);
        const referenceId = `ref-${await randomHex(8)}`;
        await appendAudit(
          storage,
          'protected_action_completed',
          `${action} completed (${referenceId}) after human confirmation`,
          ctx.now,
        );
        return done(
          {
            action,
            status: 'completed',
            referenceId,
            result: {
              confirmation: action === 'book_showroom_visit' ? 'booked' : 'submitted',
              disclaimer: 'Synthetic demo action. No real booking, quote, or commerce.',
            },
          },
          ctx.requestId,
        );
      }

      const actionDigest = await canonicalHash({ action, payload });
      const newConfirmationId = `conf-${await randomHex(8)}`;
      const confirmation: StoredConfirmation = {
        confirmationId: newConfirmationId,
        actionType: action,
        actionDigest,
        expiresAt: new Date(ctx.now.getTime() + LIMITS.confirmationTtlSeconds * 1000).toISOString(),
        used: false,
      };
      await storage.put(`${CONFIRM_PREFIX}${newConfirmationId}`, confirmation);
      await appendAudit(
        storage,
        'protected_confirmation_required',
        `${action} gated behind human confirmation ${newConfirmationId}`,
        ctx.now,
      );
      return fail('CONFIRMATION_REQUIRED', CONFIRMATION_MESSAGE, ctx.requestId, {
        retryable: true,
        data: {
          confirmationId: newConfirmationId,
          actionDigest,
          expiresAt: confirmation.expiresAt,
        },
      });
    }

    if (path === '/reset') {
      const fresh = initialRoom(ctx.sessionId);
      await storage.put('room', fresh);
      for (const key of (await storage.list(PROPOSAL_PREFIX)).keys()) await storage.delete(key);
      for (const key of (await storage.list(CONFIRM_PREFIX)).keys()) await storage.delete(key);
      for (const key of (await storage.list(IDEM_PREFIX)).keys()) await storage.delete(key);
      await appendAudit(storage, 'session_reset', 'room reset to initial state', ctx.now);
      return done({ room: fresh }, ctx.requestId);
    }
  }

  return fail('INVALID_INPUT', `unsupported route ${method} ${path}`, ctx.requestId);
}

/** Entry point used by the Durable Object adapter (plan §3). */
export async function routeRequest(
  storage: StorageLike,
  method: string,
  subPath: string,
  ctx: RouteContext,
  body: unknown,
): Promise<RouteResult> {
  if (method === 'POST' && ctx.idempotencyKey) {
    const ledgerKey = `${IDEM_PREFIX}${subPath}:${ctx.idempotencyKey}`;
    const existing = await storage.get<IdemEntry>(ledgerKey);
    const fingerprint = canonicalJson(body ?? null);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return fail(
          'IDEMPOTENCY_CONFLICT',
          'idempotency key reused with a different payload',
          ctx.requestId,
        );
      }
      return { status: existing.status, envelope: existing.body };
    }
    const result = await dispatch(storage, method, subPath, ctx, body);
    if (result.status < 400) {
      const entry: IdemEntry = {
        requestId: ctx.requestId,
        status: result.status,
        body: result.envelope,
        requestFingerprint: fingerprint,
        expiresAt: new Date(ctx.now.getTime() + LIMITS.sessionTtlSeconds * 1000).toISOString(),
      };
      await storage.put(ledgerKey, entry);
    }
    return result;
  }
  return dispatch(storage, method, subPath, ctx, body);
}
