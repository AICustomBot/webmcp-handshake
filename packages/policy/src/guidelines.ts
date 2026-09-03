/**
 * Kitchen and bath planning rules.
 *
 * Every rule here is a pure function of committed state and the catalog. No
 * rule reads a clock, a model output or a DOM value, so a finding is always
 * reproducible from the room it describes.
 *
 * Thresholds come from `BATH_GUIDELINES` and `KITCHEN_GUIDELINES` in
 * `@handshake/contracts`, which cite the NKBA Kitchen & Bath Planning
 * Guidelines and the IRC minimums the NKBA references. They are planning
 * recommendations applied to synthetic data, not a code-compliance
 * certification. See docs/decisions/ADR-0004-full-kitchen-and-bath-scope.md.
 *
 * Severity contract:
 * - `blocked`  the layout is physically impossible or breaks a cited code
 *              minimum.
 * - `warning`  a cited recommendation is unmet.
 * - `info`     advisory.
 *
 * None of these gate approval. A human may approve a layout carrying warnings.
 * What the engine guarantees is that the human saw exactly these findings.
 */

import {
  BATH_GUIDELINES,
  CATEGORY_ROOM_TYPES,
  GUIDELINE_SOURCE,
  KITCHEN_GUIDELINES,
} from '@handshake/contracts';
import type {
  BillOfMaterials,
  BomLine,
  CheckFinding,
  MountType,
  Product,
  ProductCategory,
  RoomItem,
  RoomOpening,
  RoomState,
  RoomType,
  ServiceAnchor,
  ServiceKind,
  WorkCenter,
} from '@handshake/contracts';
import {
  centerOf,
  distanceBetween,
  fitsInsideRoom,
  footprintOf,
  frontVector,
  hasClearSquare,
  openingSwing,
  overlaps,
  pointOnWall,
  stripBeside,
  stripInFront,
  touches,
  wallLength,
} from './geometry';
import type { Footprint, Point, Vector } from './geometry';

/**
 * How far a fixture may sit from an existing service location before the
 * engine points out that the service has to be run to it.
 *
 * This is a synthetic demonstration reach, not a plumbing or electrical code
 * rule. Real rough-in distances depend on stack location, joist direction and
 * local amendments, none of which this model represents.
 */
const SERVICE_REACH_IN = 60;

/** Tolerance for treating two edges as coincident, in inches. */
const TOUCH_TOLERANCE_IN = 0.5;

const DEFAULT_MOUNT: Record<ProductCategory, MountType> = {
  vanity: 'floor',
  shower: 'floor',
  tub: 'floor',
  toilet: 'floor',
  storage: 'floor',
  lighting: 'ceiling',
  base_cabinet: 'floor',
  wall_cabinet: 'wall',
  tall_cabinet: 'floor',
  countertop: 'counter',
  island: 'floor',
  sink: 'counter',
  range: 'floor',
  cooktop: 'counter',
  wall_oven: 'wall',
  refrigerator: 'floor',
  dishwasher: 'floor',
  microwave: 'wall',
  hood: 'wall',
};

/**
 * Nominal heights in inches. Base cabinet and countertop heights are the
 * industry standard 34.5 in box under a 1.5 in top, giving a 36 in work
 * surface.
 */
const DEFAULT_HEIGHT_IN: Record<ProductCategory, number> = {
  vanity: 32,
  shower: 80,
  tub: 22,
  toilet: 29,
  storage: 72,
  lighting: 6,
  base_cabinet: 34.5,
  wall_cabinet: 30,
  tall_cabinet: 84,
  countertop: 36,
  island: 36,
  sink: 8,
  range: 36,
  cooktop: 4,
  wall_oven: 28,
  refrigerator: 70,
  dishwasher: 34,
  microwave: 17,
  hood: 30,
};

/** How far a hinged front projects when opened, in inches. */
const DEFAULT_DOOR_SWING_IN: Record<ProductCategory, number> = {
  vanity: 21,
  shower: 26,
  tub: 0,
  toilet: 0,
  storage: 18,
  lighting: 0,
  base_cabinet: 24,
  wall_cabinet: 12,
  tall_cabinet: 24,
  countertop: 0,
  island: 24,
  sink: 0,
  range: 26,
  cooktop: 0,
  wall_oven: 24,
  refrigerator: 30,
  dishwasher: 24,
  microwave: 15,
  hood: 0,
};

/**
 * Landing area required either side of a product, facing it, in inches.
 *
 * NKBA states several of these as "on one side", so they are recorded on a
 * single side and the opposite side is zero. A requirement of zero is always
 * satisfied, which keeps an appliance against a wall from being reported for a
 * landing the guideline never asked for.
 */
const DEFAULT_LANDING: Record<ProductCategory, { left: number; right: number }> = {
  vanity: { left: 0, right: 0 },
  shower: { left: 0, right: 0 },
  tub: { left: 0, right: 0 },
  toilet: { left: 0, right: 0 },
  storage: { left: 0, right: 0 },
  lighting: { left: 0, right: 0 },
  base_cabinet: { left: 0, right: 0 },
  wall_cabinet: { left: 0, right: 0 },
  tall_cabinet: { left: 0, right: 0 },
  countertop: { left: 0, right: 0 },
  island: { left: 0, right: 0 },
  sink: {
    left: KITCHEN_GUIDELINES.sinkLandingPrimaryIn,
    right: KITCHEN_GUIDELINES.sinkLandingSecondaryIn,
  },
  range: {
    left: KITCHEN_GUIDELINES.cooktopLandingPrimaryIn,
    right: KITCHEN_GUIDELINES.cooktopLandingSecondaryIn,
  },
  cooktop: {
    left: KITCHEN_GUIDELINES.cooktopLandingPrimaryIn,
    right: KITCHEN_GUIDELINES.cooktopLandingSecondaryIn,
  },
  wall_oven: { left: 0, right: KITCHEN_GUIDELINES.ovenLandingIn },
  refrigerator: { left: 0, right: KITCHEN_GUIDELINES.refrigeratorLandingIn },
  dishwasher: { left: 0, right: 0 },
  microwave: { left: 0, right: KITCHEN_GUIDELINES.microwaveLandingIn },
  hood: { left: 0, right: 0 },
};

const DEFAULT_WORK_CENTER: Partial<Record<ProductCategory, WorkCenter>> = {
  sink: 'sink',
  range: 'cooktop',
  cooktop: 'cooktop',
  refrigerator: 'refrigerator',
};

/** Products that themselves provide usable counter surface. */
const COUNTER_RUN_CATEGORIES: readonly ProductCategory[] = [
  'base_cabinet',
  'countertop',
  'island',
  'sink',
  'cooktop',
  'vanity',
];

/** Products that make an aisle between them a work aisle rather than a walkway. */
const WORK_ITEM_CATEGORIES: readonly ProductCategory[] = [
  'base_cabinet',
  'tall_cabinet',
  'countertop',
  'island',
  'sink',
  'range',
  'cooktop',
  'wall_oven',
  'refrigerator',
  'dishwasher',
];

const PLUMBED_CATEGORIES: readonly ProductCategory[] = [
  'vanity',
  'shower',
  'tub',
  'toilet',
  'sink',
  'dishwasher',
];

const POWERED_CATEGORIES: readonly ProductCategory[] = [
  'lighting',
  'range',
  'cooktop',
  'wall_oven',
  'refrigerator',
  'dishwasher',
  'microwave',
  'hood',
];

const VENTED_CATEGORIES: readonly ProductCategory[] = ['hood', 'range'];

/** A product with every optional member resolved to a documented default. */
export interface ResolvedProduct extends Product {
  sku: string;
  heightIn: number;
  mount: MountType;
  doorSwingIn: number;
  requiresPlumbing: boolean;
  requiresElectrical: boolean;
  requiresVenting: boolean;
  landingLeftIn: number;
  landingRightIn: number;
  counterRun: boolean;
  /** Whether this product consumes floor area, derived from its mount. */
  occupiesFloor: boolean;
}

/** A placed item paired with its resolved product and rotated footprint. */
export interface PlacedProduct {
  item: RoomItem;
  product: ResolvedProduct;
  box: Footprint;
}

/**
 * Fills every optional product member from its category default so rules never
 * branch on absence. Explicit catalog values always win.
 */
export function resolveProduct(product: Product): ResolvedProduct {
  const category = product.category;
  const mount = product.mount ?? DEFAULT_MOUNT[category];
  const landing = DEFAULT_LANDING[category];
  const workCenter = product.workCenter ?? DEFAULT_WORK_CENTER[category];
  const resolved: ResolvedProduct = {
    ...product,
    sku: product.sku ?? `HSK-${product.id.toUpperCase()}`,
    heightIn: product.heightIn ?? DEFAULT_HEIGHT_IN[category],
    mount,
    doorSwingIn: product.doorSwingIn ?? DEFAULT_DOOR_SWING_IN[category],
    requiresPlumbing: product.requiresPlumbing ?? PLUMBED_CATEGORIES.includes(category),
    requiresElectrical: product.requiresElectrical ?? POWERED_CATEGORIES.includes(category),
    requiresVenting: product.requiresVenting ?? VENTED_CATEGORIES.includes(category),
    landingLeftIn: product.landingLeftIn ?? landing.left,
    landingRightIn: product.landingRightIn ?? landing.right,
    counterRun: product.counterRun ?? COUNTER_RUN_CATEGORIES.includes(category),
    occupiesFloor: mount === 'floor',
  };
  if (workCenter !== undefined) resolved.workCenter = workCenter;
  return resolved;
}

/** Returns the room type, treating a pre-2.0.0 session as a bathroom. */
export function roomTypeOf(state: RoomState): RoomType {
  return state.roomType ?? 'bathroom';
}

/** Returns modelled openings, or an empty list when none were modelled. */
export function openingsOf(state: RoomState): readonly RoomOpening[] {
  return state.openings ?? [];
}

/** Returns modelled service anchors, or an empty list when none were modelled. */
export function serviceAnchorsOf(state: RoomState): readonly ServiceAnchor[] {
  return state.serviceAnchors ?? [];
}

/** Returns the shortest distance between two rectangles, zero when touching. */
function rectDistance(a: Footprint, b: Footprint): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Returns the distance to the nearest matching service anchor, or infinity when
 * no anchor of that kind was modelled.
 *
 * Reporting the real distance is what makes the finding auditable: "the nearest
 * drain is 82 in away" can be checked against the drawing, whereas repeating
 * the reach limit back to the reader proves nothing.
 */
function nearestAnchorDistance(
  state: RoomState,
  center: Point,
  anchors: readonly ServiceAnchor[],
  matches: (anchor: ServiceAnchor) => boolean,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    if (!matches(anchor)) continue;
    const point = pointOnWall(state, anchor.wall, anchor.offsetIn);
    best = Math.min(best, distanceBetween(center, point));
  }
  return best;
}

/** Returns the unit vector to the left of someone facing the item. */
function leftOf(front: Vector): Vector {
  return { x: -front.y, y: front.x };
}

/** Returns the unit vector to the right of someone facing the item. */
function rightOf(front: Vector): Vector {
  return { x: front.y, y: -front.x };
}

/**
 * Returns whether `b` lies in front of `a` rather than off to one side, which
 * is what makes the space between them an aisle instead of a diagonal gap.
 */
function facesToward(a: PlacedProduct, b: PlacedProduct): boolean {
  const front = frontVector(a.item.rotation);
  const from = centerOf(a.box);
  const to = centerOf(b.box);
  const delta = { x: to.x - from.x, y: to.y - from.y };
  const along = front.x * delta.x + front.y * delta.y;
  if (along <= 0) return false;
  const across = Math.abs(front.x === 0 ? delta.x : delta.y);
  return across < along;
}

/** Returns whether an item runs along the x axis rather than the y axis. */
function runsAlongX(placed: PlacedProduct): boolean {
  return placed.item.rotation === 0 || placed.item.rotation === 180;
}

/**
 * Returns whether a landing strip of the required depth exists beside an item.
 *
 * Free floor counts as satisfied: the strip is space the counter can occupy.
 * A non-counter obstruction or the room boundary does not.
 */
function landingSatisfied(
  state: RoomState,
  subject: PlacedProduct,
  direction: Vector,
  requiredIn: number,
  floorItems: readonly PlacedProduct[],
): boolean {
  if (requiredIn <= 0) return true;
  const strip = stripBeside(subject.box, direction, requiredIn);
  if (!fitsInsideRoom(state, strip)) return false;
  for (const other of floorItems) {
    if (other.item.id === subject.item.id) continue;
    if (other.product.counterRun) continue;
    if (overlaps(strip, other.box)) return false;
  }
  return true;
}

/** Rules that apply to any room type. */
function evaluateShared(
  state: RoomState,
  roomType: RoomType,
  placed: readonly PlacedProduct[],
): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const floorItems = placed.filter((entry) => entry.product.occupiesFloor);
  const openings = openingsOf(state);
  const anchors = serviceAnchorsOf(state);

  for (const entry of placed) {
    const allowedRooms = CATEGORY_ROOM_TYPES[entry.product.category];
    if (!allowedRooms.includes(roomType)) {
      findings.push({
        code: 'CATEGORY_ROOM_MISMATCH',
        severity: 'warning',
        message: `${entry.product.name} is a ${entry.product.category.replace(/_/g, ' ')}, which does not belong in a ${roomType}.`,
        itemIds: [entry.item.id],
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  const minDoorwayIn =
    roomType === 'kitchen' ? KITCHEN_GUIDELINES.minDoorwayIn : BATH_GUIDELINES.minDoorwayIn;
  const recommendedDoorwayIn =
    roomType === 'kitchen'
      ? KITCHEN_GUIDELINES.recommendedDoorwayIn
      : BATH_GUIDELINES.recommendedDoorwayIn;

  for (const opening of openings) {
    const span = wallLength(state, opening.wall);
    if (opening.offsetIn < 0 || opening.widthIn <= 0 || opening.offsetIn + opening.widthIn > span) {
      findings.push({
        code: 'OPENING_INVALID',
        severity: 'blocked',
        message: `The ${opening.kind} on the ${opening.wall} wall does not fit on that wall.`,
        itemIds: [],
        openingIds: [opening.id],
        measuredIn: opening.offsetIn + opening.widthIn,
        recommendedIn: span,
        guideline: GUIDELINE_SOURCE,
      });
      continue;
    }
    if (opening.kind === 'door' && opening.widthIn < minDoorwayIn) {
      findings.push({
        code: 'OPENING_INVALID',
        severity: 'warning',
        message: `The door on the ${opening.wall} wall is ${opening.widthIn} in wide. ${minDoorwayIn} in is the usable minimum and ${recommendedDoorwayIn} in is recommended.`,
        itemIds: [],
        openingIds: [opening.id],
        measuredIn: opening.widthIn,
        recommendedIn: recommendedDoorwayIn,
        guideline: GUIDELINE_SOURCE,
      });
    }

    const swing = openingSwing(state, opening);
    if (opening.swingIn <= 0) continue;
    for (const entry of floorItems) {
      if (!overlaps(swing, entry.box)) continue;
      findings.push({
        code: 'DOOR_BLOCKED',
        severity: 'blocked',
        message: `${entry.product.name} stands in the path of the ${opening.kind} on the ${opening.wall} wall.`,
        itemIds: [entry.item.id],
        openingIds: [opening.id],
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  for (let i = 0; i < openings.length; i += 1) {
    const first = openings[i];
    if (first === undefined || first.swingIn <= 0) continue;
    for (let j = i + 1; j < openings.length; j += 1) {
      const second = openings[j];
      if (second === undefined || second.swingIn <= 0) continue;
      if (!overlaps(openingSwing(state, first), openingSwing(state, second))) continue;
      findings.push({
        code: 'DOOR_BLOCKED',
        severity: 'warning',
        message: `The ${first.kind} on the ${first.wall} wall and the ${second.kind} on the ${second.wall} wall swing into each other.`,
        itemIds: [],
        openingIds: [first.id, second.id],
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  const swingers = floorItems.filter((entry) => entry.product.doorSwingIn > 0);
  for (let i = 0; i < swingers.length; i += 1) {
    const first = swingers[i];
    if (first === undefined) continue;
    const firstSwing = stripInFront(first.box, first.item.rotation, first.product.doorSwingIn);
    for (let j = i + 1; j < swingers.length; j += 1) {
      const second = swingers[j];
      if (second === undefined) continue;
      const secondSwing = stripInFront(
        second.box,
        second.item.rotation,
        second.product.doorSwingIn,
      );
      if (!overlaps(firstSwing, secondSwing)) continue;
      findings.push({
        code: 'APPLIANCE_DOOR_CONFLICT',
        severity: 'warning',
        message: `${first.product.name} and ${second.product.name} cannot both be opened at once.`,
        itemIds: [first.item.id, second.item.id],
        guideline: GUIDELINE_SOURCE,
      });
    }
    for (const opening of openings) {
      if (opening.swingIn <= 0) continue;
      if (!overlaps(firstSwing, openingSwing(state, opening))) continue;
      findings.push({
        code: 'APPLIANCE_DOOR_CONFLICT',
        severity: 'warning',
        message: `${first.product.name} cannot be opened while the ${opening.kind} on the ${opening.wall} wall is in use.`,
        itemIds: [first.item.id],
        openingIds: [opening.id],
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  if (anchors.length > 0) {
    for (const entry of placed) {
      const needed: ServiceKind[] = [];
      if (entry.product.requiresPlumbing) needed.push('water', 'drain');
      if (entry.product.requiresVenting) needed.push('vent');
      const center = centerOf(entry.box);
      for (const kind of needed) {
        const nearestIn = nearestAnchorDistance(
          state,
          center,
          anchors,
          (anchor) => anchor.kind === kind,
        );
        if (nearestIn <= SERVICE_REACH_IN) continue;
        const finding: CheckFinding = {
          code: 'MISSING_SERVICE_ANCHOR',
          severity: 'warning',
          message: `${entry.product.name} needs ${kind.replace(/_/g, ' ')} and there is no existing ${kind.replace(/_/g, ' ')} location within ${SERVICE_REACH_IN} in of it.`,
          itemIds: [entry.item.id],
          recommendedIn: SERVICE_REACH_IN,
          guideline: GUIDELINE_SOURCE,
        };
        if (Number.isFinite(nearestIn)) finding.measuredIn = Number(nearestIn.toFixed(1));
        findings.push(finding);
      }
      if (!entry.product.requiresElectrical) continue;
      const nearestPowerIn = nearestAnchorDistance(
        state,
        center,
        anchors,
        (anchor) =>
          anchor.kind === 'electrical_120v' ||
          anchor.kind === 'electrical_240v' ||
          anchor.kind === 'gas',
      );
      if (nearestPowerIn <= SERVICE_REACH_IN) continue;
      const powerFinding: CheckFinding = {
        code: 'MISSING_SERVICE_ANCHOR',
        severity: 'warning',
        message: `${entry.product.name} needs a power or gas supply and there is none within ${SERVICE_REACH_IN} in of it.`,
        itemIds: [entry.item.id],
        recommendedIn: SERVICE_REACH_IN,
        guideline: GUIDELINE_SOURCE,
      };
      if (Number.isFinite(nearestPowerIn)) {
        powerFinding.measuredIn = Number(nearestPowerIn.toFixed(1));
      }
      findings.push(powerFinding);
    }
  }

  const wantsAccess = placed.some((entry) => entry.product.accessible);
  if (wantsAccess) {
    const turningIn =
      roomType === 'kitchen' ? KITCHEN_GUIDELINES.turningCircleIn : BATH_GUIDELINES.turningCircleIn;
    const occupied = floorItems.map((entry) => entry.box);
    if (!hasClearSquare(state, occupied, turningIn)) {
      findings.push({
        code: 'NO_TURNING_SPACE',
        severity: 'info',
        message: `This layout includes an accessible fixture, but no clear ${turningIn} in turning space was found for a wheelchair or mobility aid.`,
        itemIds: [],
        recommendedIn: turningIn,
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  return findings;
}

/** Kitchen-only rules. */
function evaluateKitchen(state: RoomState, placed: readonly PlacedProduct[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  if (placed.length === 0) return findings;
  const floorItems = placed.filter((entry) => entry.product.occupiesFloor);

  const centers = new Map<WorkCenter, PlacedProduct>();
  for (const entry of placed) {
    const center = entry.product.workCenter;
    if (center === undefined || centers.has(center)) continue;
    centers.set(center, entry);
  }

  for (const required of ['sink', 'cooktop', 'refrigerator'] as const) {
    if (centers.has(required)) continue;
    findings.push({
      code: 'MISSING_WORK_CENTER',
      severity: 'info',
      message: `This kitchen has no ${required === 'cooktop' ? 'cooking surface' : required} yet, so the work triangle cannot be checked.`,
      itemIds: [],
      guideline: GUIDELINE_SOURCE,
    });
  }

  const sink = centers.get('sink');
  const cooktop = centers.get('cooktop');
  const fridge = centers.get('refrigerator');
  if (sink !== undefined && cooktop !== undefined && fridge !== undefined) {
    const legs: Array<{ label: string; from: PlacedProduct; to: PlacedProduct; length: number }> = [
      { label: 'sink to cooking surface', from: sink, to: cooktop, length: 0 },
      { label: 'cooking surface to refrigerator', from: cooktop, to: fridge, length: 0 },
      { label: 'refrigerator to sink', from: fridge, to: sink, length: 0 },
    ].map((leg) => ({
      ...leg,
      length: distanceBetween(centerOf(leg.from.box), centerOf(leg.to.box)),
    }));

    for (const leg of legs) {
      const tooShort = leg.length < KITCHEN_GUIDELINES.workTriangleLegMinIn;
      const tooLong = leg.length > KITCHEN_GUIDELINES.workTriangleLegMaxIn;
      if (!tooShort && !tooLong) continue;
      findings.push({
        code: 'WORK_TRIANGLE_LEG_INVALID',
        severity: 'warning',
        message: `The ${leg.label} leg measures ${leg.length.toFixed(1)} in. Each leg should be between ${KITCHEN_GUIDELINES.workTriangleLegMinIn} in and ${KITCHEN_GUIDELINES.workTriangleLegMaxIn} in.`,
        itemIds: [leg.from.item.id, leg.to.item.id],
        measuredIn: Number(leg.length.toFixed(1)),
        recommendedIn: tooShort
          ? KITCHEN_GUIDELINES.workTriangleLegMinIn
          : KITCHEN_GUIDELINES.workTriangleLegMaxIn,
        guideline: GUIDELINE_SOURCE,
      });
    }

    const total = legs.reduce((sum, leg) => sum + leg.length, 0);
    const itemIds = [sink.item.id, cooktop.item.id, fridge.item.id];
    if (total > KITCHEN_GUIDELINES.workTriangleMaxTotalIn) {
      findings.push({
        code: 'WORK_TRIANGLE_TOO_LARGE',
        severity: 'warning',
        message: `The work triangle totals ${total.toFixed(1)} in. It should not exceed ${KITCHEN_GUIDELINES.workTriangleMaxTotalIn} in, or cooking means walking.`,
        itemIds,
        measuredIn: Number(total.toFixed(1)),
        recommendedIn: KITCHEN_GUIDELINES.workTriangleMaxTotalIn,
        guideline: GUIDELINE_SOURCE,
      });
    } else if (total < KITCHEN_GUIDELINES.workTriangleMinTotalIn) {
      findings.push({
        code: 'WORK_TRIANGLE_TOO_SMALL',
        severity: 'info',
        message: `The work triangle totals ${total.toFixed(1)} in, under the ${KITCHEN_GUIDELINES.workTriangleMinTotalIn} in that keeps three work centers from crowding each other.`,
        itemIds,
        measuredIn: Number(total.toFixed(1)),
        recommendedIn: KITCHEN_GUIDELINES.workTriangleMinTotalIn,
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  if (sink !== undefined) {
    for (const entry of placed) {
      if (entry.product.category !== 'dishwasher') continue;
      const gap = rectDistance(entry.box, sink.box);
      if (gap <= KITCHEN_GUIDELINES.dishwasherToSinkMaxIn) continue;
      findings.push({
        code: 'DISHWASHER_TOO_FAR_FROM_SINK',
        severity: 'warning',
        message: `${entry.product.name} sits ${gap.toFixed(1)} in from the sink. It should be within ${KITCHEN_GUIDELINES.dishwasherToSinkMaxIn} in.`,
        itemIds: [entry.item.id, sink.item.id],
        measuredIn: Number(gap.toFixed(1)),
        recommendedIn: KITCHEN_GUIDELINES.dishwasherToSinkMaxIn,
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  for (const entry of placed) {
    const front = frontVector(entry.item.rotation);
    const sides: Array<{ name: 'left' | 'right'; direction: Vector; requiredIn: number }> = [
      { name: 'left', direction: leftOf(front), requiredIn: entry.product.landingLeftIn },
      { name: 'right', direction: rightOf(front), requiredIn: entry.product.landingRightIn },
    ];
    for (const side of sides) {
      if (side.requiredIn <= 0) continue;
      if (landingSatisfied(state, entry, side.direction, side.requiredIn, floorItems)) continue;
      findings.push({
        code: 'MISSING_LANDING_AREA',
        severity: 'warning',
        message: `${entry.product.name} needs ${side.requiredIn} in of counter landing on its ${side.name}, and there is no room for it.`,
        itemIds: [entry.item.id],
        recommendedIn: side.requiredIn,
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  const workItems = floorItems.filter((entry) =>
    WORK_ITEM_CATEGORIES.includes(entry.product.category),
  );
  for (let i = 0; i < workItems.length; i += 1) {
    const first = workItems[i];
    if (first === undefined) continue;
    for (let j = i + 1; j < workItems.length; j += 1) {
      const second = workItems[j];
      if (second === undefined) continue;
      if (!facesToward(first, second) || !facesToward(second, first)) continue;
      const gap = rectDistance(first.box, second.box);
      if (gap <= TOUCH_TOLERANCE_IN || gap >= KITCHEN_GUIDELINES.workAisleOneCookIn) continue;
      const belowWalkway = gap < KITCHEN_GUIDELINES.walkwayIn;
      findings.push({
        code: belowWalkway ? 'WALKWAY_TOO_NARROW' : 'WORK_AISLE_TOO_NARROW',
        severity: 'warning',
        message: `${first.product.name} and ${second.product.name} leave a ${gap.toFixed(1)} in aisle. A work aisle should be at least ${KITCHEN_GUIDELINES.workAisleOneCookIn} in for one cook and ${KITCHEN_GUIDELINES.workAisleTwoCookIn} in for two.`,
        itemIds: [first.item.id, second.item.id],
        measuredIn: Number(gap.toFixed(1)),
        recommendedIn: KITCHEN_GUIDELINES.workAisleOneCookIn,
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  const counters = floorItems.filter((entry) => entry.product.counterRun);
  for (let i = 0; i < counters.length; i += 1) {
    const first = counters[i];
    if (first === undefined) continue;
    for (let j = i + 1; j < counters.length; j += 1) {
      const second = counters[j];
      if (second === undefined) continue;
      if (runsAlongX(first) === runsAlongX(second)) continue;
      if (!touches(first.box, second.box, TOUCH_TOLERANCE_IN)) continue;
      findings.push({
        code: 'CORNER_DEAD_ZONE',
        severity: 'info',
        message: `${first.product.name} meets ${second.product.name} at a corner. Corners reach badly, so plan a corner unit or leave the return clear.`,
        itemIds: [first.item.id, second.item.id],
        guideline: GUIDELINE_SOURCE,
      });
    }
  }

  return findings;
}

export interface GuidelineContext {
  state: RoomState;
  roomType: RoomType;
  placed: readonly PlacedProduct[];
}

/**
 * Runs the shared rules plus the rule pack for this room type.
 *
 * Rules whose inputs were never modelled produce nothing. A room with no
 * openings yields no door findings, because inventing a door would mean
 * inventing proof.
 */
export function evaluateGuidelines(context: GuidelineContext): CheckFinding[] {
  const findings = evaluateShared(context.state, context.roomType, context.placed);
  if (context.roomType === 'kitchen') {
    findings.push(...evaluateKitchen(context.state, context.placed));
  }
  return findings;
}

/**
 * Rolls committed items up into a priced bill of materials.
 *
 * Derived only from committed state and the catalog, so it can never disagree
 * with the room the human approved. Items whose product is absent from the
 * catalog are listed as unpriced rather than silently dropped or guessed at.
 */
export function buildBillOfMaterials(
  state: RoomState,
  catalog: readonly Product[],
): BillOfMaterials {
  const products = new Map(catalog.map((product) => [product.id, product]));
  const order: string[] = [];
  const counts = new Map<string, number>();
  const unpricedItemIds: string[] = [];

  for (const item of state.items) {
    const product = products.get(item.productId);
    if (product === undefined) {
      unpricedItemIds.push(item.id);
      continue;
    }
    const seen = counts.get(item.productId);
    if (seen === undefined) {
      order.push(item.productId);
      counts.set(item.productId, 1);
      continue;
    }
    counts.set(item.productId, seen + 1);
  }

  const lines: BomLine[] = [];
  let subtotalCents = 0;
  let itemCount = 0;
  for (const productId of order) {
    const product = products.get(productId);
    const quantity = counts.get(productId);
    if (product === undefined || quantity === undefined) continue;
    const resolved = resolveProduct(product);
    const totalCents = product.priceCents * quantity;
    lines.push({
      productId,
      name: product.name,
      category: product.category,
      sku: resolved.sku,
      quantity,
      unitPriceCents: product.priceCents,
      totalCents,
    });
    subtotalCents += totalCents;
    itemCount += quantity;
  }

  return { lines, subtotalCents, itemCount, unpricedItemIds };
}
