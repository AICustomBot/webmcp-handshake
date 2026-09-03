/**
 * Deterministic policy engine.
 *
 * Every decision in this file is a pure function of explicit inputs. No model
 * output, DOM text or agent-supplied claim can influence an authorization
 * outcome. The engine fails closed: unknown or ambiguous states deny.
 *
 * This file owns the authorization gates. Planning rules live in
 * `guidelines.ts` and geometry lives in `geometry.ts`, so the part that decides
 * what is allowed stays small enough to read in one sitting.
 */

import {
  CONTRACT_VERSION,
  GUIDELINE_SOURCE,
  LIMITS,
  RETRYABLE_ERROR_CODES,
  ROOM_TYPES,
  WALL_SIDES,
} from '@handshake/contracts';
import type {
  Actor,
  CheckFinding,
  Confirmation,
  DesignEvaluation,
  ErrorCode,
  IdempotencyRecord,
  OpeningKind,
  Operation,
  Product,
  Proposal,
  ProposalStatus,
  ProtectedAction,
  RoomItem,
  RoomOpening,
  RoomState,
  RoomType,
  ToolError,
} from '@handshake/contracts';
import { fitsInsideRoom, footprintOf, overlaps, stripInFront } from './geometry';
import { buildBillOfMaterials, evaluateGuidelines, resolveProduct, roomTypeOf } from './guidelines';
import type { PlacedProduct } from './guidelines';

export {
  centerOf,
  distanceBetween,
  facingGap,
  fitsInsideRoom,
  footprintOf,
  frontVector,
  hasClearSquare,
  openingSwing,
  overlaps,
  pointOnWall,
  rightVector,
  stripBeside,
  stripInFront,
  touches,
  wallLength,
} from './geometry';
export type { Footprint, Point, Vector } from './geometry';
export {
  buildBillOfMaterials,
  evaluateGuidelines,
  openingsOf,
  resolveProduct,
  roomTypeOf,
  serviceAnchorsOf,
} from './guidelines';
export type { GuidelineContext, PlacedProduct, ResolvedProduct } from './guidelines';

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

/** Checks whether a value is a legal room width or length. */
function isRoomDimension(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return value >= LIMITS.minRoomDimensionIn && value <= LIMITS.maxRoomDimensionIn;
}

/** Checks whether a value is a legal distance along a wall. */
function isWallMeasurement(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= LIMITS.maxRoomDimensionIn;
}

/** Checks whether a value is a legal synthetic budget in whole cents. */
function isBudgetCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

const OPENING_KINDS: readonly OpeningKind[] = ['door', 'window', 'passage'];

/**
 * Validates an operation list against shape-independent hard limits.
 *
 * Geometry is only bounds-checked here. Whether the result is a sensible layout
 * is a question for `evaluateDesign`, which reports it as reviewable findings
 * rather than silently refusing the proposal.
 */
export function validateOperations(operations: readonly Operation[]): Decision {
  if (operations.length === 0) return deny('INVALID_INPUT');
  if (operations.length > LIMITS.maxOperationsPerProposal) return deny('LIMIT_EXCEEDED');
  for (const operation of operations) {
    switch (operation.type) {
      case 'place': {
        if (operation.productId.length === 0) return deny('INVALID_INPUT');
        if (!isPlacementCoordinate(operation.x) || !isPlacementCoordinate(operation.y)) {
          return deny('INVALID_INPUT');
        }
        break;
      }
      case 'move': {
        if (operation.itemId.length === 0) return deny('INVALID_INPUT');
        if (!isPlacementCoordinate(operation.x) || !isPlacementCoordinate(operation.y)) {
          return deny('INVALID_INPUT');
        }
        break;
      }
      case 'swap': {
        if (operation.itemId.length === 0 || operation.replacementProductId.length === 0) {
          return deny('INVALID_INPUT');
        }
        break;
      }
      case 'remove': {
        if (operation.itemId.length === 0) return deny('INVALID_INPUT');
        break;
      }
      case 'configure_room': {
        const { roomType, widthIn, lengthIn, budgetCents } = operation;
        if (
          roomType === undefined &&
          widthIn === undefined &&
          lengthIn === undefined &&
          budgetCents === undefined
        ) {
          return deny('INVALID_INPUT');
        }
        if (roomType !== undefined && !ROOM_TYPES.includes(roomType)) return deny('INVALID_INPUT');
        if (widthIn !== undefined && !isRoomDimension(widthIn)) return deny('INVALID_INPUT');
        if (lengthIn !== undefined && !isRoomDimension(lengthIn)) return deny('INVALID_INPUT');
        if (budgetCents !== undefined && !isBudgetCents(budgetCents)) return deny('INVALID_INPUT');
        break;
      }
      case 'add_opening': {
        if (!OPENING_KINDS.includes(operation.kind)) return deny('INVALID_INPUT');
        if (!WALL_SIDES.includes(operation.wall)) return deny('INVALID_INPUT');
        if (!isWallMeasurement(operation.offsetIn)) return deny('INVALID_INPUT');
        if (!isWallMeasurement(operation.widthIn) || operation.widthIn <= 0) {
          return deny('INVALID_INPUT');
        }
        if (!isWallMeasurement(operation.swingIn)) return deny('INVALID_INPUT');
        break;
      }
      case 'move_opening': {
        if (operation.openingId.length === 0) return deny('INVALID_INPUT');
        const { wall, offsetIn, widthIn, swingIn } = operation;
        if (
          wall === undefined &&
          offsetIn === undefined &&
          widthIn === undefined &&
          swingIn === undefined
        ) {
          return deny('INVALID_INPUT');
        }
        if (wall !== undefined && !WALL_SIDES.includes(wall)) return deny('INVALID_INPUT');
        if (offsetIn !== undefined && !isWallMeasurement(offsetIn)) return deny('INVALID_INPUT');
        if (widthIn !== undefined && (!isWallMeasurement(widthIn) || widthIn <= 0)) {
          return deny('INVALID_INPUT');
        }
        if (swingIn !== undefined && !isWallMeasurement(swingIn)) return deny('INVALID_INPUT');
        break;
      }
      case 'remove_opening': {
        if (operation.openingId.length === 0) return deny('INVALID_INPUT');
        break;
      }
    }
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

/**
 * Applies a validated operation list as one pure, versioned state transition.
 *
 * Room envelope and opening changes are ordinary operations, so a change to the
 * room itself is reviewed and hashed exactly like a change to a fixture.
 *
 * @param newItemId - Supplies ids for newly placed items, by placement index.
 * @param newOpeningId - Supplies ids for newly added openings, by add index.
 */
export function applyOperations(
  state: RoomState,
  operations: readonly Operation[],
  newItemId: (index: number) => string,
  newOpeningId: (index: number) => string = (index) => `${newItemId(index)}-opening`,
): OperationResult {
  const items: RoomItem[] = state.items.map((item) => ({ ...item }));
  const openings: RoomOpening[] = (state.openings ?? []).map((opening) => ({ ...opening }));
  let roomType: RoomType | undefined = state.roomType;
  let widthIn = state.widthIn;
  let lengthIn = state.lengthIn;
  let budgetCents = state.budgetCents;
  let placements = 0;
  let additions = 0;
  let openingsTouched = false;

  for (const operation of operations) {
    switch (operation.type) {
      case 'place': {
        if (items.length >= LIMITS.maxItemsPerRoom) return { ok: false, code: 'LIMIT_EXCEEDED' };
        items.push({
          id: newItemId(placements),
          productId: operation.productId,
          x: operation.x,
          y: operation.y,
          rotation: operation.rotation,
        });
        placements += 1;
        break;
      }
      case 'move':
      case 'swap':
      case 'remove': {
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
        } else if (operation.type === 'swap') {
          items[position] = { ...current, productId: operation.replacementProductId };
        } else {
          items.splice(position, 1);
        }
        break;
      }
      case 'configure_room': {
        if (operation.roomType !== undefined) roomType = operation.roomType;
        if (operation.widthIn !== undefined) widthIn = operation.widthIn;
        if (operation.lengthIn !== undefined) lengthIn = operation.lengthIn;
        if (operation.budgetCents !== undefined) budgetCents = operation.budgetCents;
        break;
      }
      case 'add_opening': {
        if (openings.length >= LIMITS.maxOpeningsPerRoom) {
          return { ok: false, code: 'LIMIT_EXCEEDED' };
        }
        openings.push({
          id: newOpeningId(additions),
          kind: operation.kind,
          wall: operation.wall,
          offsetIn: operation.offsetIn,
          widthIn: operation.widthIn,
          swingIn: operation.swingIn,
        });
        additions += 1;
        openingsTouched = true;
        break;
      }
      case 'move_opening': {
        const position = openings.findIndex((opening) => opening.id === operation.openingId);
        if (position === -1) return { ok: false, code: 'INVALID_INPUT' };
        const current = openings[position];
        if (current === undefined) return { ok: false, code: 'INVALID_INPUT' };
        openings[position] = {
          ...current,
          wall: operation.wall ?? current.wall,
          offsetIn: operation.offsetIn ?? current.offsetIn,
          widthIn: operation.widthIn ?? current.widthIn,
          swingIn: operation.swingIn ?? current.swingIn,
        };
        openingsTouched = true;
        break;
      }
      case 'remove_opening': {
        const position = openings.findIndex((opening) => opening.id === operation.openingId);
        if (position === -1) return { ok: false, code: 'INVALID_INPUT' };
        openings.splice(position, 1);
        openingsTouched = true;
        break;
      }
    }
  }

  const next: RoomState = {
    ...state,
    version: state.version + 1,
    widthIn,
    lengthIn,
    budgetCents,
    items,
  };
  if (roomType !== undefined) next.roomType = roomType;
  if (openingsTouched || state.openings !== undefined) next.openings = openings;
  return { ok: true, state: next };
}

/** Finds fixture footprint collisions among floor-standing products. */
function findOverlapFindings(placed: readonly PlacedProduct[]): CheckFinding[] {
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
        itemIds: [first.item.id, second.item.id],
      });
    }
  }
  return findings;
}

/** Finds product-preference clearance boundary and obstruction warnings. */
function findClearanceFindings(state: RoomState, placed: readonly PlacedProduct[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (const entry of placed) {
    if (entry.product.clearanceIn <= 0) continue;
    const strip = stripInFront(entry.box, entry.item.rotation, entry.product.clearanceIn);
    if (!fitsInsideRoom(state, strip)) {
      findings.push({
        code: 'CLEARANCE_WARNING',
        severity: 'warning',
        message: `Approach space in front of ${entry.item.id} runs past the room boundary.`,
        itemIds: [entry.item.id],
      });
      continue;
    }
    for (const other of placed) {
      if (other.item.id === entry.item.id || !overlaps(strip, other.box)) continue;
      findings.push({
        code: 'CLEARANCE_WARNING',
        severity: 'warning',
        message: `Approach space in front of ${entry.item.id} is blocked by ${other.item.id}.`,
        itemIds: [entry.item.id, other.item.id],
      });
      break;
    }
  }
  return findings;
}

/**
 * Evaluates cost, bounds, overlap, clearance and the planning rule pack for the
 * room type, then prices the result as a bill of materials.
 *
 * Findings never gate approval. They are the proof a human reviews before
 * deciding, so the front end must render this evaluation rather than
 * recomputing a weaker one locally.
 */
export function evaluateDesign(state: RoomState, catalog: readonly Product[]): DesignEvaluation {
  const products = new Map(catalog.map((product) => [product.id, resolveProduct(product)]));
  const findings: CheckFinding[] = [];
  const placed: PlacedProduct[] = [];
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
    const box = footprintOf(item, product);
    placed.push({ item, product, box });
    if (!fitsInsideRoom(state, box)) {
      findings.push({
        code: 'OUT_OF_BOUNDS',
        severity: 'blocked',
        message: `${product.name} extends past the room boundary.`,
        itemIds: [item.id],
      });
    }
  }

  // Only floor-standing products contend for floor area. A wall cabinet above a
  // base cabinet is a normal kitchen, not a collision.
  const floorItems = placed.filter((entry) => entry.product.occupiesFloor);
  findings.push(...findOverlapFindings(floorItems), ...findClearanceFindings(state, floorItems));

  const overBudget = committedCents > state.budgetCents;
  if (overBudget) {
    findings.push({
      code: 'OVER_BUDGET',
      severity: 'warning',
      message: 'Committed items exceed the session budget.',
      itemIds: [],
    });
  }

  const roomType = roomTypeOf(state);
  findings.push(...evaluateGuidelines({ state, roomType, placed }));

  let blockedCount = 0;
  let warningCount = 0;
  for (const finding of findings) {
    if (finding.severity === 'blocked') blockedCount += 1;
    if (finding.severity === 'warning') warningCount += 1;
  }

  return {
    version: state.version,
    committedCents,
    budgetCents: state.budgetCents,
    overBudget,
    findings,
    roomType,
    remainingCents: state.budgetCents - committedCents,
    blockedCount,
    warningCount,
    bom: buildBillOfMaterials(state, catalog),
    guidelineSource: GUIDELINE_SOURCE,
  };
}
