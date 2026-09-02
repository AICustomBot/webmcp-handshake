/**
 * Deterministic policy engine.
 *
 * Every decision in this file is a pure function of explicit inputs. No model
 * output, DOM text or agent-supplied claim can influence an authorization
 * outcome. The engine fails closed: unknown or ambiguous states deny.
 */

import { CONTRACT_VERSION, LIMITS, RETRYABLE_ERROR_CODES } from '@handshake/contracts';
import type {
  Actor,
  CheckFinding,
  Confirmation,
  DesignEvaluation,
  ErrorCode,
  IdempotencyRecord,
  Operation,
  Product,
  Proposal,
  ProposalStatus,
  ProtectedAction,
  RoomItem,
  RoomState,
  ToolError,
} from '@handshake/contracts';

export type Decision = { allowed: true } | { allowed: false; code: ErrorCode };

/** Retained name for the proposal gate used by the runtime and its tests. */
export type ApplyDecision = Decision;

function allow(): Decision {
  return { allowed: true };
}

function deny(code: ErrorCode): Decision {
  return { allowed: false, code };
}

export function toToolError(code: ErrorCode, message: string): ToolError {
  return { code, message, retryable: RETRYABLE_ERROR_CODES.includes(code) };
}

/** An unparseable timestamp is treated as already expired. Fail closed. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return true;
  return expiry <= now.getTime();
}

function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Canonical JSON: sorted keys, dropped undefined members, no incidental
 * whitespace. Two structurally equal payloads always produce one string, so a
 * hash cannot be changed by reordering fields.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value) {
      items.push(canonicalize(item));
    }
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort(compareKeys);
    const parts: string[] = [];
    for (const key of keys) {
      const child = source[key];
      if (child === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalize(child)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new TypeError(`Cannot canonicalize a value of type ${typeof value}`);
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const octets: string[] = [];
  for (const byte of new Uint8Array(digest)) {
    octets.push(byte.toString(16).padStart(2, '0'));
  }
  return octets.join('');
}

export interface ProposalHashInput {
  sessionId: string;
  baseVersion: number;
  operations: readonly Operation[];
}

/**
 * Binds a proposal to its session, its base version and its exact operations.
 * The human approves this hash, and application re-checks it, so an approved
 * proposal cannot be swapped for different work.
 */
export async function proposalHash(input: ProposalHashInput): Promise<string> {
  const canonical = canonicalize({
    contractVersion: CONTRACT_VERSION,
    sessionId: input.sessionId,
    baseVersion: input.baseVersion,
    operations: input.operations,
  });
  return sha256Hex(canonical);
}

export async function requestHash(payload: unknown): Promise<string> {
  return sha256Hex(canonicalize(payload));
}

function statusDenial(status: ProposalStatus): Decision {
  switch (status) {
    case 'approved':
      return allow();
    case 'pending_human':
      return deny('PROPOSAL_NOT_APPROVED');
    case 'rejected':
      return deny('PROPOSAL_REJECTED');
    case 'applied':
      return deny('PROPOSAL_ALREADY_APPLIED');
    case 'expired':
      return deny('PROPOSAL_EXPIRED');
    case 'superseded':
      return deny('PROPOSAL_SUPERSEDED');
    case 'invalidated':
      return deny('PROPOSAL_SUPERSEDED');
  }
  return deny('POLICY_BLOCKED');
}

function isPlacementCoordinate(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return value >= 0 && value <= LIMITS.maxRoomDimensionIn;
}

export function validateOperations(operations: readonly Operation[]): Decision {
  if (operations.length === 0) return deny('INVALID_INPUT');
  if (operations.length > LIMITS.maxOperationsPerProposal) return deny('LIMIT_EXCEEDED');
  for (const operation of operations) {
    if (operation.type === 'place') {
      if (operation.productId.length === 0) return deny('INVALID_INPUT');
      if (!isPlacementCoordinate(operation.x)) return deny('INVALID_INPUT');
      if (!isPlacementCoordinate(operation.y)) return deny('INVALID_INPUT');
      continue;
    }
    if (operation.type === 'move') {
      if (operation.itemId.length === 0) return deny('INVALID_INPUT');
      if (!isPlacementCoordinate(operation.x)) return deny('INVALID_INPUT');
      if (!isPlacementCoordinate(operation.y)) return deny('INVALID_INPUT');
      continue;
    }
    if (operation.type === 'swap') {
      if (operation.itemId.length === 0) return deny('INVALID_INPUT');
      if (operation.replacementProductId.length === 0) return deny('INVALID_INPUT');
      continue;
    }
    if (operation.itemId.length === 0) return deny('INVALID_INPUT');
  }
  return allow();
}

export interface CreateProposalContext {
  actor: Actor;
  state: RoomState;
  expectedVersion: number;
  operations: readonly Operation[];
  pendingCount: number;
}

/**
 * Proposing is allowed for an agent because it changes nothing. It still must
 * name the version it reasoned about, so a stale proposal is refused instead
 * of being silently rebased onto newer state.
 */
export function mayCreateProposal(context: CreateProposalContext): Decision {
  if (context.actor.kind === 'system') return deny('FORBIDDEN_ACTOR');
  if (context.actor.sessionId !== context.state.sessionId) return deny('FORBIDDEN_ACTOR');
  if (context.expectedVersion !== context.state.version) return deny('VERSION_CONFLICT');
  if (context.pendingCount >= LIMITS.maxPendingProposals) return deny('LIMIT_EXCEEDED');
  return validateOperations(context.operations);
}

export interface DecisionContext {
  proposal: Proposal;
  actor: Actor;
  proposalHash: string;
  now?: Date;
}

/**
 * The self-approval guard. Only a human acting through the page UI, in the
 * proposal's own session, can decide it, and only against the exact hash that
 * was rendered for review.
 */
export function mayDecide(context: DecisionContext): Decision {
  const now = context.now ?? new Date();
  if (context.actor.kind !== 'human_ui') return deny('FORBIDDEN_ACTOR');
  if (context.actor.sessionId !== context.proposal.sessionId) return deny('FORBIDDEN_ACTOR');
  if (context.proposal.status === 'approved') return deny('PROPOSAL_ALREADY_DECIDED');
  if (context.proposal.status !== 'pending_human') return statusDenial(context.proposal.status);
  if (context.proposalHash !== context.proposal.hash) return deny('PROPOSAL_HASH_MISMATCH');
  if (isExpired(context.proposal.expiresAt, now)) return deny('PROPOSAL_EXPIRED');
  return allow();
}

/**
 * The mutation gate. Checked immediately before any state change, inside the
 * single-threaded Durable Object, so the version cannot move underneath it.
 */
export function mayApply(proposal: Proposal, state: RoomState, now: Date = new Date()): Decision {
  if (proposal.sessionId !== state.sessionId) return deny('FORBIDDEN_ACTOR');
  if (proposal.status !== 'approved') return statusDenial(proposal.status);
  if (isExpired(proposal.expiresAt, now)) return deny('PROPOSAL_EXPIRED');
  if (proposal.baseVersion !== state.version) return deny('VERSION_CONFLICT');
  return allow();
}

export interface ApplyContext {
  proposal: Proposal;
  state: RoomState;
  proposalHash: string;
  now?: Date;
}

export function mayApplyWithHash(context: ApplyContext): Decision {
  if (context.proposalHash !== context.proposal.hash) return deny('PROPOSAL_HASH_MISMATCH');
  return mayApply(context.proposal, context.state, context.now ?? new Date());
}

export type IdempotencyOutcome =
  | { outcome: 'proceed' }
  | { outcome: 'replay'; record: IdempotencyRecord }
  | { outcome: 'conflict'; code: ErrorCode };

/**
 * A repeated key with an identical payload replays the stored result. A
 * repeated key with a different payload is a conflict, never a new write.
 */
export function checkIdempotency(
  existing: IdempotencyRecord | undefined,
  requestPayloadHash: string,
): IdempotencyOutcome {
  if (existing === undefined) return { outcome: 'proceed' };
  if (existing.requestHash === requestPayloadHash) return { outcome: 'replay', record: existing };
  return { outcome: 'conflict', code: 'IDEMPOTENCY_CONFLICT' };
}

export interface ProtectedActionContext {
  actor: Actor;
  action: ProtectedAction;
  payloadHash: string;
  confirmation?: Confirmation;
  now?: Date;
}

/**
 * Protected actions require a fresh, unconsumed, single-use confirmation that
 * matches this action and this exact payload. Absent evidence denies.
 */
export function mayPerformProtectedAction(context: ProtectedActionContext): Decision {
  const now = context.now ?? new Date();
  const confirmation = context.confirmation;
  if (confirmation === undefined) return deny('CONFIRMATION_REQUIRED');
  if (confirmation.sessionId !== context.actor.sessionId) return deny('FORBIDDEN_ACTOR');
  if (confirmation.action !== context.action) return deny('CONFIRMATION_REQUIRED');
  if (confirmation.payloadHash !== context.payloadHash) return deny('CONFIRMATION_REQUIRED');
  if (confirmation.consumedAt !== undefined) return deny('CONFIRMATION_REQUIRED');
  if (isExpired(confirmation.expiresAt, now)) return deny('CONFIRMATION_EXPIRED');
  return allow();
}

/**
 * When committed state moves, any live proposal computed against the old
 * version is superseded rather than rebased. Terminal statuses are untouched.
 */
export function statusAfterCommittedChange(proposal: Proposal, newVersion: number): ProposalStatus {
  if (proposal.status !== 'pending_human' && proposal.status !== 'approved') {
    return proposal.status;
  }
  if (proposal.baseVersion === newVersion) return proposal.status;
  return 'superseded';
}

/** Marks a proposal expired once its review window closes. */
export function statusAfterExpiry(proposal: Proposal, now: Date = new Date()): ProposalStatus {
  if (proposal.status !== 'pending_human' && proposal.status !== 'approved') {
    return proposal.status;
  }
  if (!isExpired(proposal.expiresAt, now)) return proposal.status;
  return 'expired';
}

export type OperationResult = { ok: true; state: RoomState } | { ok: false; code: ErrorCode };

/**
 * Pure reducer. Produces the next committed state without touching storage,
 * so the same transition can be replayed in a test and in the runtime.
 */
export function applyOperations(
  state: RoomState,
  operations: readonly Operation[],
  newItemId: (index: number) => string,
): OperationResult {
  const items: RoomItem[] = state.items.map((item) => ({ ...item }));
  let placements = 0;
  for (const operation of operations) {
    if (operation.type === 'place') {
      if (items.length >= LIMITS.maxItemsPerRoom) return { ok: false, code: 'LIMIT_EXCEEDED' };
      items.push({
        id: newItemId(placements),
        productId: operation.productId,
        x: operation.x,
        y: operation.y,
        rotation: operation.rotation,
      });
      placements += 1;
      continue;
    }
    const position = items.findIndex((item) => item.id === operation.itemId);
    if (position === -1) return { ok: false, code: 'INVALID_INPUT' };
    const current = items[position];
    if (current === undefined) return { ok: false, code: 'INVALID_INPUT' };
    if (operation.type === 'move') {
      items[position] = {
        ...current,
        x: operation.x,
        y: operation.y,
        rotation: operation.rotation,
      };
      continue;
    }
    if (operation.type === 'swap') {
      items[position] = { ...current, productId: operation.replacementProductId };
      continue;
    }
    items.splice(position, 1);
  }
  return { ok: true, state: { ...state, version: state.version + 1, items } };
}

interface Footprint {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function footprint(item: RoomItem, product: Product): Footprint {
  const rotated = item.rotation === 90 || item.rotation === 270;
  const width = rotated ? product.depthIn : product.widthIn;
  const depth = rotated ? product.widthIn : product.depthIn;
  return { left: item.x, top: item.y, right: item.x + width, bottom: item.y + depth };
}

function overlaps(a: Footprint, b: Footprint): boolean {
  if (a.right <= b.left || b.right <= a.left) return false;
  if (a.bottom <= b.top || b.bottom <= a.top) return false;
  return true;
}

function fitsInsideRoom(state: RoomState, box: Footprint): boolean {
  if (box.left < 0 || box.top < 0) return false;
  return box.right <= state.widthIn && box.bottom <= state.lengthIn;
}

interface PlacedItem {
  id: string;
  box: Footprint;
  clearanceIn: number;
}

function findOverlapFindings(placed: readonly PlacedItem[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (let i = 0; i < placed.length; i += 1) {
    const first = placed[i];
    if (first === undefined) continue;
    for (let j = i + 1; j < placed.length; j += 1) {
      const second = placed[j];
      if (second === undefined) continue;
      if (!overlaps(first.box, second.box)) continue;
      findings.push({
        code: 'FIXTURE_OVERLAP',
        severity: 'blocked',
        message: 'Two fixtures occupy the same floor area.',
        itemIds: [first.id, second.id],
      });
    }
  }
  return findings;
}

/**
 * Demonstration clearance only. These findings express the product's own
 * layout preferences for the demo and are not code or accessibility advice.
 */
function findClearanceFindings(state: RoomState, placed: readonly PlacedItem[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (const entry of placed) {
    if (entry.clearanceIn <= 0) continue;
    const strip: Footprint = {
      left: entry.box.left,
      top: entry.box.bottom,
      right: entry.box.right,
      bottom: entry.box.bottom + entry.clearanceIn,
    };
    if (strip.bottom > state.lengthIn) {
      findings.push({
        code: 'CLEARANCE_WARNING',
        severity: 'warning',
        message: `Approach space in front of ${entry.id} runs past the room boundary.`,
        itemIds: [entry.id],
      });
      continue;
    }
    for (const other of placed) {
      if (other.id === entry.id) continue;
      if (!overlaps(strip, other.box)) continue;
      findings.push({
        code: 'CLEARANCE_WARNING',
        severity: 'warning',
        message: `Approach space in front of ${entry.id} is blocked by ${other.id}.`,
        itemIds: [entry.id, other.id],
      });
      break;
    }
  }
  return findings;
}

/**
 * The only source of cost and layout findings. The agent never computes these
 * numbers; it reads them, so the page stays the authority on what is true.
 */
export function evaluateDesign(state: RoomState, catalog: readonly Product[]): DesignEvaluation {
  const products = new Map<string, Product>();
  for (const product of catalog) {
    products.set(product.id, product);
  }

  const findings: CheckFinding[] = [];
  const placed: PlacedItem[] = [];
  let committedCents = 0;

  for (const item of state.items) {
    const product = products.get(item.productId);
    if (product === undefined) {
      findings.push({
        code: 'UNKNOWN_PRODUCT',
        severity: 'blocked',
        message: `Item ${item.id} references a product outside the synthetic catalog.`,
        itemIds: [item.id],
      });
      continue;
    }
    committedCents += product.priceCents;
    const box = footprint(item, product);
    placed.push({ id: item.id, box, clearanceIn: product.clearanceIn });
    if (!fitsInsideRoom(state, box)) {
      findings.push({
        code: 'OUT_OF_BOUNDS',
        severity: 'blocked',
        message: `${product.name} extends past the room boundary.`,
        itemIds: [item.id],
      });
    }
  }

  for (const finding of findOverlapFindings(placed)) {
    findings.push(finding);
  }
  for (const finding of findClearanceFindings(state, placed)) {
    findings.push(finding);
  }

  const overBudget = committedCents > state.budgetCents;
  if (overBudget) {
    findings.push({
      code: 'OVER_BUDGET',
      severity: 'warning',
      message: 'Committed items exceed the session budget.',
      itemIds: [],
    });
  }

  return {
    version: state.version,
    committedCents,
    budgetCents: state.budgetCents,
    overBudget,
    findings,
  };
}
