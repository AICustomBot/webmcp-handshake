import { describe, expect, it } from 'vitest';
import { CATALOG } from '../packages/contracts/src/index';
import type { CatalogProduct, RoomItem, RoomState } from '../packages/contracts/src/index';
import {
  budgetStatus,
  checkClearances,
  footprintOf,
  insideBounds,
  rectsOverlap,
} from '../packages/policy/src/index';

function product(id: string): CatalogProduct {
  const found = CATALOG.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing catalog product ${id}`);
  return found;
}

function room(items: RoomItem[], overrides: Partial<RoomState> = {}): RoomState {
  return {
    sessionId: 's',
    version: 1,
    widthIn: 108,
    lengthIn: 132,
    budgetCents: 1400000,
    items,
    ...overrides,
  };
}

function item(
  id: string,
  productId: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
): RoomItem {
  return { id, productId, x, y, rotation };
}

describe('footprintOf', () => {
  it('swaps width and length for 90/270 rotation and keeps them for 0/180', () => {
    const vanity = product('vanity-60-double');
    expect(footprintOf({ x: 10, y: 12, rotation: 0 }, vanity)).toEqual({
      x: 10,
      y: 12,
      w: 60,
      l: 22,
    });
    expect(footprintOf({ x: 10, y: 12, rotation: 90 }, vanity)).toEqual({
      x: 10,
      y: 12,
      w: 22,
      l: 60,
    });
    expect(footprintOf({ x: 10, y: 12, rotation: 180 }, vanity)).toEqual({
      x: 10,
      y: 12,
      w: 60,
      l: 22,
    });
    expect(footprintOf({ x: 10, y: 12, rotation: 270 }, vanity)).toEqual({
      x: 10,
      y: 12,
      w: 22,
      l: 60,
    });
  });
  it('gives wall-mount products a zero footprint regardless of rotation', () => {
    const mirror = product('mirror-cabinet-36');
    expect(footprintOf({ x: 4, y: 4, rotation: 90 }, mirror)).toEqual({ x: 4, y: 4, w: 0, l: 0 });
  });
});

describe('rectsOverlap', () => {
  const a = { x: 0, y: 0, w: 10, l: 10 };
  it('detects strict interior overlap', () => {
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, l: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: 1, y: 1, w: 1, l: 1 })).toBe(true);
  });
  it('treats touching edges as no overlap', () => {
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, l: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 0, y: 10, w: 10, l: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 10, y: 10, w: 10, l: 10 })).toBe(false);
  });
  it('treats disjoint rects and zero-footprint rects as no overlap', () => {
    expect(rectsOverlap(a, { x: 20, y: 20, w: 10, l: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 5, y: 5, w: 0, l: 0 })).toBe(false);
  });
});

describe('insideBounds', () => {
  const bounds = { widthIn: 100, lengthIn: 100 };
  it('accepts rects fully inside and flush with the walls', () => {
    expect(insideBounds({ x: 1, y: 1, w: 50, l: 50 }, bounds)).toBe(true);
    expect(insideBounds({ x: 0, y: 0, w: 100, l: 100 }, bounds)).toBe(true);
  });
  it('rejects rects protruding or starting outside', () => {
    expect(insideBounds({ x: -1, y: 0, w: 50, l: 50 }, bounds)).toBe(false);
    expect(insideBounds({ x: 0, y: 0, w: 101, l: 50 }, bounds)).toBe(false);
    expect(insideBounds({ x: 0, y: 60, w: 50, l: 50 }, bounds)).toBe(false);
  });
});

describe('checkClearances door_zone', () => {
  it('warns when an item partially covers the default door zone', () => {
    // storage tower 24x18 at (20,10): x 20..44 overlaps door x 0..36 and sticks past it.
    const findings = checkClearances(
      room([item('item-1', 'storage-tower-24', 20, 10, 0)]),
      CATALOG,
    );
    const doorZone = findings.filter((finding) => finding.code === 'door_zone');
    expect(doorZone).toHaveLength(1);
    expect(doorZone[0]).toMatchObject({ status: 'warning', itemIds: ['item-1'] });
  });
  it('passes door_zone when the doorway is clear', () => {
    // vanity at (40, 40) stays far from the 0,0 door zone.
    const findings = checkClearances(
      room([item('item-1', 'vanity-60-double', 40, 40, 0)]),
      CATALOG,
    );
    expect(findings.filter((finding) => finding.code === 'door_zone')[0]).toEqual({
      code: 'door_zone',
      status: 'pass',
      itemIds: [],
      detail: 'demo heuristic: no door_zone issues',
    });
  });
});

describe('checkClearances front_clearance', () => {
  it('warns when another item partially occupies a vanity clearance rect', () => {
    // vanity at (0,0) rot 0 -> clearance rect x 0..60, y 22..43; tower at (30,30) intrudes
    // from y 30..48 (sticks past 43 -> partial, not fully inside).
    const findings = checkClearances(
      room([
        item('item-1', 'vanity-60-double', 0, 0, 0),
        item('item-2', 'storage-tower-24', 30, 30, 0),
      ]),
      CATALOG,
    );
    const front = findings.filter((finding) => finding.code === 'front_clearance');
    expect(front).toHaveLength(1);
    expect(front[0]).toMatchObject({ status: 'warning', itemIds: ['item-1', 'item-2'] });
  });
  it('blocks when another item fully occupies a front clearance rect', () => {
    // toilet at (0,0) rot 0 -> clearance rect x 0..15, y 28..49; faucet at (2,32) sits inside it.
    const findings = checkClearances(
      room([
        item('item-1', 'toilet-elongated', 0, 0, 0),
        item('item-2', 'faucet-matte-black', 2, 32, 0),
      ]),
      CATALOG,
    );
    const front = findings.filter((finding) => finding.code === 'front_clearance');
    expect(front).toHaveLength(1);
    expect(front[0]).toMatchObject({ status: 'blocked', itemIds: ['item-1', 'item-2'] });
  });
  it('aims the clearance rect sideways for 90-degree rotation', () => {
    // vanity rot 90 at (0,0) -> footprint w 22 l 60, clearance x 22..43, y 0..60;
    // tower at (30,30) partially intrudes (x 30..49 sticks past 43).
    const findings = checkClearances(
      room([
        item('item-1', 'vanity-60-double', 0, 0, 90),
        item('item-2', 'storage-tower-24', 30, 30, 0),
      ]),
      CATALOG,
    );
    const front = findings.filter((finding) => finding.code === 'front_clearance');
    expect(front).toHaveLength(1);
    expect(front[0]).toMatchObject({ status: 'warning', itemIds: ['item-1', 'item-2'] });
  });
});

describe('checkClearances bounds and overlap', () => {
  it('passes every code for a clean room', () => {
    const findings = checkClearances(room([]), CATALOG);
    expect(findings.map((finding) => `${finding.code}:${finding.status}`)).toEqual([
      'bounds:pass',
      'overlap:pass',
      'door_zone:pass',
      'front_clearance:pass',
    ]);
  });
  it('warns on small bounds intrusion and blocks large intrusion', () => {
    // wall-mount towel bar anchored 2in past the 108in width -> warning.
    // storage tower at x 107 protrudes 23in -> blocked.
    const findings = checkClearances(
      room([
        item('item-1', 'towel-bar-matte', 110, 0, 0),
        item('item-2', 'storage-tower-24', 107, 0, 0),
      ]),
      CATALOG,
    );
    const bounds = findings.filter((finding) => finding.code === 'bounds');
    expect(bounds.map((finding) => [finding.itemIds[0], finding.status])).toEqual([
      ['item-1', 'warning'],
      ['item-2', 'blocked'],
    ]);
  });
  it('blocks pairwise footprint overlap', () => {
    // 36x36 shower at (0,0) and 24x18 tower at (10,10) overlap.
    const findings = checkClearances(
      room([
        item('item-1', 'shower-corner-36', 0, 0, 0),
        item('item-2', 'storage-tower-24', 10, 10, 0),
      ]),
      CATALOG,
    );
    const overlap = findings.filter((finding) => finding.code === 'overlap');
    expect(overlap).toHaveLength(1);
    expect(overlap[0]).toMatchObject({ status: 'blocked', itemIds: ['item-1', 'item-2'] });
  });
});

describe('budgetStatus', () => {
  const committedItems = [
    item('item-1', 'toilet-elongated', 0, 0, 0),
    item('item-2', 'shower-corner-36', 50, 0, 0),
    item('item-3', 'towel-bar-matte', 0, 90, 0),
  ]; // toilet + shower + towel bar = 137700 committed
  it('classifies committed at 84.9% of the limit as ok', () => {
    // 137700 / 162100 = 84.9%
    const status = budgetStatus(room(committedItems, { budgetCents: 162100 }), CATALOG);
    expect(status).toMatchObject({
      committedCents: 137700,
      limitCents: 162100,
      remainingCents: 24400,
      status: 'ok',
      nearThreshold: 0.85,
    });
  });
  it('classifies committed at exactly 85% as near', () => {
    // 137700 / 162000 = 85.0%
    const status = budgetStatus(room(committedItems, { budgetCents: 162000 }), CATALOG);
    expect(status).toMatchObject({ committedCents: 137700, status: 'near' });
  });
  it('classifies committed just above the limit as over', () => {
    // 137700 / 137600 = 100.07%
    const status = budgetStatus(room(committedItems, { budgetCents: 137600 }), CATALOG);
    expect(status).toMatchObject({ committedCents: 137700, status: 'over', remainingCents: -100 });
  });
});
