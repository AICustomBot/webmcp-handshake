// Value import stays relative so Node-based test runs resolve it without workspace linking;
// type imports use the tsconfig alias and are erased before bundling.
import { LIMITS } from '../../contracts/src/index';
import type {
  CatalogProduct,
  ErrorCode,
  Operation,
  Proposal,
  RoomItem,
  RoomState,
} from '@handshake/contracts';

export type ApplyDecision = { allowed: true } | { allowed: false; code: string };
export function mayApply(proposal: Proposal, state: RoomState, now = new Date()): ApplyDecision {
  if (proposal.status !== 'approved') return { allowed: false, code: 'PROPOSAL_NOT_APPROVED' };
  if (new Date(proposal.expiresAt) <= now) return { allowed: false, code: 'PROPOSAL_EXPIRED' };
  if (proposal.baseVersion !== state.version) return { allowed: false, code: 'VERSION_CONFLICT' };
  return { allowed: true };
}

/** Axis-aligned footprint rectangle in room inches. */
export interface Footprint {
  x: number;
  y: number;
  w: number;
  l: number;
}

/** Rotation 90|270 swaps width/length; wall-mount items occupy no floor space (budget-only). */
export function footprintOf(
  item: { x: number; y: number; rotation: 0 | 90 | 180 | 270 },
  product: Pick<CatalogProduct, 'widthIn' | 'lengthIn' | 'wallMount'>,
): Footprint {
  if (product.wallMount) return { x: item.x, y: item.y, w: 0, l: 0 };
  const swap = item.rotation === 90 || item.rotation === 270;
  return {
    x: item.x,
    y: item.y,
    w: swap ? product.lengthIn : product.widthIn,
    l: swap ? product.widthIn : product.lengthIn,
  };
}

/** Strict interior overlap: shared edges and zero-footprint (wall-mount) rects never overlap. */
export function rectsOverlap(a: Footprint, b: Footprint): boolean {
  if (a.w <= 0 || a.l <= 0 || b.w <= 0 || b.l <= 0) return false;
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.l && b.y < a.y + a.l;
}

/** True when the rect is fully inside the 0,0..widthIn,lengthIn room rectangle. */
export function insideBounds(
  rect: Footprint,
  room: { widthIn: number; lengthIn: number },
): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= room.widthIn &&
    rect.y + rect.l <= room.lengthIn
  );
}

function fullyInside(inner: Footprint, outer: Footprint): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.l <= outer.y + outer.l
  );
}

/** Clearance rectangle of the given depth in front of the item, facing by rotation. */
function clearanceRect(rect: Footprint, rotation: 0 | 90 | 180 | 270, depth: number): Footprint {
  switch (rotation) {
    case 0:
      return { x: rect.x, y: rect.y + rect.l, w: rect.w, l: depth };
    case 180:
      return { x: rect.x, y: rect.y - depth, w: rect.w, l: depth };
    case 90:
      return { x: rect.x + rect.w, y: rect.y, w: depth, l: rect.l };
    case 270:
      return { x: rect.x - depth, y: rect.y, w: depth, l: rect.l };
  }
}

export type ClearanceCode = 'bounds' | 'overlap' | 'door_zone' | 'front_clearance';
export type ClearanceStatus = 'pass' | 'warning' | 'blocked';
export interface ClearanceFinding {
  code: ClearanceCode;
  status: ClearanceStatus;
  itemIds: string[];
  detail: string;
}

function passEntry(code: ClearanceCode): ClearanceFinding {
  return { code, status: 'pass', itemIds: [], detail: `demo heuristic: no ${code} issues` };
}

/**
 * Deterministic demo-heuristic checks over committed placements (plan §5). One entry per
 * violation (bounds item, overlap pair, door-zone item, front-clearance owner), or a single
 * `pass` entry for a code when it is clean. Never a compliance claim.
 */
export function checkClearances(
  room: RoomState,
  catalog: readonly CatalogProduct[],
  door: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 36, h: 30 },
): ClearanceFinding[] {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const doorRect: Footprint = { x: door.x, y: door.y, w: door.w, l: door.h };
  // Items referencing an unknown product are skipped: read-side heuristic, no geometry available.
  const placed: { item: RoomItem; rect: Footprint; index: number }[] = [];
  for (const item of room.items) {
    const product = byId.get(item.productId);
    if (!product) continue;
    placed.push({ item, rect: footprintOf(item, product), index: placed.length });
  }

  const findings: ClearanceFinding[] = [];

  const bounds: ClearanceFinding[] = [];
  for (const { item, rect } of placed) {
    if (insideBounds(rect, room)) continue;
    const overflow = Math.max(
      -rect.x,
      -rect.y,
      rect.x + rect.w - room.widthIn,
      rect.y + rect.l - room.lengthIn,
    );
    const rounded = Math.round(overflow * 100) / 100;
    bounds.push({
      code: 'bounds',
      status: overflow <= 2 ? 'warning' : 'blocked',
      itemIds: [item.id],
      detail: `demo heuristic: item ${item.id} exceeds room bounds by ${rounded}in`,
    });
  }
  findings.push(...(bounds.length > 0 ? bounds : [passEntry('bounds')]));

  const overlaps: ClearanceFinding[] = [];
  const seen: { item: RoomItem; rect: Footprint; index: number }[] = [];
  for (const a of placed) {
    for (const b of seen) {
      if (!rectsOverlap(a.rect, b.rect)) continue;
      const first = a.index < b.index ? a : b;
      const second = a.index < b.index ? b : a;
      overlaps.push({
        code: 'overlap',
        status: 'blocked',
        itemIds: [first.item.id, second.item.id],
        detail: `demo heuristic: items ${first.item.id} and ${second.item.id} footprints overlap`,
      });
    }
    seen.push(a);
  }
  findings.push(...(overlaps.length > 0 ? overlaps : [passEntry('overlap')]));

  const doorZone: ClearanceFinding[] = [];
  for (const { item, rect } of placed) {
    if (!rectsOverlap(rect, doorRect)) continue;
    const contained = fullyInside(rect, doorRect);
    doorZone.push({
      code: 'door_zone',
      status: contained ? 'blocked' : 'warning',
      itemIds: [item.id],
      detail: contained
        ? `demo heuristic: item ${item.id} sits fully inside the door zone`
        : `demo heuristic: item ${item.id} partially covers the door zone`,
    });
  }
  findings.push(...(doorZone.length > 0 ? doorZone : [passEntry('door_zone')]));

  const front: ClearanceFinding[] = [];
  for (const { item, rect } of placed) {
    const product = byId.get(item.productId);
    if (!product || product.wallMount || product.clearanceIn <= 0) continue;
    const clearance = clearanceRect(rect, item.rotation, product.clearanceIn);
    const intruders = placed.filter(
      (other) => other.item.id !== item.id && rectsOverlap(other.rect, clearance),
    );
    if (intruders.length === 0) continue;
    const blocked = intruders.some((other) => fullyInside(other.rect, clearance));
    const ids = intruders.map((other) => other.item.id).join(', ');
    front.push({
      code: 'front_clearance',
      status: blocked ? 'blocked' : 'warning',
      itemIds: [item.id, ...intruders.map((other) => other.item.id)],
      detail: blocked
        ? `demo heuristic: front clearance of item ${item.id} fully occupied by ${ids}`
        : `demo heuristic: front clearance of item ${item.id} partially occupied by ${ids}`,
    });
  }
  findings.push(...(front.length > 0 ? front : [passEntry('front_clearance')]));

  return findings;
}

export interface BudgetStatusResult {
  committedCents: number;
  limitCents: number;
  remainingCents: number;
  status: 'ok' | 'near' | 'over';
  nearThreshold: 0.85;
}

/** Committed = sum of placed product prices; near at >= 85% (integer math: 17/20), over above limit. */
export function budgetStatus(
  room: RoomState,
  catalog: readonly CatalogProduct[],
): BudgetStatusResult {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  let committedCents = 0;
  for (const item of room.items) {
    committedCents += byId.get(item.productId)?.priceCents ?? 0;
  }
  const status =
    committedCents > room.budgetCents
      ? 'over'
      : committedCents * 20 >= room.budgetCents * 17
        ? 'near'
        : 'ok';
  return {
    committedCents,
    limitCents: room.budgetCents,
    remainingCents: room.budgetCents - committedCents,
    status,
    nearThreshold: 0.85,
  };
}

type ReduceResult =
  | { ok: true; items: RoomItem[] }
  | { ok: false; code: Extract<ErrorCode, 'INVALID_INPUT' | 'NOT_FOUND'> };

function nextItemId(items: readonly RoomItem[]): string {
  let max = 0;
  for (const item of items) {
    const match = /^item-(\d+)$/.exec(item.id);
    max = Math.max(max, Number(match?.[1] ?? 0));
  }
  return `item-${max + 1}`;
}

/** Single-operation reducer over a working item list; pure, never mutates inputs. */
function reduceOne(
  room: RoomState,
  catalog: readonly CatalogProduct[],
  items: readonly RoomItem[],
  op: Operation,
): ReduceResult {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const working = items.map((item) => ({ ...item }));
  switch (op.type) {
    case 'place': {
      if (!byId.has(op.productId)) return { ok: false, code: 'INVALID_INPUT' };
      working.push({
        id: nextItemId(working),
        productId: op.productId,
        x: op.x,
        y: op.y,
        rotation: op.rotation,
      });
      return { ok: true, items: working };
    }
    case 'move': {
      const target = working.find((item) => item.id === op.itemId);
      if (!target) return { ok: false, code: 'NOT_FOUND' };
      const product = byId.get(target.productId);
      if (!product) return { ok: false, code: 'INVALID_INPUT' };
      const rect = footprintOf({ x: op.x, y: op.y, rotation: op.rotation }, product);
      if (!insideBounds(rect, room)) return { ok: false, code: 'INVALID_INPUT' };
      return {
        ok: true,
        items: working.map((item) =>
          item.id === op.itemId ? { ...item, x: op.x, y: op.y, rotation: op.rotation } : item,
        ),
      };
    }
    case 'swap': {
      const target = working.find((item) => item.id === op.itemId);
      if (!target) return { ok: false, code: 'NOT_FOUND' };
      if (!byId.has(op.replacementProductId)) return { ok: false, code: 'INVALID_INPUT' };
      const replacement: RoomItem = {
        id: nextItemId(working),
        productId: op.replacementProductId,
        x: target.x,
        y: target.y,
        rotation: target.rotation,
      };
      return {
        ok: true,
        items: [...working.filter((item) => item.id !== op.itemId), replacement],
      };
    }
    case 'remove': {
      if (!working.some((item) => item.id === op.itemId)) return { ok: false, code: 'NOT_FOUND' };
      return { ok: true, items: working.filter((item) => item.id !== op.itemId) };
    }
  }
}

export type ApplyOperationsResult = { ok: true; room: RoomState } | { ok: false; code: ErrorCode };

/** Reduces committed operations into a new room state (version + 1); fails closed on any error. */
export function applyOperations(
  room: RoomState,
  catalog: readonly CatalogProduct[],
  operations: readonly Operation[],
): ApplyOperationsResult {
  let items = room.items.map((item) => ({ ...item }));
  for (const op of operations) {
    const result = reduceOne(room, catalog, items, op);
    if (!result.ok) return { ok: false, code: result.code };
    items = result.items;
  }
  return { ok: true, room: { ...room, version: room.version + 1, items } };
}

export type ValidateProposalResult =
  { ok: true; projectedCents: number } | { ok: false; code: ErrorCode };

function isRotation(value: unknown): value is 0 | 90 | 180 | 270 {
  return value === 0 || value === 90 || value === 180 || value === 270;
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Runtime shape validation for tool-boundary operation payloads. */
function isOperation(value: unknown): value is Operation {
  if (typeof value !== 'object' || value === null) return false;
  const op = value as Record<string, unknown>;
  switch (op.type) {
    case 'place':
      return (
        isString(op.productId) &&
        isFiniteNumber(op.x) &&
        isFiniteNumber(op.y) &&
        isRotation(op.rotation)
      );
    case 'move':
      return (
        isString(op.itemId) &&
        isFiniteNumber(op.x) &&
        isFiniteNumber(op.y) &&
        isRotation(op.rotation)
      );
    case 'swap':
      return isString(op.itemId) && isString(op.replacementProductId);
    case 'remove':
      return isString(op.itemId);
    default:
      return false;
  }
}

/** Validates a proposal payload before it is accepted: shape, count, simulation, budget projection. */
export function validateProposalOperations(
  room: RoomState,
  catalog: readonly CatalogProduct[],
  operations: readonly unknown[],
  maxOps: number = LIMITS.maxOperationsPerProposal,
): ValidateProposalResult {
  if (operations.length === 0 || operations.length > maxOps) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  const typed: Operation[] = [];
  for (const op of operations) {
    if (!isOperation(op)) return { ok: false, code: 'INVALID_INPUT' };
    typed.push(op);
  }
  let items = room.items.map((item) => ({ ...item }));
  for (const op of typed) {
    const result = reduceOne(room, catalog, items, op);
    if (!result.ok) return { ok: false, code: result.code };
    items = result.items;
  }
  const byId = new Map(catalog.map((product) => [product.id, product]));
  let projectedCents = 0;
  for (const item of items) {
    projectedCents += byId.get(item.productId)?.priceCents ?? 0;
  }
  if (projectedCents > room.budgetCents) return { ok: false, code: 'POLICY_BLOCKED' };
  return { ok: true, projectedCents };
}

export interface ConfirmationRecord {
  actionDigest: string;
  expiresAt: string;
  used: boolean;
}
export type ConfirmDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: 'CONFIRMATION_EXPIRED' | 'CONFIRMATION_ALREADY_USED' | 'DIGEST_MISMATCH';
    };

/** Single-use, digest-bound confirmation gate (plan §4); fails closed in expiry/used/mismatch order. */
export function mayConfirm(
  record: ConfirmationRecord,
  providedDigest: string,
  now = new Date(),
): ConfirmDecision {
  if (new Date(record.expiresAt) <= now) return { allowed: false, code: 'CONFIRMATION_EXPIRED' };
  if (record.used) return { allowed: false, code: 'CONFIRMATION_ALREADY_USED' };
  if (record.actionDigest !== providedDigest) return { allowed: false, code: 'DIGEST_MISMATCH' };
  return { allowed: true };
}
