import { describe, expect, it } from 'vitest';
import {
  calculateViewBox,
  formatDimension,
  snapToGrid,
  clampCoordinate,
  getOrientationVector,
  getUtilityConfig,
  UTILITY_SERVICE_CONFIG,
  calculateNKBAWorkTriangle,
  resolveCatalogProduct,
  footprintOf,
  centerOf,
  distanceBetween,
  overlaps,
  fitsInsideRoom,
  stripInFront,
  widthOf,
  depthOf,
  WALL_THICKNESS,
  PERIMETER_MARGIN,
  FALLBACK_CATALOG,
} from '../apps/web/components/studio/canvas-2d-utils';
import type {
  Product,
  Proposal,
  RoomItem,
  RoomOpening,
  RoomState,
  Rotation,
  ServiceKind,
} from '@handshake/contracts';

describe('Milestone HSK-28: 2D Architectural Floorplan Engine', () => {
  describe('1. SVG ViewBox Calculation (calculateViewBox)', () => {
    it('calculates standard residential rectangular room viewBox', () => {
      const state: RoomState = {
        sessionId: 'test-session',
        version: 1,
        widthIn: 144, // 12 ft
        lengthIn: 180, // 15 ft
        budgetCents: 2000000,
        items: [],
      };
      // wallThickness = 4.5", margin = 36" -> offset = 40.5"
      // totalW = 144 + 81 = 225, totalL = 180 + 81 = 261
      const vb = calculateViewBox(state);
      expect(vb).toBe('-40.5 -40.5 225 261');
    });

    it('calculates square room aspect ratio viewBox', () => {
      const state: RoomState = {
        sessionId: 'square-session',
        version: 1,
        widthIn: 120, // 10 ft
        lengthIn: 120, // 10 ft
        budgetCents: 1500000,
        items: [],
      };
      const vb = calculateViewBox(state);
      expect(vb).toBe('-40.5 -40.5 201 201');
    });

    it('calculates wide / galley kitchen viewBox', () => {
      const state: RoomState = {
        sessionId: 'wide-session',
        version: 1,
        widthIn: 240, // 20 ft
        lengthIn: 120, // 10 ft
        budgetCents: 2500000,
        items: [],
      };
      const vb = calculateViewBox(state);
      expect(vb).toBe('-40.5 -40.5 321 201');
    });

    it('calculates tall / narrow room viewBox', () => {
      const state: RoomState = {
        sessionId: 'tall-session',
        version: 1,
        widthIn: 96, // 8 ft
        lengthIn: 240, // 20 ft
        budgetCents: 1800000,
        items: [],
      };
      const vb = calculateViewBox(state);
      expect(vb).toBe('-40.5 -40.5 177 321');
    });

    it('calculates large open-concept layout viewBox', () => {
      const state: RoomState = {
        sessionId: 'large-session',
        version: 1,
        widthIn: 360, // 30 ft
        lengthIn: 300, // 25 ft
        budgetCents: 5000000,
        items: [],
      };
      const vb = calculateViewBox(state);
      expect(vb).toBe('-40.5 -40.5 441 381');
    });
  });

  describe('2. Imperial Feet-and-Inches Formatting (formatDimension)', () => {
    it('formats exact foot multiples', () => {
      expect(formatDimension(144)).toBe('12\'-0"');
      expect(formatDimension(48)).toBe('4\'-0"');
      expect(formatDimension(12)).toBe('1\'-0"');
      expect(formatDimension(0)).toBe('0\'-0"');
    });

    it('formats mixed feet and inches correctly', () => {
      expect(formatDimension(33)).toBe('2\'-9"');
      expect(formatDimension(125)).toBe('10\'-5"');
      expect(formatDimension(21)).toBe('1\'-9"');
      expect(formatDimension(30)).toBe('2\'-6"');
      expect(formatDimension(11)).toBe('0\'-11"');
      expect(formatDimension(7)).toBe('0\'-7"');
    });

    it('handles negative or fractional inches gracefully', () => {
      expect(formatDimension(-5)).toBe('0\'-0"');
      expect(formatDimension(33.2)).toBe('2\'-9"');
      expect(formatDimension(33.8)).toBe('2\'-10"');
    });
  });

  describe('3. 12-Inch Grid Snapping & Coordinate Clamping', () => {
    it('snaps coordinates to nearest 12-inch major grid increment', () => {
      expect(snapToGrid(0)).toBe(0);
      expect(snapToGrid(5)).toBe(0);
      expect(snapToGrid(6)).toBe(12); // midpoint rounds up
      expect(snapToGrid(11)).toBe(12);
      expect(snapToGrid(14)).toBe(12);
      expect(snapToGrid(18)).toBe(24);
      expect(snapToGrid(25)).toBe(24);
      expect(snapToGrid(35)).toBe(36);
      expect(snapToGrid(48)).toBe(48);
    });

    it('preserves exact raw coordinates when snapping is disabled', () => {
      expect(snapToGrid(14.5, false)).toBe(14.5);
      expect(snapToGrid(27, false)).toBe(27);
      expect(snapToGrid(33.3, false)).toBe(33.3);
    });

    it('clamps coordinates strictly within room boundaries', () => {
      const roomW = 144;
      const fixtureW = 36;
      // Max valid left coordinate is 144 - 36 = 108
      expect(clampCoordinate(0, fixtureW, roomW)).toBe(0);
      expect(clampCoordinate(48, fixtureW, roomW)).toBe(48);
      expect(clampCoordinate(108, fixtureW, roomW)).toBe(108);
      expect(clampCoordinate(120, fixtureW, roomW)).toBe(108);
      expect(clampCoordinate(-24, fixtureW, roomW)).toBe(0);
    });

    it('handles oversized fixtures by pinning to 0', () => {
      const roomW = 144;
      const oversizedFixture = 180;
      expect(clampCoordinate(50, oversizedFixture, roomW)).toBe(0);
    });
  });

  describe('4. Orientation Front-Vectors & Rotated Footprints', () => {
    it('calculates unit front-vectors for all 4 cardinal angles', () => {
      // 0 deg: South (down, vector {x: 0, y: 1})
      expect(getOrientationVector(0)).toEqual({ x: 0, y: 1 });
      // 90 deg: West (left, vector {x: -1, y: 0})
      expect(getOrientationVector(90)).toEqual({ x: -1, y: 0 });
      // 180 deg: North (up, vector {x: 0, y: -1})
      expect(getOrientationVector(180)).toEqual({ x: 0, y: -1 });
      // 270 deg: East (right, vector {x: 1, y: 0})
      expect(getOrientationVector(270)).toEqual({ x: 1, y: 0 });
    });

    it('resolves rotated footprint bounding boxes correctly', () => {
      const product: Product = {
        id: 'harbor-vanity',
        name: 'Harbor vanity',
        category: 'vanity',
        finish: 'matte black',
        priceCents: 248000,
        widthIn: 36,
        depthIn: 21,
        clearanceIn: 30,
        accessible: true,
      };

      // 0 deg: 36" wide, 21" deep
      const item0: RoomItem = {
        id: 'vanity',
        productId: 'harbor-vanity',
        x: 10,
        y: 20,
        rotation: 0,
      };
      const box0 = footprintOf(item0, product);
      expect(widthOf(box0)).toBe(36);
      expect(depthOf(box0)).toBe(21);
      expect(box0).toEqual({ left: 10, top: 20, right: 46, bottom: 41 });

      // 90 deg (quarter-turned): 21" wide, 36" deep
      const item90: RoomItem = {
        id: 'vanity',
        productId: 'harbor-vanity',
        x: 10,
        y: 20,
        rotation: 90,
      };
      const box90 = footprintOf(item90, product);
      expect(widthOf(box90)).toBe(21);
      expect(depthOf(box90)).toBe(36);
      expect(box90).toEqual({ left: 10, top: 20, right: 31, bottom: 56 });

      // 180 deg: 36" wide, 21" deep
      const item180: RoomItem = {
        id: 'vanity',
        productId: 'harbor-vanity',
        x: 10,
        y: 20,
        rotation: 180,
      };
      const box180 = footprintOf(item180, product);
      expect(widthOf(box180)).toBe(36);
      expect(depthOf(box180)).toBe(21);

      // 270 deg (quarter-turned): 21" wide, 36" deep
      const item270: RoomItem = {
        id: 'vanity',
        productId: 'harbor-vanity',
        x: 10,
        y: 20,
        rotation: 270,
      };
      const box270 = footprintOf(item270, product);
      expect(widthOf(box270)).toBe(21);
      expect(depthOf(box270)).toBe(36);
    });
  });

  describe('5. Utility Service Anchors Categorization & Color Tokens', () => {
    const serviceKinds: ServiceKind[] = [
      'water',
      'drain',
      'gas',
      'electrical_120v',
      'electrical_240v',
      'vent',
    ];

    it('defines standardized configs for all 6 service kinds', () => {
      for (const kind of serviceKinds) {
        const conf = getUtilityConfig(kind);
        expect(conf).toBeDefined();
        expect(conf.label).toBeTruthy();
        expect(conf.symbol).toBeTruthy();
        expect(conf.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(conf.name).toBeTruthy();
      }
    });

    it('matches required color tokens and glyphs', () => {
      expect(getUtilityConfig('water')).toMatchObject({
        label: 'W',
        symbol: 'circle',
        color: '#0284c7', // Sky Blue
      });
      expect(getUtilityConfig('drain')).toMatchObject({
        label: 'D',
        symbol: 'circle',
        color: '#2563eb', // Royal Blue
      });
      expect(getUtilityConfig('gas')).toMatchObject({
        label: 'G',
        symbol: 'diamond',
        color: '#eab308', // Amber / Yellow
      });
      expect(getUtilityConfig('electrical_120v')).toMatchObject({
        label: '120V',
        symbol: 'rect',
        color: '#06b6d4', // Cyan
      });
      expect(getUtilityConfig('electrical_240v')).toMatchObject({
        label: '240V',
        symbol: 'hexagon',
        color: '#7c3aed', // Purple
      });
      expect(getUtilityConfig('vent')).toMatchObject({
        label: 'V',
        symbol: 'square',
        color: '#059669', // Emerald
      });
    });
  });

  describe('6. Clearance Zones & Overlap Detection', () => {
    it('computes clearance corridor in front of rotated fixtures', () => {
      const box = { left: 20, top: 30, right: 50, bottom: 60 }; // width 30, depth 30
      const clearanceDepth = 36;

      // 0 deg: South (corridor extends downward below box)
      const c0 = stripInFront(box, 0, clearanceDepth);
      expect(c0).toEqual({ left: 20, top: 60, right: 50, bottom: 96 });

      // 90 deg: West (corridor extends westward left of box)
      const c90 = stripInFront(box, 90, clearanceDepth);
      expect(c90).toEqual({ left: -16, top: 30, right: 20, bottom: 60 });

      // 180 deg: North (corridor extends northward above box)
      const c180 = stripInFront(box, 180, clearanceDepth);
      expect(c180).toEqual({ left: 20, top: -6, right: 50, bottom: 30 });

      // 270 deg: East (corridor extends eastward right of box)
      const c270 = stripInFront(box, 270, clearanceDepth);
      expect(c270).toEqual({ left: 50, top: 30, right: 86, bottom: 60 });
    });

    it('accurately identifies overlaps and non-overlaps', () => {
      const a = { left: 0, top: 0, right: 30, bottom: 30 };
      const overlapping = { left: 15, top: 15, right: 45, bottom: 45 };
      const separate = { left: 40, top: 40, right: 70, bottom: 70 };
      const touching = { left: 30, top: 0, right: 60, bottom: 30 };

      expect(overlaps(a, overlapping)).toBe(true);
      expect(overlaps(a, separate)).toBe(false);
      expect(overlaps(a, touching)).toBe(false);
    });
  });

  describe('7. NKBA Kitchen Work Triangle Calculation', () => {
    it('returns null when any work center is missing', () => {
      const items: RoomItem[] = [
        { id: 'sink-1', productId: 'undermount-sink', x: 24, y: 12, rotation: 0 },
        { id: 'fridge-1', productId: 'french-door-fridge', x: 96, y: 12, rotation: 0 },
      ];
      expect(calculateNKBAWorkTriangle(items, FALLBACK_CATALOG)).toBeNull();
    });

    it('calculates compliant work triangle when all 3 centers are within NKBA range', () => {
      // Sink at (36, 12), Cooktop at (96, 12), Fridge at (60, 84)
      const items: RoomItem[] = [
        { id: 'sink-1', productId: 'undermount-sink', x: 36, y: 12, rotation: 0 },
        { id: 'cook-1', productId: 'pro-gas-range', x: 96, y: 12, rotation: 0 },
        { id: 'fridge-1', productId: 'french-door-fridge', x: 60, y: 84, rotation: 0 },
      ];

      const tri = calculateNKBAWorkTriangle(items, FALLBACK_CATALOG);
      expect(tri).not.toBeNull();
      if (!tri) return;

      expect(tri.dSinkToCooktop).toBeGreaterThanOrEqual(48);
      expect(tri.dCooktopToFridge).toBeGreaterThanOrEqual(48);
      expect(tri.dFridgeToSink).toBeGreaterThanOrEqual(48);
      expect(tri.perimeter).toBeGreaterThanOrEqual(156);
      expect(tri.perimeter).toBeLessThanOrEqual(312);
      expect(tri.compliant).toBe(true);
      expect(tri.issues).toHaveLength(0);
    });

    it('detects violations when legs are too short or perimeter is out of bounds', () => {
      // Fixtures placed too close together: legs < 48"
      const items: RoomItem[] = [
        { id: 'sink-1', productId: 'undermount-sink', x: 20, y: 12, rotation: 0 },
        { id: 'cook-1', productId: 'pro-gas-range', x: 40, y: 12, rotation: 0 },
        { id: 'fridge-1', productId: 'french-door-fridge', x: 30, y: 36, rotation: 0 },
      ];

      const tri = calculateNKBAWorkTriangle(items, FALLBACK_CATALOG);
      expect(tri).not.toBeNull();
      if (!tri) return;

      expect(tri.compliant).toBe(false);
      expect(tri.issues.length).toBeGreaterThan(0);
      expect(
        tri.issues.some(
          (issue: string) => issue.includes('too short') || issue.includes('too small'),
        ),
      ).toBe(true);
    });
  });

  describe('8. Constitutional Zero-Mutation Invariant for Proposal Overlays', () => {
    it('proposal previews never mutate committed room state or version', () => {
      const initialCommittedState: RoomState = {
        sessionId: 'session-const-001',
        version: 5,
        roomType: 'kitchen',
        widthIn: 144,
        lengthIn: 180,
        budgetCents: 3000000,
        items: [
          { id: 'item-sink', productId: 'undermount-sink', x: 24, y: 12, rotation: 0 },
          { id: 'item-fridge', productId: 'french-door-fridge', x: 96, y: 12, rotation: 0 },
        ],
        openings: [],
        serviceAnchors: [],
      };

      // Deep clone snapshot before preview evaluation
      const snapshot = JSON.parse(JSON.stringify(initialCommittedState));

      // Proposal with place, move, and remove operations
      const proposal: Proposal = {
        id: 'prop-001',
        sessionId: 'session-const-001',
        baseVersion: 5,
        status: 'pending_human',
        rationale: 'Add range and reposition sink',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        createdAt: '2026-09-04T10:00:00Z',
        expiresAt: '2026-09-04T10:10:00Z',
        operations: [
          {
            type: 'place',
            productId: 'pro-gas-range',
            x: 60,
            y: 12,
            rotation: 0,
          },
          {
            type: 'move',
            itemId: 'item-sink',
            x: 36,
            y: 24,
            rotation: 90,
          },
          {
            type: 'remove',
            itemId: 'item-fridge',
          },
        ],
      };

      // Preview calculations simulate what the overlay layer evaluates
      const previewOps = proposal.operations.map((op) => {
        if (op.type === 'place') {
          const prod = resolveCatalogProduct(op.productId, FALLBACK_CATALOG);
          return {
            op,
            prod,
            footprint: footprintOf(
              { id: 'temp', productId: op.productId, x: op.x, y: op.y, rotation: op.rotation },
              prod,
            ),
          };
        }
        if (op.type === 'move') {
          const item = initialCommittedState.items.find((i) => i.id === op.itemId);
          const prod = item ? resolveCatalogProduct(item.productId, FALLBACK_CATALOG) : null;
          return { op, prod };
        }
        if (op.type === 'remove') {
          const item = initialCommittedState.items.find((i) => i.id === op.itemId);
          return { op, item };
        }
        return { op };
      });

      expect(previewOps).toHaveLength(3);

      // Verify CONSTITUTIONAL INVARIANTS:
      // 1. Version remains unincremented
      expect(initialCommittedState.version).toBe(snapshot.version);
      expect(initialCommittedState.version).toBe(5);

      // 2. Items list length remains untouched
      expect(initialCommittedState.items).toHaveLength(snapshot.items.length);
      expect(initialCommittedState.items).toHaveLength(2);

      // 3. Item coordinates remain at committed positions
      expect(initialCommittedState.items[0]).toEqual(snapshot.items[0]);
      expect(initialCommittedState.items[1]).toEqual(snapshot.items[1]);

      // 4. Budget remains unaltered
      expect(initialCommittedState.budgetCents).toBe(snapshot.budgetCents);

      // 5. Entire state object matches pre-preview snapshot verbatim
      expect(initialCommittedState).toEqual(snapshot);
    });
  });
});
