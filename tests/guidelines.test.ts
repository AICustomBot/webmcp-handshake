import { describe, expect, it } from 'vitest';
import type { Operation, Product, RoomState } from '@handshake/contracts';
import {
  applyOperations,
  buildBillOfMaterials,
  evaluateDesign,
  resolveProduct,
  validateOperations,
} from '@handshake/policy';

/**
 * Synthetic catalog. Clearances are zero so that these tests exercise the
 * planning rules rather than the 1.0.0 approach-strip rule, which
 * tests/policy.test.ts already covers.
 */
const catalog: Product[] = [
  {
    id: 'b-vanity',
    name: 'Harbor vanity',
    category: 'vanity',
    finish: 'matte black',
    priceCents: 200000,
    widthIn: 36,
    depthIn: 21,
    clearanceIn: 0,
    accessible: false,
  },
  {
    id: 'k-fridge',
    name: 'Studio refrigerator',
    category: 'refrigerator',
    finish: 'stainless',
    priceCents: 300000,
    widthIn: 36,
    depthIn: 30,
    clearanceIn: 0,
    accessible: false,
  },
  {
    id: 'k-sink',
    name: 'Basin sink',
    category: 'sink',
    finish: 'stainless',
    priceCents: 80000,
    widthIn: 33,
    depthIn: 22,
    clearanceIn: 0,
    accessible: false,
  },
  {
    id: 'k-range',
    name: 'Studio range',
    category: 'range',
    finish: 'stainless',
    priceCents: 250000,
    widthIn: 30,
    depthIn: 25,
    clearanceIn: 0,
    accessible: false,
  },
  {
    id: 'k-base',
    name: 'Base cabinet',
    category: 'base_cabinet',
    finish: 'white oak',
    priceCents: 60000,
    widthIn: 36,
    depthIn: 24,
    clearanceIn: 0,
    accessible: false,
  },
  {
    id: 'k-wall',
    name: 'Wall cabinet',
    category: 'wall_cabinet',
    finish: 'white oak',
    priceCents: 40000,
    widthIn: 36,
    depthIn: 12,
    clearanceIn: 0,
    accessible: false,
  },
  {
    id: 'k-dishwasher',
    name: 'Quiet dishwasher',
    category: 'dishwasher',
    finish: 'stainless',
    priceCents: 90000,
    widthIn: 24,
    depthIn: 24,
    clearanceIn: 0,
    accessible: false,
  },
];

const kitchen: RoomState = {
  sessionId: 'k1',
  version: 1,
  widthIn: 144,
  lengthIn: 130,
  budgetCents: 5000000,
  roomType: 'kitchen',
  items: [],
};

const bathroom: RoomState = {
  sessionId: 'b1',
  version: 1,
  widthIn: 108,
  lengthIn: 132,
  budgetCents: 1400000,
  roomType: 'bathroom',
  items: [],
};

function codesFor(state: RoomState): string[] {
  return evaluateDesign(state, catalog).findings.map((finding) => finding.code);
}

describe('product defaults', () => {
  it('resolves category defaults for an unspecified product', () => {
    const resolved = resolveProduct(catalog[1] as Product);
    expect(resolved.mount).toBe('floor');
    expect(resolved.occupiesFloor).toBe(true);
    expect(resolved.workCenter).toBe('refrigerator');
    expect(resolved.requiresElectrical).toBe(true);
    expect(resolved.requiresPlumbing).toBe(false);
    expect(resolved.landingRightIn).toBe(15);
    expect(resolved.sku).toBe('HSK-K-FRIDGE');
  });

  it('lets an explicit catalog value win over the default', () => {
    const resolved = resolveProduct({ ...(catalog[1] as Product), mount: 'wall' });
    expect(resolved.mount).toBe('wall');
    expect(resolved.occupiesFloor).toBe(false);
  });

  it('treats a pre-2.0.0 room with no room type as a bathroom', () => {
    const legacy: RoomState = {
      sessionId: 'legacy',
      version: 2,
      widthIn: 108,
      lengthIn: 132,
      budgetCents: 1400000,
      items: [],
    };
    expect(evaluateDesign(legacy, catalog).roomType).toBe('bathroom');
  });
});

describe('kitchen planning rules', () => {
  it('reports a well-formed galley kitchen as clean', () => {
    const room: RoomState = {
      ...kitchen,
      items: [
        { id: 'f', productId: 'k-fridge', x: 0, y: 0, rotation: 0 },
        { id: 's', productId: 'k-sink', x: 60, y: 0, rotation: 0 },
        { id: 'r', productId: 'k-range', x: 54, y: 96, rotation: 180 },
      ],
    };
    expect(evaluateDesign(room, catalog).findings).toEqual([]);
  });

  it('flags a cramped work triangle', () => {
    const room: RoomState = {
      ...kitchen,
      items: [
        { id: 'f', productId: 'k-fridge', x: 0, y: 0, rotation: 0 },
        { id: 's', productId: 'k-sink', x: 36, y: 0, rotation: 0 },
        { id: 'r', productId: 'k-range', x: 72, y: 0, rotation: 0 },
      ],
    };
    const codes = codesFor(room);
    expect(codes).toContain('WORK_TRIANGLE_LEG_INVALID');
    expect(codes).toContain('WORK_TRIANGLE_TOO_SMALL');
  });

  it('reports a kitchen with no cooking surface as incomplete', () => {
    const room: RoomState = {
      ...kitchen,
      items: [{ id: 'b1', productId: 'k-base', x: 0, y: 0, rotation: 0 }],
    };
    const evaluation = evaluateDesign(room, catalog);
    expect(evaluation.findings.map((finding) => finding.code)).toContain('MISSING_WORK_CENTER');
    expect(evaluation.blockedCount).toBe(0);
  });

  it('flags a dishwasher placed away from the sink', () => {
    const room: RoomState = {
      ...kitchen,
      items: [
        { id: 's', productId: 'k-sink', x: 100, y: 0, rotation: 0 },
        { id: 'd', productId: 'k-dishwasher', x: 0, y: 0, rotation: 0 },
      ],
    };
    expect(codesFor(room)).toContain('DISHWASHER_TOO_FAR_FROM_SINK');
  });

  it('cites a measurement and a recommendation on a guideline finding', () => {
    const room: RoomState = {
      ...kitchen,
      items: [
        { id: 's', productId: 'k-sink', x: 100, y: 0, rotation: 0 },
        { id: 'd', productId: 'k-dishwasher', x: 0, y: 0, rotation: 0 },
      ],
    };
    const finding = evaluateDesign(room, catalog).findings.find(
      (candidate) => candidate.code === 'DISHWASHER_TOO_FAR_FROM_SINK',
    );
    expect(finding?.measuredIn).toBeGreaterThan(36);
    expect(finding?.recommendedIn).toBe(36);
    expect(finding?.guideline).toContain('NKBA');
  });

  it('does not treat a wall cabinet above a base cabinet as a collision', () => {
    const room: RoomState = {
      ...kitchen,
      items: [
        { id: 'b1', productId: 'k-base', x: 0, y: 0, rotation: 0 },
        { id: 'w1', productId: 'k-wall', x: 0, y: 0, rotation: 0 },
      ],
    };
    expect(codesFor(room)).not.toContain('FIXTURE_OVERLAP');
  });
});

describe('openings', () => {
  it('blocks a fixture standing in a door path', () => {
    const room: RoomState = {
      ...bathroom,
      openings: [{ id: 'd1', kind: 'door', wall: 'north', offsetIn: 10, widthIn: 32, swingIn: 32 }],
      items: [{ id: 'i1', productId: 'b-vanity', x: 12, y: 0, rotation: 0 }],
    };
    const evaluation = evaluateDesign(room, catalog);
    expect(evaluation.findings.map((finding) => finding.code)).toContain('DOOR_BLOCKED');
    expect(evaluation.blockedCount).toBeGreaterThan(0);
  });

  it('warns about an undersized door without blocking it', () => {
    const room: RoomState = {
      ...bathroom,
      openings: [{ id: 'd1', kind: 'door', wall: 'north', offsetIn: 10, widthIn: 28, swingIn: 0 }],
    };
    const finding = evaluateDesign(room, catalog).findings.find(
      (candidate) => candidate.code === 'OPENING_INVALID',
    );
    expect(finding?.severity).toBe('warning');
    expect(finding?.openingIds).toEqual(['d1']);
  });

  it('blocks an opening that does not fit on its wall', () => {
    const room: RoomState = {
      ...bathroom,
      openings: [
        { id: 'd1', kind: 'door', wall: 'north', offsetIn: 100, widthIn: 36, swingIn: 30 },
      ],
    };
    const finding = evaluateDesign(room, catalog).findings.find(
      (candidate) => candidate.code === 'OPENING_INVALID',
    );
    expect(finding?.severity).toBe('blocked');
  });

  it('stays silent about doors in a room where none were modelled', () => {
    const room: RoomState = {
      ...bathroom,
      items: [{ id: 'i1', productId: 'b-vanity', x: 12, y: 0, rotation: 0 }],
    };
    expect(codesFor(room)).not.toContain('DOOR_BLOCKED');
  });
});

describe('category and room type', () => {
  it('flags a kitchen appliance placed in a bathroom', () => {
    const room: RoomState = {
      ...bathroom,
      items: [{ id: 'i1', productId: 'k-range', x: 0, y: 0, rotation: 0 }],
    };
    expect(codesFor(room)).toContain('CATEGORY_ROOM_MISMATCH');
  });
});

describe('bill of materials', () => {
  it('rolls repeated products up into one priced line', () => {
    const room: RoomState = {
      ...kitchen,
      items: [
        { id: 'b1', productId: 'k-base', x: 0, y: 0, rotation: 0 },
        { id: 'b2', productId: 'k-base', x: 36, y: 0, rotation: 0 },
      ],
    };
    const bom = buildBillOfMaterials(room, catalog);
    expect(bom.lines).toHaveLength(1);
    expect(bom.lines[0]?.quantity).toBe(2);
    expect(bom.lines[0]?.totalCents).toBe(120000);
    expect(bom.subtotalCents).toBe(120000);
    expect(bom.itemCount).toBe(2);
  });

  it('lists an uncatalogued item as unpriced rather than dropping it', () => {
    const room: RoomState = {
      ...kitchen,
      items: [{ id: 'x1', productId: 'not-real', x: 0, y: 0, rotation: 0 }],
    };
    const bom = buildBillOfMaterials(room, catalog);
    expect(bom.unpricedItemIds).toEqual(['x1']);
    expect(bom.subtotalCents).toBe(0);
  });

  it('reports the remaining budget alongside the evaluation', () => {
    const room: RoomState = {
      ...kitchen,
      items: [{ id: 'b1', productId: 'k-base', x: 0, y: 0, rotation: 0 }],
    };
    const evaluation = evaluateDesign(room, catalog);
    expect(evaluation.committedCents).toBe(60000);
    expect(evaluation.remainingCents).toBe(4940000);
    expect(evaluation.bom?.itemCount).toBe(1);
  });
});

describe('room and opening operations', () => {
  it('accepts a room configuration change', () => {
    expect(validateOperations([{ type: 'configure_room', roomType: 'kitchen' }])).toEqual({
      allowed: true,
    });
  });

  it('refuses a room configuration that changes nothing', () => {
    expect(validateOperations([{ type: 'configure_room' }])).toEqual({
      allowed: false,
      code: 'INVALID_INPUT',
    });
  });

  it('refuses a room dimension outside the hard bounds', () => {
    expect(validateOperations([{ type: 'configure_room', widthIn: 12 }])).toEqual({
      allowed: false,
      code: 'INVALID_INPUT',
    });
  });

  it('refuses an opening with no width', () => {
    const operations: Operation[] = [
      { type: 'add_opening', kind: 'door', wall: 'north', offsetIn: 10, widthIn: 0, swingIn: 30 },
    ];
    expect(validateOperations(operations)).toEqual({ allowed: false, code: 'INVALID_INPUT' });
  });

  it('applies a room configuration and an opening in one transition', () => {
    const operations: Operation[] = [
      { type: 'configure_room', roomType: 'kitchen', widthIn: 150 },
      { type: 'add_opening', kind: 'door', wall: 'north', offsetIn: 10, widthIn: 36, swingIn: 30 },
    ];
    const result = applyOperations(
      bathroom,
      operations,
      (index) => `i${index}`,
      (index) => `o${index}`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.version).toBe(2);
    expect(result.state.roomType).toBe('kitchen');
    expect(result.state.widthIn).toBe(150);
    expect(result.state.openings).toHaveLength(1);
    expect(result.state.openings?.[0]?.id).toBe('o0');
  });

  it('refuses to remove an opening that does not exist', () => {
    const result = applyOperations(
      bathroom,
      [{ type: 'remove_opening', openingId: 'missing' }],
      (index) => `i${index}`,
    );
    expect(result).toEqual({ ok: false, code: 'INVALID_INPUT' });
  });

  it('leaves committed state untouched when applying operations', () => {
    const before = JSON.stringify(bathroom);
    applyOperations(bathroom, [{ type: 'configure_room', budgetCents: 999 }], (i) => `i${i}`);
    expect(JSON.stringify(bathroom)).toBe(before);
  });
});
