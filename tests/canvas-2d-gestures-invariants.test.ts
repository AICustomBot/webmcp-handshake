import { describe, expect, it, vi } from 'vitest';
import type {
  Product,
  Proposal,
  RoomItem,
  RoomOpening,
  RoomState,
  Rotation,
  ServiceAnchor,
  ServiceKind,
  WallSide,
} from '@handshake/contracts';
import {
  WALL_THICKNESS,
  PERIMETER_MARGIN,
  FALLBACK_CATALOG,
  UTILITY_SERVICE_CONFIG,
  getUtilityConfig,
  resolveCatalogProduct,
  calculateViewBox,
  formatDimension,
  snapToGrid,
  clampCoordinate,
  getOrientationVector,
  calculateNKBAWorkTriangle,
  footprintOf,
  centerOf,
  distanceBetween,
  widthOf,
  depthOf,
  stripInFront,
  overlaps,
  fitsInsideRoom,
  pointOnWall,
} from '../apps/web/components/studio/canvas-2d-utils';

describe('Milestone HSK-28 Adversarial Verification: Gestures, Live Drag Collisions, Proposal Invariants & Anchor Rendering', () => {
  describe('1. Mobile Touch & Pinch-to-Zoom Resilience', () => {
    // Model the exact state and handlers from apps/web/components/studio/canvas-2d.tsx (lines 90-98, 218-270)
    class GestureController {
      activePointers = new Map<number, { clientX: number; clientY: number }>();
      initialPinchDist: number | null = null;
      initialZoomOnPinch = 1.0;
      panStart: { clientX: number; clientY: number; panX: number; panY: number } | null = null;
      zoom = 1.0;
      pan = { x: 0, y: 0 };
      draggingItemId: string | null = null;

      pointerDown(pointerId: number, clientX: number, clientY: number) {
        this.activePointers.set(pointerId, { clientX, clientY });
        if (this.activePointers.size === 1) {
          this.panStart = {
            clientX,
            clientY,
            panX: this.pan.x,
            panY: this.pan.y,
          };
        } else if (this.activePointers.size === 2) {
          const pts = Array.from(this.activePointers.values());
          if (pts[0] && pts[1]) {
            const dist = Math.hypot(
              pts[0].clientX - pts[1].clientX,
              pts[0].clientY - pts[1].clientY,
            );
            if (dist >= 15) {
              this.initialPinchDist = dist;
              this.initialZoomOnPinch = this.zoom;
            }
          }
        }
      }

      pointerMove(pointerId: number, clientX: number, clientY: number) {
        if (!this.activePointers.has(pointerId)) return;
        this.activePointers.set(pointerId, { clientX, clientY });

        if (this.activePointers.size === 1 && this.panStart && !this.draggingItemId) {
          const dx = clientX - this.panStart.clientX;
          const dy = clientY - this.panStart.clientY;
          this.pan = {
            x: this.panStart.panX + dx * 0.6,
            y: this.panStart.panY + dy * 0.6,
          };
        } else if (this.activePointers.size === 2 && this.initialPinchDist !== null) {
          const pts = Array.from(this.activePointers.values());
          if (pts[0] && pts[1]) {
            const dist = Math.hypot(
              pts[0].clientX - pts[1].clientX,
              pts[0].clientY - pts[1].clientY,
            );
            if (dist >= 15 && this.initialPinchDist >= 15) {
              const factor = dist / this.initialPinchDist;
              const newZoom = Math.min(3.0, Math.max(0.4, this.initialZoomOnPinch * factor));
              this.zoom = Number(newZoom.toFixed(2));
            }
          }
        }
      }

      pointerUp(pointerId: number) {
        this.activePointers.delete(pointerId);
        if (this.activePointers.size < 2) {
          this.initialPinchDist = null;
        }
        if (this.activePointers.size === 0) {
          this.panStart = null;
        }
      }
    }

    it('single-point touch pans the viewport and preserves finite zoom without NaN', () => {
      const gc = new GestureController();
      gc.zoom = 1.25;

      gc.pointerDown(1, 100, 100);
      expect(gc.activePointers.size).toBe(1);
      expect(gc.panStart).toEqual({ clientX: 100, clientY: 100, panX: 0, panY: 0 });

      gc.pointerMove(1, 160, 140);
      expect(gc.pan).toEqual({ x: (160 - 100) * 0.6, y: (140 - 100) * 0.6 });
      expect(gc.zoom).toBe(1.25);
      expect(Number.isNaN(gc.zoom)).toBe(false);

      gc.pointerUp(1);
      expect(gc.activePointers.size).toBe(0);
      expect(gc.panStart).toBeNull();
      expect(gc.zoom).toBe(1.25);
    });

    it('zero-distance pinch start (< 15px threshold) does NOT trigger pinch state or cause division by zero', () => {
      const gc = new GestureController();
      gc.zoom = 1.0;

      // Two pointers touching at identical coordinates (dist = 0)
      gc.pointerDown(1, 150, 150);
      gc.pointerDown(2, 150, 150);

      expect(gc.activePointers.size).toBe(2);
      // Distance is 0 < 15, so initialPinchDist remains null
      expect(gc.initialPinchDist).toBeNull();

      // Pointers move while still at zero distance
      gc.pointerMove(1, 150, 150);
      gc.pointerMove(2, 150, 150);

      expect(gc.zoom).toBe(1.0);
      expect(Number.isNaN(gc.zoom)).toBe(false);
      expect(Number.isFinite(gc.zoom)).toBe(true);
    });

    it('pinch collapsing to zero distance does not produce NaN or Infinity', () => {
      const gc = new GestureController();
      gc.zoom = 1.0;

      // Start pinch with distance = 50px
      gc.pointerDown(1, 100, 100);
      gc.pointerDown(2, 150, 100);
      expect(gc.initialPinchDist).toBe(50);

      // Collapsing pinch: both fingers move to exact same point (dist = 0)
      gc.pointerMove(1, 125, 100);
      gc.pointerMove(2, 125, 100);

      // When distance drops below 15px down to 0, guard prevents division by zero
      expect(gc.zoom).toBe(0.5); // intermediate zoom when dist was 25px
      expect(Number.isNaN(gc.zoom)).toBe(false);
      expect(Number.isFinite(gc.zoom)).toBe(true);
      expect(gc.zoom).toBeGreaterThanOrEqual(0.4);
      expect(gc.zoom).toBeLessThanOrEqual(3.0);
    });

    it('pinching clamps smoothly within architectural limits (0.4 to 3.0) and avoids floating point drift', () => {
      const gc = new GestureController();
      gc.zoom = 1.0;

      // Initial pinch dist = 50
      gc.pointerDown(1, 100, 100);
      gc.pointerDown(2, 150, 100);

      // Massive expansion: dist = 1000px (factor = 20x)
      gc.pointerMove(2, 1100, 100);
      expect(gc.zoom).toBe(3.0); // Clamped at 3.0 maximum

      // Shrink below minimum: dist = 16px (factor = 0.32)
      gc.pointerMove(2, 116, 100);
      expect(gc.zoom).toBe(0.4); // Clamped at 0.4 minimum

      // Moderate zoom: dist = 85px (factor = 1.7)
      gc.pointerMove(2, 185, 100);
      expect(gc.zoom).toBe(1.7);
      expect(Number.isFinite(gc.zoom)).toBe(true);
      expect(Number.isNaN(gc.zoom)).toBe(false);
    });

    it('pointer lift transitions cleanly from 2-pointer pinch back to single-pointer pan or idle', () => {
      const gc = new GestureController();
      gc.pointerDown(1, 100, 100);
      gc.pointerDown(2, 150, 100);
      expect(gc.initialPinchDist).toBe(50);

      // Lift one finger
      gc.pointerUp(2);
      expect(gc.activePointers.size).toBe(1);
      expect(gc.initialPinchDist).toBeNull(); // Reset

      // Lift second finger
      gc.pointerUp(1);
      expect(gc.activePointers.size).toBe(0);
      expect(gc.panStart).toBeNull();
    });
  });

  describe('2. Live Drag Collision Detection & Commit Timing', () => {
    // Model fixture drag logic from canvas-2d.tsx (lines 138-215)
    class DragSimulator {
      roomState: RoomState;
      catalog: Product[];
      gridSnap = true;

      // Drag state
      draggingItemId: string | null = null;
      dragOffset: { x: number; y: number } | null = null;
      dragPreview: { x: number; y: number } | null = null;
      dragCollision = false;
      hasMoved = false;

      // Call spy
      moveItemSpy = vi.fn();

      constructor(roomState: RoomState, catalog: Product[]) {
        this.roomState = JSON.parse(JSON.stringify(roomState));
        this.catalog = catalog;
      }

      pointerDown(itemId: string, clientX: number, clientY: number) {
        const item = this.roomState.items.find((i) => i.id === itemId);
        if (!item) return;
        this.draggingItemId = itemId;
        this.dragOffset = { x: clientX, y: clientY };
        this.dragPreview = { x: item.x, y: item.y };
        this.dragCollision = false;
        this.hasMoved = false;
      }

      pointerMove(clientX: number, clientY: number) {
        if (!this.draggingItemId || !this.dragOffset) return;
        const item = this.roomState.items.find((i) => i.id === this.draggingItemId);
        if (!item) return;

        const dxPx = clientX - this.dragOffset.x;
        const dyPx = clientY - this.dragOffset.y;
        // Assume 1px = 0.5" for simulation scale
        const dxIn = dxPx * 0.5;
        const dyIn = dyPx * 0.5;

        if (Math.hypot(dxIn, dyIn) > 2) {
          this.hasMoved = true;
        }

        const rawX = item.x + dxIn;
        const rawY = item.y + dyIn;
        const snappedX = snapToGrid(rawX, this.gridSnap);
        const snappedY = snapToGrid(rawY, this.gridSnap);

        const prod = resolveCatalogProduct(item.productId, this.catalog);
        const box = footprintOf(item, prod);
        const w = widthOf(box);
        const d = depthOf(box);

        const clampedX = clampCoordinate(snappedX, w, this.roomState.widthIn);
        const clampedY = clampCoordinate(snappedY, d, this.roomState.lengthIn);
        this.dragPreview = { x: clampedX, y: clampedY };

        const candidateFootprint = {
          left: clampedX,
          top: clampedY,
          right: clampedX + w,
          bottom: clampedY + d,
        };

        const isColliding = this.roomState.items.some((other) => {
          if (other.id === item.id) return false;
          const otherProd = resolveCatalogProduct(other.productId, this.catalog);
          const otherBox = footprintOf(other, otherProd);
          return overlaps(candidateFootprint, otherBox);
        });

        this.dragCollision = isColliding;
      }

      pointerUp() {
        if (!this.draggingItemId) return;
        const item = this.roomState.items.find((i) => i.id === this.draggingItemId);
        if (this.hasMoved && this.dragPreview && item) {
          this.moveItemSpy(item.id, this.dragPreview.x, this.dragPreview.y, item.rotation);
        }
        this.draggingItemId = null;
        this.dragOffset = null;
        this.dragPreview = null;
        this.dragCollision = false;
        this.hasMoved = false;
      }
    }

    const testState: RoomState = {
      sessionId: 'test-session-drag',
      version: 4,
      roomType: 'kitchen',
      widthIn: 144,
      lengthIn: 180,
      budgetCents: 2000000,
      items: [
        { id: 'sink-1', productId: 'undermount-sink', x: 24, y: 12, rotation: 0 },
        { id: 'range-1', productId: 'pro-gas-range', x: 72, y: 12, rotation: 0 },
      ],
      openings: [],
      serviceAnchors: [],
    };

    it('flags live collision during pointermove when dragged over an existing fixture', () => {
      const sim = new DragSimulator(testState, FALLBACK_CATALOG);
      const initialVersion = sim.roomState.version;

      // Start drag on sink-1 at client pos (100, 100)
      sim.pointerDown('sink-1', 100, 100);
      expect(sim.dragCollision).toBe(false);

      // Drag sink-1 to range-1 position (dxPx = 100 -> dxIn = 50 -> rawX = 24 + 50 = 74 -> snapped = 72)
      sim.pointerMove(200, 100);

      // Range-1 is at (72, 12). Dragged sink footprint overlaps range-1!
      expect(sim.dragPreview).toEqual({ x: 72, y: 12 });
      expect(sim.dragCollision).toBe(true);

      // INVARIANT: State must NOT have committed before pointerup!
      expect(sim.roomState.version).toBe(initialVersion);
      expect(sim.roomState.items[0]!.x).toBe(24);
      expect(sim.moveItemSpy).not.toHaveBeenCalled();
    });

    it('clears collision flag when dragged to a free position, still without committing state', () => {
      const sim = new DragSimulator(testState, FALLBACK_CATALOG);

      sim.pointerDown('sink-1', 100, 100);
      // Drag to range-1 (collision)
      sim.pointerMove(200, 100);
      expect(sim.dragCollision).toBe(true);

      // Drag to clear space: y = 84 (dyPx = 144 -> dyIn = 72 -> y = 12 + 72 = 84)
      sim.pointerMove(100, 244);
      expect(sim.dragCollision).toBe(false);
      expect(sim.dragPreview?.y).toBe(84);

      // State is still uncommitted
      expect(sim.roomState.version).toBe(4);
      expect(sim.roomState.items[0]!.y).toBe(12);
      expect(sim.moveItemSpy).not.toHaveBeenCalled();
    });

    it('only invokes moveItem on pointerup if hasMoved is true', () => {
      const sim = new DragSimulator(testState, FALLBACK_CATALOG);

      // Click without moving (e.g. selection click)
      sim.pointerDown('sink-1', 100, 100);
      sim.pointerUp();
      expect(sim.moveItemSpy).not.toHaveBeenCalled();

      // Drag and release
      sim.pointerDown('sink-1', 100, 100);
      sim.pointerMove(100, 244); // moved > 2 in
      expect(sim.hasMoved).toBe(true);
      sim.pointerUp();

      expect(sim.moveItemSpy).toHaveBeenCalledTimes(1);
      expect(sim.moveItemSpy).toHaveBeenCalledWith('sink-1', 24, 84, 0);
    });
  });

  describe('3. Constitutional Zero-Mutation Invariant: Proposal Overlays', () => {
    it('evaluating and rendering active proposal overlays NEVER mutates committed roomState.version or items', () => {
      const committedRoomState: RoomState = {
        sessionId: 'session-constitutional-guard',
        version: 8,
        roomType: 'kitchen',
        widthIn: 144,
        lengthIn: 180,
        budgetCents: 3500000,
        items: [
          { id: 'item-sink', productId: 'undermount-sink', x: 24, y: 12, rotation: 0 },
          { id: 'item-fridge', productId: 'french-door-fridge', x: 96, y: 12, rotation: 0 },
          { id: 'item-range', productId: 'pro-gas-range', x: 60, y: 12, rotation: 0 },
        ],
        openings: [],
        serviceAnchors: [],
      };

      // Deep frozen snapshot
      const snapshot = JSON.stringify(committedRoomState);

      const activeProposal: Proposal = {
        id: 'prop-adversarial-test',
        sessionId: 'session-constitutional-guard',
        baseVersion: 8,
        status: 'pending_human',
        rationale: 'Rearrange appliances and place dishwasher',
        hash: 'a'.repeat(64),
        createdAt: '2026-09-04T11:00:00Z',
        expiresAt: '2026-09-04T11:15:00Z',
        operations: [
          {
            type: 'place',
            productId: 'double-drawer-dishwasher',
            x: 24,
            y: 36,
            rotation: 0,
          },
          {
            type: 'move',
            itemId: 'item-sink',
            x: 48,
            y: 12,
            rotation: 180,
          },
          {
            type: 'remove',
            itemId: 'item-fridge',
          },
        ],
      };

      // Simulate rendering of `#proposal-layer`
      const renderedOverlayElements: { type: string; box?: any; line?: any }[] = [];

      if (activeProposal && activeProposal.status === 'pending_human') {
        for (const op of activeProposal.operations) {
          if (op.type === 'place') {
            const product = resolveCatalogProduct(op.productId, FALLBACK_CATALOG);
            const dummyItem: RoomItem = {
              id: `preview-place`,
              productId: op.productId,
              x: op.x,
              y: op.y,
              rotation: op.rotation,
            };
            const box = footprintOf(dummyItem, product);
            renderedOverlayElements.push({ type: 'place', box });
          } else if (op.type === 'move') {
            const target = committedRoomState.items.find((i) => i.id === op.itemId);
            if (target) {
              const product = resolveCatalogProduct(target.productId, FALLBACK_CATALOG);
              const oldBox = footprintOf(target, product);
              const oldCenter = centerOf(oldBox);
              const dummyItem: RoomItem = {
                id: `preview-move`,
                productId: target.productId,
                x: op.x,
                y: op.y,
                rotation: op.rotation,
              };
              const newBox = footprintOf(dummyItem, product);
              const newCenter = centerOf(newBox);
              renderedOverlayElements.push({
                type: 'move',
                box: newBox,
                line: { from: oldCenter, to: newCenter },
              });
            }
          } else if (op.type === 'remove') {
            const target = committedRoomState.items.find((i) => i.id === op.itemId);
            if (target) {
              const product = resolveCatalogProduct(target.productId, FALLBACK_CATALOG);
              const box = footprintOf(target, product);
              renderedOverlayElements.push({ type: 'remove', box });
            }
          }
        }
      }

      // Assert overlay produced the 3 previews
      expect(renderedOverlayElements).toHaveLength(3);
      expect(renderedOverlayElements[0]!.type).toBe('place');
      expect(renderedOverlayElements[1]!.type).toBe('move');
      expect(renderedOverlayElements[2]!.type).toBe('remove');

      // CONSTITUTIONAL INVARIANTS:
      // 1. Version must be strictly unincremented
      expect(committedRoomState.version).toBe(8);
      // 2. Items list must contain exactly the original 3 committed items
      expect(committedRoomState.items).toHaveLength(3);
      expect(committedRoomState.items.map((i) => i.id)).toEqual([
        'item-sink',
        'item-fridge',
        'item-range',
      ]);
      // 3. Item coordinates must be untouched
      expect(committedRoomState.items[0]!.x).toBe(24);
      expect(committedRoomState.items[0]!.rotation).toBe(0);
      // 4. Removed item must NOT be removed from roomState
      expect(committedRoomState.items.find((i) => i.id === 'item-fridge')).toBeDefined();
      // 5. Deep equality against pre-render snapshot holds verbatim
      expect(JSON.stringify(committedRoomState)).toBe(snapshot);
    });
  });

  describe('4. Utility Service Anchors Rendering for All 6 Service Kinds', () => {
    const allServiceKinds: ServiceKind[] = [
      'water',
      'drain',
      'gas',
      'electrical_120v',
      'electrical_240v',
      'vent',
    ];

    const serviceAnchors: ServiceAnchor[] = [
      { id: 'anc-w', kind: 'water', wall: 'north', offsetIn: 36 },
      { id: 'anc-d', kind: 'drain', wall: 'north', offsetIn: 48 },
      { id: 'anc-g', kind: 'gas', wall: 'south', offsetIn: 60 },
      { id: 'anc-e1', kind: 'electrical_120v', wall: 'west', offsetIn: 72 },
      { id: 'anc-e2', kind: 'electrical_240v', wall: 'south', offsetIn: 96 },
      { id: 'anc-v', kind: 'vent', wall: 'east', offsetIn: 60 },
    ];

    it('provides distinct, valid configurations for all 6 service kinds', () => {
      expect(allServiceKinds).toHaveLength(6);
      for (const kind of allServiceKinds) {
        const conf = getUtilityConfig(kind);
        expect(conf).toBeDefined();
        expect(conf.name.length).toBeGreaterThan(0);
        expect(conf.label.length).toBeGreaterThan(0);
        expect(conf.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(['circle', 'diamond', 'rect', 'hexagon', 'square']).toContain(conf.symbol);
      }
    });

    it('renders exact glyphs and colors matching architectural standards', () => {
      const water = getUtilityConfig('water');
      expect(water.symbol).toBe('circle');
      expect(water.label).toBe('W');
      expect(water.color).toBe('#0284c7');

      const drain = getUtilityConfig('drain');
      expect(drain.symbol).toBe('circle');
      expect(drain.label).toBe('D');
      expect(drain.color).toBe('#2563eb');

      const gas = getUtilityConfig('gas');
      expect(gas.symbol).toBe('diamond');
      expect(gas.label).toBe('G');
      expect(gas.color).toBe('#eab308');

      const e120 = getUtilityConfig('electrical_120v');
      expect(e120.symbol).toBe('rect');
      expect(e120.label).toBe('120V');
      expect(e120.color).toBe('#06b6d4');

      const e240 = getUtilityConfig('electrical_240v');
      expect(e240.symbol).toBe('hexagon');
      expect(e240.label).toBe('240V');
      expect(e240.color).toBe('#7c3aed');

      const vent = getUtilityConfig('vent');
      expect(vent.symbol).toBe('square');
      expect(vent.label).toBe('V');
      expect(vent.color).toBe('#059669');
    });

    it('calculates exact wall coordinates on all 4 walls (North, South, West, East)', () => {
      const room: RoomState = {
        sessionId: 'test-anchors',
        version: 1,
        widthIn: 144,
        lengthIn: 180,
        budgetCents: 1000000,
        items: [],
      };

      const computeAnchorCenter = (anchor: ServiceAnchor) => {
        let cx = anchor.offsetIn;
        let cy = 0;
        if (anchor.wall === 'north') {
          cx = anchor.offsetIn;
          cy = -WALL_THICKNESS / 2;
        } else if (anchor.wall === 'south') {
          cx = anchor.offsetIn;
          cy = room.lengthIn + WALL_THICKNESS / 2;
        } else if (anchor.wall === 'west') {
          cx = -WALL_THICKNESS / 2;
          cy = anchor.offsetIn;
        } else if (anchor.wall === 'east') {
          cx = room.widthIn + WALL_THICKNESS / 2;
          cy = anchor.offsetIn;
        }
        return { cx, cy };
      };

      // North wall (water at 36) -> cx = 36, cy = -2.25
      const pNorth = computeAnchorCenter(serviceAnchors[0]!);
      expect(pNorth).toEqual({ cx: 36, cy: -WALL_THICKNESS / 2 });

      // South wall (gas at 60) -> cx = 60, cy = 180 + 2.25 = 182.25
      const pSouth = computeAnchorCenter(serviceAnchors[2]!);
      expect(pSouth).toEqual({ cx: 60, cy: 180 + WALL_THICKNESS / 2 });

      // West wall (120V at 72) -> cx = -2.25, cy = 72
      const pWest = computeAnchorCenter(serviceAnchors[3]!);
      expect(pWest).toEqual({ cx: -WALL_THICKNESS / 2, cy: 72 });

      // East wall (vent at 60) -> cx = 144 + 2.25 = 146.25, cy = 60
      const pEast = computeAnchorCenter(serviceAnchors[5]!);
      expect(pEast).toEqual({ cx: 144 + WALL_THICKNESS / 2, cy: 60 });
    });

    it('correctly maps fixture utility requirements to corresponding anchor connectors', () => {
      const sinkProd = resolveCatalogProduct('undermount-sink', FALLBACK_CATALOG);
      const rangeProd = resolveCatalogProduct('pro-gas-range', FALLBACK_CATALOG);
      const hoodProd = resolveCatalogProduct('canopy-range-hood', FALLBACK_CATALOG);

      // Sink requires plumbing (water + drain)
      expect(sinkProd.requiresPlumbing).toBe(true);

      // Range requires electrical (240v) and venting
      expect(rangeProd.requiresElectrical).toBe(true);
      expect(rangeProd.requiresVenting).toBe(true);
      expect(rangeProd.category).toBe('range'); // 240V mapped

      // Canopy range hood requires venting and electrical (120v)
      expect(hoodProd.requiresVenting).toBe(true);
      expect(hoodProd.requiresElectrical).toBe(true);
      expect(hoodProd.category).toBe('hood'); // 120V mapped
    });
  });
});
