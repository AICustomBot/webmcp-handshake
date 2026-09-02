import { DurableObject } from 'cloudflare:workers';
import { CONTRACT_VERSION, LIMITS } from '@handshake/contracts';
import { parseApiRoute, readBoundedJson } from './runtime-utils';
export { parseApiRoute, readBoundedJson } from './runtime-utils';
export type { ApiRoute } from './runtime-utils';
import type {
  Actor,
  IdempotencyRecord,
  Operation,
  Proposal,
  RoomState,
  ToolResult,
} from '@handshake/contracts';
import {
  applyOperations,
  checkIdempotency,
  mayApplyWithHash,
  mayCreateProposal,
  mayDecide,
  proposalHash,
  requestHash,
  statusAfterCommittedChange,
  validateOperations,
} from '@handshake/policy';

export interface Env {
  ASSETS: Fetcher;
  DESIGN_SESSION: DurableObjectNamespace<DesignSession>;
}

interface StoredSession {
  capability: string;
  state: RoomState;
  proposals: Record<string, Proposal>;
  idempotency: Record<string, IdempotencyRecord>;
  createdAt: string;
  expiresAt: string;
}

interface CreateSessionBody {
  widthIn?: number;
  lengthIn?: number;
  budgetCents?: number;
}

interface ProposalBody {
  expectedVersion: number;
  operations: Operation[];
  rationale: string;
  idempotencyKey: string;
}

interface DecisionBody {
  proposalId: string;
  proposalHash: string;
  outcome: 'approve' | 'reject';
}

interface ApplyBody {
  proposalId: string;
  proposalHash: string;
  expectedVersion: number;
  idempotencyKey: string;
}

interface EditBody {
  expectedVersion: number;
  operations: Operation[];
}

/** Maps stable errors to conservative HTTP statuses. */
function statusFor(code: string): number {
  if (code === 'SESSION_NOT_FOUND' || code === 'PROPOSAL_NOT_FOUND') return 404;
  if (code === 'FORBIDDEN_ACTOR') return 403;
  if (code === 'VERSION_CONFLICT' || code === 'IDEMPOTENCY_CONFLICT') return 409;
  if (code === 'LIMIT_EXCEEDED') return 413;
  if (code === 'NOT_IMPLEMENTED') return 501;
  return 400;
}

/** Produces the common fail-closed tool envelope. */
function failure(requestId: string, code: string, message: string): Response {
  return Response.json(
    { ok: false, requestId, error: { code, message, retryable: false } },
    { status: statusFor(code) },
  );
}

/** Produces the common successful tool envelope. */
function success<T>(requestId: string, data: T, status = 200): Response {
  const result: ToolResult<T> = { ok: true, requestId, data };
  return Response.json(result, { status });
}

/** Generates an unguessable hexadecimal capability without external services. */
function randomCapability(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Creates a request with a replayable, size-checked body. */
async function boundedRequest(request: Request, url: string): Promise<Request> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return new Request(url, request);
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > LIMITS.maxBodyBytes) throw new RangeError('Request body is too large.');
  return new Request(url, { method: request.method, headers: request.headers, body });
}

/** Infers authority from the non-agent route selected by the outer router. */
function actorFor(resource: string): Actor['kind'] {
  if (resource === 'decisions' || resource === 'edits' || resource === 'confirmations') {
    return 'human_ui';
  }
  return 'agent';
}

/** Handles static assets, session creation, and capability-preserving DO routing. */
export async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  const requestId = crypto.randomUUID();
  if (url.pathname === '/api/v1/sessions' && request.method === 'POST') {
    try {
      const body = (await readBoundedJson(request)) as CreateSessionBody;
      const sessionId = crypto.randomUUID();
      const capability = randomCapability();
      const id = env.DESIGN_SESSION.idFromName(sessionId);
      const stub = env.DESIGN_SESSION.get(id);
      const internal = new Request('https://session.internal/init', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': requestId,
          'x-handshake-internal': 'init',
        },
        body: JSON.stringify({
          widthIn: body.widthIn,
          lengthIn: body.lengthIn,
          budgetCents: body.budgetCents,
          sessionId,
          capability,
        }),
      });
      const response = await stub.fetch(internal);
      if (!response.ok) return response;
      return success(requestId, { sessionId, capability, contractVersion: CONTRACT_VERSION }, 201);
    } catch (error) {
      const code = error instanceof RangeError ? 'LIMIT_EXCEEDED' : 'INVALID_INPUT';
      return failure(requestId, code, 'Session input was invalid.');
    }
  }

  const route = parseApiRoute(url.pathname);
  if (route === null) return failure(requestId, 'INVALID_INPUT', 'Unknown API route.');
  if (route.resource === 'init') {
    return failure(requestId, 'FORBIDDEN_ACTOR', 'Internal route.');
  }
  if (route.sessionId.length === 0 || route.sessionId.length > 128) {
    return failure(requestId, 'INVALID_INPUT', 'Invalid session identifier.');
  }

  try {
    const id = env.DESIGN_SESSION.idFromName(route.sessionId);
    const stub = env.DESIGN_SESSION.get(id);
    const internalUrl = 'https:' + '//session.internal/' + encodeURIComponent(route.resource);
    const forwarded = await boundedRequest(request, internalUrl);
    const headers = new Headers(forwarded.headers);
    headers.set('x-request-id', requestId);
    headers.set(ACTOR_HEADER, actorFor(route.resource));
    headers.set('x-route-session', route.sessionId);
    return await stub.fetch(new Request(forwarded, { headers }));
  } catch (error) {
    const code = error instanceof RangeError ? 'LIMIT_EXCEEDED' : 'INVALID_INPUT';
    return failure(requestId, code, 'Request could not be routed safely.');
  }
}

export default {
  fetch: routeRequest,
} satisfies ExportedHandler<Env>;

/** Authoritative, single-threaded state holder for one synthetic session. */
export class DesignSession extends DurableObject<Env> {
  /** Handles session state and all atomic mutations. */
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(() => this.handle(request));
  }

  /** Serializes one complete read-modify-write operation. */
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    if (url.pathname === '/init' && request.method === 'POST') {
      if (request.headers.get('x-handshake-internal') !== 'init') {
        return failure(requestId, 'FORBIDDEN_ACTOR', 'Internal route.');
      }
      try {
        return await this.initialize(request, requestId);
      } catch (error) {
        const code = error instanceof RangeError ? 'LIMIT_EXCEEDED' : 'INVALID_INPUT';
        return failure(requestId, code, 'Session input was invalid.');
      }
    }

    const session = await this.ctx.storage.get<StoredSession>(SESSION_KEY);
    if (session === undefined) return failure(requestId, 'SESSION_NOT_FOUND', 'Session not found.');
    const routeSession = request.headers.get('x-route-session');
    if (routeSession !== session.state.sessionId) {
      return failure(requestId, 'FORBIDDEN_ACTOR', 'Cross-session access denied.');
    }
    if (request.headers.get(CAPABILITY_HEADER) !== session.capability) {
      return failure(requestId, 'FORBIDDEN_ACTOR', 'Session capability is invalid.');
    }

    const actor: Actor = {
      kind: request.headers.get(ACTOR_HEADER) === 'human_ui' ? 'human_ui' : 'agent',
      sessionId: session.state.sessionId,
    };

    try {
      if (url.pathname === '/state' && request.method === 'GET') {
        return success(requestId, { state: session.state });
      }
      if (url.pathname === '/proposals' && request.method === 'POST') {
        return this.createProposal(request, requestId, session, actor);
      }
      if (url.pathname === '/decisions' && request.method === 'POST') {
        return this.decide(request, requestId, session, actor);
      }
      if (url.pathname === '/apply' && request.method === 'POST') {
        return this.apply(request, requestId, session);
      }
      if (url.pathname === '/edits' && request.method === 'POST') {
        return this.edit(request, requestId, session, actor);
      }
      return failure(requestId, 'NOT_IMPLEMENTED', 'Session route is not implemented.');
    } catch (error) {
      const code = error instanceof RangeError ? 'LIMIT_EXCEEDED' : 'INVALID_INPUT';
      return failure(requestId, code, 'Request body was invalid.');
    }
  }

  /** Creates the session exactly once and installs its cleanup alarm. */
  private async initialize(request: Request, requestId: string): Promise<Response> {
    const existing = await this.ctx.storage.get<StoredSession>(SESSION_KEY);
    if (existing !== undefined)
      return failure(requestId, 'IDEMPOTENCY_CONFLICT', 'Already initialized.');
    const body = (await readBoundedJson(request)) as CreateSessionBody & {
      sessionId: string;
      capability: string;
    };
    const widthIn = body.widthIn ?? DEFAULT_ROOM.widthIn;
    const lengthIn = body.lengthIn ?? DEFAULT_ROOM.lengthIn;
    const budgetCents = body.budgetCents ?? DEFAULT_ROOM.budgetCents;
    if (
      !Number.isFinite(widthIn) ||
      !Number.isFinite(lengthIn) ||
      !Number.isInteger(budgetCents) ||
      widthIn < LIMITS.minRoomDimensionIn ||
      lengthIn < LIMITS.minRoomDimensionIn ||
      widthIn > LIMITS.maxRoomDimensionIn ||
      lengthIn > LIMITS.maxRoomDimensionIn ||
      budgetCents < 0
    ) {
      return failure(requestId, 'INVALID_INPUT', 'Room dimensions or budget are invalid.');
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LIMITS.sessionTtlSeconds * 1000).toISOString();
    const session: StoredSession = {
      capability: body.capability,
      state: {
        sessionId: body.sessionId,
        version: 0,
        widthIn,
        lengthIn,
        budgetCents,
        items: [],
      },
      proposals: {},
      idempotency: {},
      createdAt: now.toISOString(),
      expiresAt,
    };
    await this.ctx.storage.put(SESSION_KEY, session);
    await this.ctx.storage.setAlarm(new Date(expiresAt));
    return success(requestId, { initialized: true }, 201);
  }

  /** Atomically records a non-mutating proposal against the current version. */
  private async createProposal(
    request: Request,
    requestId: string,
    session: StoredSession,
    actor: Actor,
  ): Promise<Response> {
    const body = (await readBoundedJson(request)) as ProposalBody;
    const payloadHash = await requestHash(body);
    const replay = checkIdempotency(session.idempotency[body.idempotencyKey], payloadHash);
    if (replay.outcome === 'replay') {
      const proposal = session.proposals[replay.record.resultRef];
      return proposal === undefined
        ? failure(requestId, 'PROPOSAL_NOT_FOUND', 'Stored replay result is missing.')
        : success(requestId, { proposal, state: session.state });
    }
    if (replay.outcome === 'conflict') {
      return failure(requestId, replay.code, 'Idempotency key was reused with different content.');
    }
    const decision = mayCreateProposal({
      actor,
      state: session.state,
      expectedVersion: body.expectedVersion,
      operations: body.operations,
      pendingCount: Object.values(session.proposals).filter(
        (proposal) => proposal.status === 'pending_human',
      ).length,
    });
    if (!decision.allowed)
      return failure(requestId, decision.code, 'Proposal was denied by policy.');
    if (typeof body.rationale !== 'string' || typeof body.idempotencyKey !== 'string') {
      return failure(requestId, 'INVALID_INPUT', 'Proposal metadata is invalid.');
    }
    const now = new Date();
    const id = crypto.randomUUID();
    const hash = await proposalHash({
      sessionId: session.state.sessionId,
      baseVersion: session.state.version,
      operations: body.operations,
    });
    const proposal: Proposal = {
      id,
      sessionId: session.state.sessionId,
      baseVersion: session.state.version,
      hash,
      status: 'pending_human',
      operations: body.operations,
      rationale: body.rationale,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + LIMITS.proposalTtlSeconds * 1000).toISOString(),
    };
    session.proposals[id] = proposal;
    session.idempotency[body.idempotencyKey] = {
      key: body.idempotencyKey,
      requestHash: payloadHash,
      resultRef: id,
      createdAt: now.toISOString(),
    };
    await this.ctx.storage.put(SESSION_KEY, session);
    return success(requestId, { proposal, state: session.state }, 201);
  }

  /** Atomically approves or rejects an exact proposal through the human route. */
  private async decide(
    request: Request,
    requestId: string,
    session: StoredSession,
    actor: Actor,
  ): Promise<Response> {
    const body = (await readBoundedJson(request)) as DecisionBody;
    const proposal = session.proposals[body.proposalId];
    if (proposal === undefined)
      return failure(requestId, 'PROPOSAL_NOT_FOUND', 'Proposal not found.');
    const decision = mayDecide({ proposal, actor, proposalHash: body.proposalHash });
    if (!decision.allowed)
      return failure(requestId, decision.code, 'Decision was denied by policy.');
    const next: Proposal = {
      ...proposal,
      status: body.outcome === 'approve' ? 'approved' : 'rejected',
      decidedAt: new Date().toISOString(),
    };
    session.proposals[next.id] = next;
    await this.ctx.storage.put(SESSION_KEY, session);
    return success(requestId, { proposal: next });
  }

  /** Applies an exact approved proposal as one versioned write. */
  private async apply(
    request: Request,
    requestId: string,
    session: StoredSession,
  ): Promise<Response> {
    const body = (await readBoundedJson(request)) as ApplyBody;
    const proposal = session.proposals[body.proposalId];
    if (proposal === undefined)
      return failure(requestId, 'PROPOSAL_NOT_FOUND', 'Proposal not found.');
    const payloadHash = await requestHash(body);
    const replay = checkIdempotency(session.idempotency[body.idempotencyKey], payloadHash);
    if (replay.outcome === 'replay') {
      return success(requestId, { proposal, state: session.state });
    }
    if (replay.outcome === 'conflict') {
      return failure(requestId, replay.code, 'Idempotency key was reused with different content.');
    }
    if (body.expectedVersion !== session.state.version) {
      return failure(requestId, 'VERSION_CONFLICT', 'Committed state changed.');
    }
    const decision = await mayApplyWithHash({
      proposal,
      state: session.state,
      proposalHash: body.proposalHash,
    });
    if (!decision.allowed)
      return failure(requestId, decision.code, 'Application was denied by policy.');
    const reduced = applyOperations(session.state, proposal.operations, () => crypto.randomUUID());
    if (!reduced.ok) return failure(requestId, reduced.code, 'Operations could not be applied.');
    const applied: Proposal = {
      ...proposal,
      status: 'applied',
      appliedAt: new Date().toISOString(),
      appliedVersion: reduced.state.version,
    };
    session.state = reduced.state;
    session.proposals[applied.id] = applied;
    for (const other of Object.values(session.proposals)) {
      if (other.id === applied.id) continue;
      other.status = statusAfterCommittedChange(other, session.state.version);
    }
    session.idempotency[body.idempotencyKey] = {
      key: body.idempotencyKey,
      requestHash: payloadHash,
      resultRef: applied.id,
      createdAt: new Date().toISOString(),
    };
    await this.ctx.storage.put(SESSION_KEY, session);
    return success(requestId, { proposal: applied, state: session.state });
  }

  /** Applies a direct human edit and supersedes proposals based on old state. */
  private async edit(
    request: Request,
    requestId: string,
    session: StoredSession,
    actor: Actor,
  ): Promise<Response> {
    if (actor.kind !== 'human_ui')
      return failure(requestId, 'FORBIDDEN_ACTOR', 'Human route required.');
    const body = (await readBoundedJson(request)) as EditBody;
    if (body.expectedVersion !== session.state.version) {
      return failure(requestId, 'VERSION_CONFLICT', 'Committed state changed.');
    }
    const validation = Array.isArray(body.operations)
      ? validateOperations(body.operations)
      : { allowed: false as const, code: 'INVALID_INPUT' as const };
    if (!validation.allowed) {
      return failure(requestId, validation.code, 'Edit operations were invalid.');
    }
    const reduced = applyOperations(session.state, body.operations, () => crypto.randomUUID());
    if (!reduced.ok) return failure(requestId, reduced.code, 'Edit could not be applied.');
    session.state = reduced.state;
    for (const proposal of Object.values(session.proposals)) {
      proposal.status = statusAfterCommittedChange(proposal, session.state.version);
    }
    await this.ctx.storage.put(SESSION_KEY, session);
    return success(requestId, { state: session.state });
  }

  /** Deletes an expired session; otherwise expires proposals and reschedules. */
  async alarm(): Promise<void> {
    const session = await this.ctx.storage.get<StoredSession>(SESSION_KEY);
    if (session === undefined) return;
    const now = Date.now();
    if (Date.parse(session.expiresAt) <= now) {
      await this.ctx.storage.deleteAll();
      return;
    }
    for (const proposal of Object.values(session.proposals)) {
      if (
        (proposal.status === 'pending_human' || proposal.status === 'approved') &&
        Date.parse(proposal.expiresAt) <= now
      ) {
        proposal.status = 'expired';
      }
    }
    await this.ctx.storage.put(SESSION_KEY, session);
    await this.ctx.storage.setAlarm(new Date(session.expiresAt));
  }
}
