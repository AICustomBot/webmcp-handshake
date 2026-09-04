import { describe, expect, it } from 'vitest';
import type {
  AddOpeningOperation,
  MoveOperation,
  Operation,
  PlaceOperation,
  Product,
  RemoveOperation,
  RoomItem,
  RoomOpening,
  RoomState,
  SwapOperation,
} from '@handshake/contracts';
import { SYNTHETIC_CATALOG } from '../apps/worker/src/catalog';
import { PBR_MATERIALS, COLORS } from '../apps/web/lib/3d/materials';
import {
  calculateFixtureTransform,
  isQuarterTurned,
  ALL_16_CATALOG_ITEM_IDS,
  resolveModelType,
} from '../apps/web/lib/3d/parametric-models-utils';
import {
  DOOR_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WINDOW_SILL_HEIGHT,
  WINDOW_TOP_HEIGHT,
  calculateWallSegments,
} from '../apps/web/lib/3d/room-envelope-utils';
import { checkWebGLCapability, isWebGLAvailable } from '../apps/web/lib/3d/webgl-detector';
import { createStudioStore } from '../apps/web/lib/store/studio-store';

describe('Milestone HSK-29: React Three Fiber 3D Parametric Studio Canvas', () => {
  describe('1. Procedural 16 Catalog Items & Transform Geometry', () => {
    it('verifies all 16 items in SYNTHETIC_CATALOG are covered by procedural 3D model renderers', () => {
      expect(SYNTHETIC_CATALOG.length).toBe(16);
      expect(ALL_16_CATALOG_ITEM_IDS.length).toBe(16);

      for (const product of SYNTHETIC_CATALOG) {
        const modelType = resolveModelType(product.id);
        expect(modelType).toBe(product.id);
        expect(ALL_16_CATALOG_ITEM_IDS).toContain(product.id);
      }
    });

    it('renders fallback models for generic category SKUs and tub', () => {
      expect(resolveModelType('freestanding-soaking-tub')).toBe('freestanding-tub');
      expect(resolveModelType('custom-vanity-double')).toBe('harbor-vanity');
      expect(resolveModelType('commercial-fridge')).toBe('french-door-fridge');
      expect(resolveModelType('walkin-shower-enclosure')).toBe('open-shower');
      expect(resolveModelType('pro-cooking-range')).toBe('pro-gas-range');
      expect(resolveModelType('prep-island-deluxe')).toBe('prep-island');
    });

    it('computes exact 3D coordinates and quarter-turn transforms for floor-mounted fixtures', () => {
      const fridge = SYNTHETIC_CATALOG.find((p) => p.id === 'french-door-fridge')!;
      expect(fridge).toBeDefined();

      // Rotation 0 (South): width = 36, depth = 32
      const itemRot0: RoomItem = {
        id: 'fridge-1',
        productId: fridge.id,
        x: 24,
        y: 36,
        rotation: 0,
      };
      const t0 = calculateFixtureTransform(itemRot0, fridge);
      expect(t0.footprintWidth).toBe(36);
      expect(t0.footprintDepth).toBe(32);
      expect(t0.position[0]).toBe(24 + 36 / 2); // 42
      expect(t0.position[1]).toBe(fridge.heightIn! / 2); // 70 / 2 = 35
      expect(t0.position[2]).toBe(36 + 32 / 2); // 52
      expect(t0.rotation[1]).toBeCloseTo(0);

      // Rotation 90 (West): turned width = 32, depth = 36
      const itemRot90: RoomItem = {
        id: 'fridge-1',
        productId: fridge.id,
        x: 24,
        y: 36,
        rotation: 90,
      };
      const t90 = calculateFixtureTransform(itemRot90, fridge);
      expect(t90.footprintWidth).toBe(32);
      expect(t90.footprintDepth).toBe(36);
      expect(t90.position[0]).toBe(24 + 32 / 2); // 40
      expect(t90.position[2]).toBe(36 + 36 / 2); // 54
      expect(t90.rotation[1]).toBeCloseTo(-Math.PI / 2);

      // Rotation 180 (North)
      const itemRot180: RoomItem = { ...itemRot0, rotation: 180 };
      const t180 = calculateFixtureTransform(itemRot180, fridge);
      expect(t180.rotation[1]).toBeCloseTo(-Math.PI);

      // Rotation 270 (East)
      const itemRot270: RoomItem = { ...itemRot0, rotation: 270 };
      const t270 = calculateFixtureTransform(itemRot270, fridge);
      expect(t270.rotation[1]).toBeCloseTo((-270 * Math.PI) / 180);
    });

    it('computes correct mounting elevations for wall, ceiling, and counter fixtures', () => {
      // 1. Wall Hood (bottom at 66")
      const hood = SYNTHETIC_CATALOG.find((p) => p.id === 'canopy-range-hood')!;
      const itemHood: RoomItem = { id: 'hood-1', productId: hood.id, x: 50, y: 0, rotation: 0 };
      const tHood = calculateFixtureTransform(itemHood, hood);
      expect(tHood.position[1]).toBe(66 + hood.heightIn! / 2); // 66 + 12 = 78

      // 2. Wall Cabinet (bottom at 54")
      const wallCab = SYNTHETIC_CATALOG.find((p) => p.id === 'upper-glass-cabinet')!;
      const itemWallCab: RoomItem = {
        id: 'wcb-1',
        productId: wallCab.id,
        x: 10,
        y: 0,
        rotation: 0,
      };
      const tWallCab = calculateFixtureTransform(itemWallCab, wallCab);
      expect(tWallCab.position[1]).toBe(54 + wallCab.heightIn! / 2); // 54 + 15 = 69

      // 3. Wall Oven (bottom at 30")
      const wallOven = SYNTHETIC_CATALOG.find((p) => p.id === 'smart-wall-oven')!;
      const itemWallOven: RoomItem = {
        id: 'ovn-1',
        productId: wallOven.id,
        x: 80,
        y: 0,
        rotation: 0,
      };
      const tWallOven = calculateFixtureTransform(itemWallOven, wallOven);
      expect(tWallOven.position[1]).toBe(30 + wallOven.heightIn! / 2); // 30 + 14.5 = 44.5

      // 4. Flush Mount Light (ceiling at 96")
      const light = SYNTHETIC_CATALOG.find((p) => p.id === 'flush-mount-light')!;
      const itemLight: RoomItem = { id: 'lgt-1', productId: light.id, x: 72, y: 90, rotation: 0 };
      const tLight = calculateFixtureTransform(itemLight, light);
      expect(tLight.position[1]).toBe(96 - light.heightIn! / 2); // 96 - 2 = 94

      // 5. Undermount Sink (counter at 34.5")
      const sink = SYNTHETIC_CATALOG.find((p) => p.id === 'undermount-sink')!;
      const itemSink: RoomItem = { id: 'snk-1', productId: sink.id, x: 40, y: 10, rotation: 0 };
      const tSink = calculateFixtureTransform(itemSink, sink);
      expect(tSink.position[1]).toBe(34.5 - sink.heightIn! / 2); // 34.5 - 5 = 29.5

      // 6. Induction Cooktop (counter top at 36")
      const cooktop = SYNTHETIC_CATALOG.find((p) => p.id === 'induction-cooktop')!;
      const itemCooktop: RoomItem = {
        id: 'ckt-1',
        productId: cooktop.id,
        x: 70,
        y: 10,
        rotation: 0,
      };
      const tCooktop = calculateFixtureTransform(itemCooktop, cooktop);
      expect(tCooktop.position[1]).toBe(36 + cooktop.heightIn! / 2); // 36 + 2 = 38
    });
  });

  describe('2. PBR Materials & Constitutional Amber Proposal Ghost', () => {
    it('defines realistic PBR materials with proper metallic, roughness, and transmission parameters', () => {
      expect(PBR_MATERIALS.stainless.metalness).toBeGreaterThanOrEqual(0.85);
      expect(PBR_MATERIALS.stainless.roughness).toBeLessThanOrEqual(0.3);

      expect(PBR_MATERIALS.polishedQuartz.roughness).toBeLessThan(0.2);

      expect(PBR_MATERIALS.glazedPorcelain.roughness).toBeLessThan(0.15);

      expect(PBR_MATERIALS.architecturalGlass.transmission).toBeGreaterThan(0.8);
      expect(PBR_MATERIALS.architecturalGlass.transparent).toBe(true);
    });

    it('enforces constitutional amber proposal ghost material invariants', () => {
      const ghost = PBR_MATERIALS.proposalGhost;
      expect(ghost.transparent).toBe(true);
      expect(ghost.opacity).toBeCloseTo(0.55, 1);
      expect(ghost.color.getHexString().toLowerCase()).toBe('f59e0b');
      expect(ghost.emissive.getHexString().toLowerCase()).toBe('d97706');
      expect(ghost.emissiveIntensity).toBeGreaterThan(0.3);

      const removeGhost = PBR_MATERIALS.proposalRemoveGhost;
      expect(removeGhost.transparent).toBe(true);
      expect(removeGhost.color.getHexString().toLowerCase()).toBe('ef4444');
    });

    it('verifies color tokens match design spec', () => {
      expect(COLORS.proposalAmber).toBe('#f59e0b');
      expect(COLORS.proposalAmberEmissive).toBe('#d97706');
      expect(COLORS.proposalRemoveRed).toBe('#ef4444');
      expect(COLORS.selectionBlue).toBe('#3b82f6');
    });
  });

  describe('3. Architectural Room Envelope & Cutouts', () => {
    it('enforces residential architectural height and framing standards', () => {
      expect(WALL_HEIGHT).toBe(96); // 8-foot ceiling
      expect(WALL_THICKNESS).toBe(4.5); // 2x4 stud + 1/2" drywall
      expect(DOOR_HEIGHT).toBe(80); // 6'8" door head
      expect(WINDOW_SILL_HEIGHT).toBe(36); // 3' sill apron
      expect(WINDOW_TOP_HEIGHT).toBe(72); // 6' window head
    });

    it('calculates lintel and glazing dimensions for door and window openings', () => {
      // Door opening: lintel is above door
      const doorLintelHeight = WALL_HEIGHT - DOOR_HEIGHT;
      expect(doorLintelHeight).toBe(16); // 96 - 80 = 16" lintel

      // Window opening: void between 36" and 72"
      const windowVoidHeight = WINDOW_TOP_HEIGHT - WINDOW_SILL_HEIGHT;
      expect(windowVoidHeight).toBe(36); // 72 - 36 = 36" window pane

      // Window lintel: above 72"
      const windowLintelHeight = WALL_HEIGHT - WINDOW_TOP_HEIGHT;
      expect(windowLintelHeight).toBe(24); // 96 - 72 = 24" lintel
    });
  });

  describe('4. Studio Store 3D Viewport, Camera Modes & WebGL Resilience', () => {
    it('initializes with default 2D viewport and orbit camera mode', () => {
      const store = createStudioStore();
      const state = store.getState();
      expect(state.viewportMode).toBe('2d');
      expect(state.cameraMode).toBe('orbit');
      expect(state.webglStatus).toBe('ready');
      expect(state.webglError).toBeNull();
    });

    it('smoothly switches camera modes (orbit, first-person, orthographic)', () => {
      const store = createStudioStore();

      store.getState().setCameraMode('first-person');
      expect(store.getState().cameraMode).toBe('first-person');

      store.getState().setCameraMode('orthographic');
      expect(store.getState().cameraMode).toBe('orthographic');

      store.getState().setCameraMode('orbit');
      expect(store.getState().cameraMode).toBe('orbit');
    });

    it('switches viewport mode between 2d and 3d', () => {
      const store = createStudioStore();

      store.getState().setViewportMode('3d');
      expect(store.getState().viewportMode).toBe('3d');

      store.getState().setViewportMode('2d');
      expect(store.getState().viewportMode).toBe('2d');
    });

    it('automatically reverts to 2D on WebGL context loss or unsupported hardware', () => {
      const store = createStudioStore();
      store.getState().setViewportMode('3d');
      expect(store.getState().viewportMode).toBe('3d');

      // Trigger WebGL context lost event
      store.getState().setWebGLStatus('context_lost', 'GPU memory evicted WebGL context');

      expect(store.getState().webglStatus).toBe('context_lost');
      expect(store.getState().webglError).toBe('GPU memory evicted WebGL context');
      // Invariant: Viewport mode must fail-safe to 2D
      expect(store.getState().viewportMode).toBe('2d');

      // Trigger unsupported
      store.getState().setViewportMode('3d');
      store.getState().setWebGLStatus('unsupported', 'WebGL disabled by host browser');
      expect(store.getState().webglStatus).toBe('unsupported');
      expect(store.getState().viewportMode).toBe('2d');

      // Recovery back to ready allows 3d
      store.getState().setWebGLStatus('ready');
      expect(store.getState().webglStatus).toBe('ready');
      expect(store.getState().webglError).toBeNull();
    });

    it('cleans up WebGL state on session reset', () => {
      const store = createStudioStore();
      store.getState().setWebGLStatus('context_lost', 'error');
      store.getState().resetSession();

      expect(store.getState().webglStatus).toBe('ready');
      expect(store.getState().webglError).toBeNull();
      expect(store.getState().viewportMode).toBe('2d');
    });
  });

  describe('5. Zero-Mutation Invariant for Amber Proposal Overlays in 3D', () => {
    it('maintains committed room state version and items intact during proposal preview', async () => {
      const mockClient: any = {
        getState: async () => ({
          state: {
            sessionId: 'test-3d-session',
            version: 3,
            widthIn: 144,
            lengthIn: 180,
            budgetCents: 2500000,
            roomType: 'kitchen',
            items: [{ id: 'item-1', productId: 'harbor-vanity', x: 24, y: 24, rotation: 0 }],
          },
          evaluation: {
            valid: true,
            findings: [],
            totalCents: 248000,
            remainingCents: 2252000,
            violations: [],
            workTrianglePerimeterIn: 0,
            workTriangleValid: false,
          },
        }),
        getCatalog: async () => ({ products: SYNTHETIC_CATALOG }),
        createSession: async () => ({ sessionId: 'test-3d-session', capability: 'cap-test' }),
        propose: async () => ({
          proposal: {
            id: 'prop-3d-1',
            sessionId: 'test-3d-session',
            status: 'pending_human',
            expectedVersion: 3,
            proposalHash: 'hash-3d-1',
            operations: [
              {
                type: 'place',
                productId: 'pro-gas-range',
                x: 60,
                y: 24,
                rotation: 0,
              } as PlaceOperation,
              {
                type: 'move',
                itemId: 'item-1',
                x: 36,
                y: 48,
                rotation: 90,
              } as MoveOperation,
              {
                type: 'swap',
                itemId: 'item-1',
                replacementProductId: 'prep-island',
              } as SwapOperation,
              {
                type: 'remove',
                itemId: 'item-1',
              } as RemoveOperation,
            ],
            rationale: 'Testing 3D proposal ghost preview',
            createdAt: new Date().toISOString(),
          },
          state: {
            sessionId: 'test-3d-session',
            version: 3, // Still version 3!
            widthIn: 144,
            lengthIn: 180,
            budgetCents: 2500000,
            roomType: 'kitchen',
            items: [
              { id: 'item-1', productId: 'harbor-vanity', x: 24, y: 24, rotation: 0 }, // Untouched!
            ],
          },
        }),
      };

      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen', 2500000);

      const beforeState = store.getState().roomState!;
      expect(beforeState.version).toBe(3);
      expect(beforeState.items.length).toBe(1);
      expect(beforeState.items[0]?.x).toBe(24);

      // Submit proposal with 4 operations (place, move, swap, remove)
      const proposal = await store
        .getState()
        .propose(
          [{ type: 'place', productId: 'pro-gas-range', x: 60, y: 24, rotation: 0 }],
          'Testing 3D ghost preview',
        );

      expect(proposal).not.toBeNull();
      expect(store.getState().activeProposal).not.toBeNull();

      // CONSTITUTIONAL ZERO-MUTATION INVARIANT:
      const afterState = store.getState().roomState!;
      expect(afterState.version).toBe(3); // Version must NOT increment
      expect(afterState.items.length).toBe(1); // Item count must NOT change
      expect(afterState.items[0]?.x).toBe(24); // Coordinates must NOT change
      expect(afterState.items[0]?.rotation).toBe(0);
    });
  });

  describe('6. WebGL Capability Detection Logic', () => {
    it('returns structured WebGLCapability report', () => {
      const cap = checkWebGLCapability();
      expect(cap).toBeDefined();
      expect(typeof cap.supported).toBe('boolean');
      expect(['webgl2', 'webgl', 'none']).toContain(cap.version);
    });

    it('safely handles non-browser SSR environment without throwing', () => {
      expect(() => checkWebGLCapability()).not.toThrow();
      expect(() => isWebGLAvailable()).not.toThrow();
    });
  });
});
