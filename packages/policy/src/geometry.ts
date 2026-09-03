/**
 * Pure axis-aligned geometry for the deterministic policy engine.
 *
 * Every function here is a total function of its arguments with no clock, no
 * randomness and no I/O. The room is an axis-aligned rectangle from (0, 0) to
 * (widthIn, lengthIn), x increasing east and y increasing south, matching the
 * SVG canvas the page draws.
 *
 * Rotation convention, unchanged from 1.0.0: an item at rotation 0 faces south
 * (down the screen). 90 faces west, 180 faces north, 270 faces east.
 */

import type {
  Product,
  RoomItem,
  RoomOpening,
  RoomState,
  Rotation,
  WallSide,
} from '@handshake/contracts';

export interface Footprint {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Vector {
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Returns the unit vector an item at this rotation faces. */
export function frontVector(rotation: Rotation): Vector {
  switch (rotation) {
    case 0:
      return { x: 0, y: 1 };
    case 90:
      return { x: -1, y: 0 };
    case 180:
      return { x: 0, y: -1 };
    case 270:
      return { x: 1, y: 0 };
  }
}

/**
 * Returns the unit vector to the right of someone standing in front of the
 * item and facing it, which is the front vector turned a quarter turn.
 */
export function rightVector(front: Vector): Vector {
  return { x: front.y, y: -front.x };
}

/** Returns whether a rotation turns an item onto its side. */
export function isQuarterTurned(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}

/** Returns the rotated floor footprint of an item. */
export function footprintOf(item: RoomItem, product: Product): Footprint {
  const turned = isQuarterTurned(item.rotation);
  const width = turned ? product.depthIn : product.widthIn;
  const depth = turned ? product.widthIn : product.depthIn;
  return { left: item.x, top: item.y, right: item.x + width, bottom: item.y + depth };
}

/** Returns whether two open-edged floor rectangles overlap. */
export function overlaps(a: Footprint, b: Footprint): boolean {
  if (a.right <= b.left || b.right <= a.left) return false;
  return !(a.bottom <= b.top || b.bottom <= a.top);
}

/** Returns whether a rectangle lies entirely inside the room. */
export function fitsInsideRoom(state: RoomState, box: Footprint): boolean {
  if (box.left < 0 || box.top < 0) return false;
  return box.right <= state.widthIn && box.bottom <= state.lengthIn;
}

/** Returns the center point of a rectangle. */
export function centerOf(box: Footprint): Point {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

/** Returns the straight-line distance between two points. */
export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Returns the width of a rectangle. */
export function widthOf(box: Footprint): number {
  return box.right - box.left;
}

/** Returns the depth of a rectangle. */
export function depthOf(box: Footprint): number {
  return box.bottom - box.top;
}

/**
 * Returns the strip of floor immediately beside a rectangle in one of the four
 * axis directions, spanning the full extent of the shared edge.
 *
 * A zero or negative depth collapses the strip onto the edge, which never
 * overlaps anything, so callers may pass an unmet requirement without guarding.
 */
export function stripBeside(box: Footprint, direction: Vector, depth: number): Footprint {
  if (direction.x === 0 && direction.y === 1) {
    return { left: box.left, top: box.bottom, right: box.right, bottom: box.bottom + depth };
  }
  if (direction.x === 0 && direction.y === -1) {
    return { left: box.left, top: box.top - depth, right: box.right, bottom: box.top };
  }
  if (direction.x === -1 && direction.y === 0) {
    return { left: box.left - depth, top: box.top, right: box.left, bottom: box.bottom };
  }
  return { left: box.right, top: box.top, right: box.right + depth, bottom: box.bottom };
}

/**
 * Returns the approach strip in front of a rotated item. Preserves the 1.0.0
 * clearance geometry exactly: front directions are 0 down, 90 left, 180 up and
 * 270 right.
 */
export function stripInFront(box: Footprint, rotation: Rotation, depth: number): Footprint {
  return stripBeside(box, frontVector(rotation), depth);
}

/**
 * Returns the gap between two non-overlapping rectangles along whichever axis
 * separates them, but only when they face each other across that gap. Returns
 * null when they overlap, or when they are diagonal from one another and so
 * form no aisle.
 */
export function facingGap(a: Footprint, b: Footprint): { axis: 'x' | 'y'; gap: number } | null {
  const overlapsOnY = a.bottom > b.top && b.bottom > a.top;
  const overlapsOnX = a.right > b.left && b.right > a.left;
  if (overlapsOnY && !overlapsOnX) {
    const gap = a.left >= b.right ? a.left - b.right : b.left - a.right;
    return { axis: 'x', gap };
  }
  if (overlapsOnX && !overlapsOnY) {
    const gap = a.top >= b.bottom ? a.top - b.bottom : b.top - a.bottom;
    return { axis: 'y', gap };
  }
  return null;
}

/** Returns whether two rectangles share a boundary without overlapping. */
export function touches(a: Footprint, b: Footprint, tolerance = 0.5): boolean {
  if (overlaps(a, b)) return false;
  const gap = facingGap(a, b);
  return gap !== null && gap.gap <= tolerance;
}

/**
 * Returns the swept floor area of an opening: the door leaf arc approximated
 * as the rectangle it sweeps into the room. Windows and passages have a zero
 * swing and so sweep nothing.
 */
export function openingSwing(state: RoomState, opening: RoomOpening): Footprint {
  const start = opening.offsetIn;
  const end = opening.offsetIn + opening.widthIn;
  const swing = Math.max(0, opening.swingIn);
  switch (opening.wall) {
    case 'north':
      return { left: start, top: 0, right: end, bottom: swing };
    case 'south':
      return { left: start, top: state.lengthIn - swing, right: end, bottom: state.lengthIn };
    case 'west':
      return { left: 0, top: start, right: swing, bottom: end };
    case 'east':
      return { left: state.widthIn - swing, top: start, right: state.widthIn, bottom: end };
  }
}

/** Returns the length of the wall an opening or anchor sits on. */
export function wallLength(state: RoomState, wall: WallSide): number {
  return wall === 'north' || wall === 'south' ? state.widthIn : state.lengthIn;
}

/** Returns the point on a wall at a given offset from that wall's origin corner. */
export function pointOnWall(state: RoomState, wall: WallSide, offsetIn: number): Point {
  switch (wall) {
    case 'north':
      return { x: offsetIn, y: 0 };
    case 'south':
      return { x: offsetIn, y: state.lengthIn };
    case 'west':
      return { x: 0, y: offsetIn };
    case 'east':
      return { x: state.widthIn, y: offsetIn };
  }
}

/**
 * Returns whether a square of the given side length fits somewhere in the room
 * without touching any of the supplied rectangles.
 *
 * Scans on a coarse grid. A coarse scan can miss a tight fit, so a false
 * result means "no clear space was found", which is reported as advisory
 * information and never as a block.
 */
export function hasClearSquare(
  state: RoomState,
  occupied: readonly Footprint[],
  sideIn: number,
  stepIn = 6,
): boolean {
  if (sideIn > state.widthIn || sideIn > state.lengthIn) return false;
  const step = Math.max(1, stepIn);
  for (let top = 0; top + sideIn <= state.lengthIn; top += step) {
    for (let left = 0; left + sideIn <= state.widthIn; left += step) {
      const candidate: Footprint = { left, top, right: left + sideIn, bottom: top + sideIn };
      let clear = true;
      for (const box of occupied) {
        if (overlaps(candidate, box)) {
          clear = false;
          break;
        }
      }
      if (clear) return true;
    }
  }
  return false;
}
