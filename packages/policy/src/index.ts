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
  Rotation,
  ToolError,
} from '@handshake/contracts';

export type Decision = { allowed: true } | { allowed: false; code: ErrorCode };
export type ApplyDecision = Decision;

/** Returns a successful policy decision. */
function allow(): Decision {
  return { allowed: true };
}

/** Returns a fail-closed policy decision with a stable code. */
function deny(code: ErrorCode): Decision {
  return { allowed: false, code };
}

/** Converts a policy failure into the common tool error envelope. */
export function toToolError(code: ErrorCode, message: string): ToolError {
  return { code, message, retryable: RETRYABLE_ERROR_CODES.includes(code) };
}

/** Returns true when a deadline has passed or cannot be parsed. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return true;
  return expiry <= now.getTime();
}

/** Compares two canonical object keys without locale-dependent behavior. */
function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Produces sorted-key, whitespace-free JSON for deterministic hashing.
 * Undefined object members are omitted and non-finite numbers are rejected.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(source).sort(compareKeys)) {
      const child = source[key];
      if (child === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalize(child)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new TypeError(`Cannot canonicalize a value of type ${typeof value}`);
}

/** Returns the lowercase SHA-256 digest of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface ProposalHashInput {
  sessionId: string;
  baseVersion: number;
  operations: readonly Operation[];
}

/** Hashes the contract version, session, base version and exact operations. */
export async function proposalHash(input: ProposalHashInput): Promise<string> {
  return sha256Hex(
    canonicalize({
      contractVersion: CONTRACT_VERSION,
      sessionId: input.sessionId,
      baseVersion: input.baseVersion,
      operations: input.operations,
    }),
  );
}

/** Hashes a canonicalized idempotent request payload. */
export async function requestHash(payload: unknown): Promise<string> {
  return sha256Hex(canonicalize(payload));
}

/** Maps every non-applicable proposal status to its precise stable error. */
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
      return deny('PROPOSAL_INVALIDATED');
  }
  return deny('POLICY_BLOCKED');
}

/** Checks whether a coordinate is finite and within the hard room bounds. */
function isPlacementCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= LIMITS.maxRoomDimensionIn;
}

/** Validates an operation list against shape-independent hard limits. */
export function validateOperations(operations: readonly Operation[]): Decision {
  if (operations.length === 0) return deny('INVALID_INPUT');
  if (operations.length > LIMITS.maxOperationsPerProposal) return deny('LIMIT_EXCEEDED');
  for (const operation of operations) {
    if (operation.type === 'place') {
      if (operation.productId.length === 0) return deny('INVALID_INPUT');
      if (!isPlacementCoordinate(operation.x) || !isPlacementCoordinate(operation.y)) {
        return deny('INVALID_INPUT');
      }
      continue;
    }
    if (operation.type === 'move') {
      if (operation.itemId.length === 0) return deny('INVALID_INPUT');
      if (!isPlacementCoordinate(operation.x) || !isPlacementCoordinate(operation.y)) {
        return deny('INVALID_INPUT');
      }
      continue;
    }
    if (operation.type === 'swap') {
      if (operation.itemId.length === 0 || operation.replacementProductId.length === 0) {
        return deny('INVALID_INPUT');
      }
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

/** Authorizes creation of a non-mutating proposal against current state. */
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

/** Allows only the page UI to decide a fresh, exact pending proposal. */
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

/** Checks status, expiry and version immediately before a committed write. */
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

/**
 * Recomputes proposal identity and requires the computed, stored and submitted
 * hashes to match before evaluating the remaining mutation gates.
 */
export async function mayApplyWithHash(context: ApplyContext): Promise<Decision> {
  const computed = await proposalHash({
    sessionId: context.proposal.sessionId,
    baseVersion: context.proposal.baseVersion,
    operations: context.proposal.operations,
  });
  if (computed !== context.proposal.hash || computed !== context.proposalHash) {
    return deny('PROPOSAL_HASH_MISMATCH');
  }
  return mayApply(context.proposal, context.state, context.now ?? new Date());
}

export type IdempotencyOutcome =
  | { outcome: 'proceed' }
  | { outcome: 'replay'; record: IdempotencyRecord }
  | { outcome: 'conflict'; code: ErrorCode };

/** Replays identical requests and rejects a reused key with different content. */
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

/** Requires a fresh, unconsumed confirmation for the exact action and payload. */
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

/** Supersedes a live proposal when committed state moves away from its base. */
export function statusAfterCommittedChange(proposal: Proposal, newVersion: number): ProposalStatus {
  if (proposal.status !== 'pending_human' && proposal.status !== 'approved') {
    return proposal.status;
  }
  return proposal.baseVersion === newVersion ? proposal.status : 'superseded';
}

/** Expires a live proposal after its review window closes. */
export function statusAfterExpiry(proposal: Proposal, now: Date = new Date()): ProposalStatus {
  if (proposal.status !== 'pending_human' && proposal.status !== 'approved') {
    return proposal.status;
  }
  return isExpired(proposal.expiresAt, now) ? 'expired' : proposal.status;
}

export type OperationResult = { ok: true; state: RoomState } | { ok: false; code: ErrorCode };

/** Applies a validated operation list as one pure, versioned state transition. */
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

interface PlacedItem {
  id: string;
  box: Footprint;
  clearanceIn: number;
  rotation: Rotation;
}

/** Returns the rotated floor footprint of an item. */
function footprint(item: RoomItem, product: Product): Footprint {
  const rotated = item.rotation === 90 || item.rotation === 270;
  const width = rotated ? product.depthIn : product.widthIn;
  const depth = rotated ? product.widthIn : product.depthIn;
  return { left: item.x, top: item.y, right: item.x + width, bottom: item.y + depth };
}

/** Returns whether two open-edged floor rectangles overlap. */
function overlaps(a: Footprint, b: Footprint): boolean {
  if (a.right <= b.left || b.right <= a.left) return false;
  return !(a.bottom <= b.top || b.bottom <= a.top);
}

/** Returns whether a rectangle lies entirely inside the room. */
function fitsInsideRoom(state: RoomState, box: Footprint): boolean {
  if (box.left < 0 || box.top < 0) return false;
  return box.right <= state.widthIn && box.bottom <= state.lengthIn;
}

/**
 * Returns the product-defined approach strip in front of a rotated fixture.
 * Front directions are: 0 down, 90 left, 180 up and 270 right.
 */
function clearanceFootprint(entry: PlacedItem): Footprint {
  const { box, clearanceIn } = entry;
  switch (entry.rotation) {
    case 0:
      return {
        left: box.left,
        top: box.bottom,
        right: box.right,
        bottom: box.bottom + clearanceIn,
      };
    case 90:
      return {
        left: box.left - clearanceIn,
        top: box.top,
        right: box.left,
        bottom: box.bottom,
      };
    case 180:
      return {
        left: box.left,
        top: box.top - clearanceIn,
        right: box.right,
        bottom: box.top,
      };
    case 270:
      return {
        left: box.right,
        top: box.top,
        right: box.right + clearanceIn,
        bottom: box.bottom,
      };
  }
}

/** Finds fixture footprint collisions. */
function findOverlapFindings(placed: readonly PlacedItem[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (let i = 0; i < placed.length; i += 1) {
    const first = placed[i];
    if (first === undefined) continue;
    for (let j = i + 1; j < placed.length; j += 1) {
      const second = placed[j];
      if (second === undefined || !overlaps(first.box, second.box)) continue;
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

/** Finds product-preference clearance boundary and obstruction warnings. */
function findClearanceFindings(state: RoomState, placed: readonly PlacedItem[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (const entry of placed) {
    if (entry.clearanceIn <= 0) continue;
    const strip = clearanceFootprint(entry);
    if (!fitsInsideRoom(state, strip)) {
      findings.push({
        code: 'CLEARANCE_WARNING',
        severity: 'warning',
        message: `Approach space in front of ${entry.id} runs past the room boundary.`,
        itemIds: [entry.id],
      });
      continue;
    }
    for (const other of placed) {
      if (other.id === entry.id || !overlaps(strip, other.box)) continue;
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

/** Evaluates deterministic synthetic cost, bounds, overlap and clearance rules. */
export function evaluateDesign(state: RoomState, catalog: readonly Product[]): DesignEvaluation {
  const products = new Map(catalog.map((product) => [product.id, product]));
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
    placed.push({
      id: item.id,
      box,
      clearanceIn: product.clearanceIn,
      rotation: item.rotation,
    });
    if (!fitsInsideRoom(state, box)) {
      findings.push({
        code: 'OUT_OF_BOUNDS',
        severity: 'blocked',
        message: `${product.name} extends past the room boundary.`,
        itemIds: [item.id],
      });
    }
  }

  findings.push(...findOverlapFindings(placed), ...findClearanceFindings(state, placed));
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
