import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudioStore, type StudioStore } from '../apps/web/lib/store/studio-store';
import { HandshakeApiClient, type ConfirmationResponse } from '../apps/web/lib/api-client';
import type {
  CatalogResponse,
  DesignEvaluation,
  Product,
  Proposal,
  ProtectedActionResponse,
  RoomState,
} from '@handshake/contracts';

describe('Studio Zustand Store', () => {
  let mockClient: HandshakeApiClient;

  const mockProduct: Product = {
    id: 'sink-base-36',
    name: 'Sink Base 36"',
    category: 'base_cabinet',
    finish: 'white',
    priceCents: 45000,
    widthIn: 36,
    depthIn: 24,
    clearanceIn: 36,
    accessible: true,
  };

  const mockRoomState: RoomState = {
    sessionId: 'test-session-123',
    version: 0,
    roomType: 'kitchen',
    widthIn: 144,
    lengthIn: 180,
    budgetCents: 1500000,
    items: [
      {
        id: 'item-1',
        productId: 'sink-base-36',
        x: 12,
        y: 12,
        rotation: 0,
      },
    ],
    openings: [],
    serviceAnchors: [],
  };

  const mockEvaluation: DesignEvaluation = {
    version: 0,
    committedCents: 45000,
    budgetCents: 1500000,
    overBudget: false,
    remainingCents: 1455000,
    findings: [],
  };

  const mockCatalogResponse: CatalogResponse = {
    contractVersion: '2.0.0',
    products: [mockProduct],
    guidelineSource: 'NKBA Guidelines',
  };

  beforeEach(() => {
    // Reset window.sessionStorage mocks if available
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }

    let currentRoomState: RoomState = { ...mockRoomState };

    mockClient = {
      baseUrl: 'http://test-server',
      healthz: vi.fn(),
      getCatalog: vi.fn().mockResolvedValue(mockCatalogResponse),
      createSession: vi.fn().mockResolvedValue({
        sessionId: 'test-session-123',
        capability: 'cap-secret-abc',
        contractVersion: '2.0.0',
      }),
      getState: vi.fn().mockImplementation(async () => ({
        state: currentRoomState,
        evaluation: { ...mockEvaluation, version: currentRoomState.version },
      })),
      propose: vi.fn().mockImplementation(async (_sid, _cap, body) => {
        const prop: Proposal = {
          id: 'prop-1',
          sessionId: 'test-session-123',
          baseVersion: body.expectedVersion,
          hash: 'hash-abc',
          status: 'pending_human',
          operations: body.operations,
          rationale: body.rationale,
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        };
        return {
          proposal: prop,
          state: currentRoomState, // Unmutated room state!
        };
      }),
      decide: vi.fn().mockImplementation(async (_sid, _cap, body) => {
        return {
          proposal: {
            id: body.proposalId,
            sessionId: 'test-session-123',
            baseVersion: 0,
            hash: body.proposalHash,
            status: body.decision === 'approved' ? 'approved' : 'rejected',
            operations: [],
            rationale: 'Approved',
            createdAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
          },
        };
      }),
      apply: vi.fn().mockImplementation(async (_sid, _cap, body) => {
        currentRoomState = {
          ...currentRoomState,
          version: body.expectedVersion + 1,
        };
        return {
          proposal: {
            id: body.proposalId,
            sessionId: 'test-session-123',
            baseVersion: body.expectedVersion,
            hash: body.proposalHash,
            status: 'applied',
            operations: [],
            rationale: 'Applied',
            createdAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
          },
          state: currentRoomState,
        };
      }),
      edit: vi.fn().mockImplementation(async (_sid, _cap, body) => {
        currentRoomState = {
          ...currentRoomState,
          items: [
            {
              id: 'item-1',
              productId: 'sink-base-36',
              x: 60,
              y: 80,
              rotation: 180,
            },
          ],
        };
        return { state: currentRoomState };
      }),
      requestConfirmation: vi.fn().mockResolvedValue({
        confirmation: {
          id: 'conf-1',
          sessionId: 'test-session-123',
          action: 'book_consultation',
          payloadHash: 'hash-1',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        proof: 'proof-token-1',
      }),
      executeProtectedAction: vi.fn().mockResolvedValue({
        action: 'book_consultation',
        reference: 'SYN-00112233',
        performedAt: new Date().toISOString(),
      }),
      getReceipt: vi.fn(),
      getBillOfMaterials: vi.fn(),
    } as unknown as HandshakeApiClient;
  });

  it('initializes with default state values', () => {
    const store = createStudioStore(mockClient);
    const state = store.getState();

    expect(state.sessionId).toBeNull();
    expect(state.capability).toBeNull();
    expect(state.roomState).toBeNull();
    expect(state.evaluation).toBeNull();
    expect(state.catalog).toEqual([]);
    expect(state.activeProposal).toBeNull();
    expect(state.viewportMode).toBe('2d');
    expect(state.cameraMode).toBe('orbit');
    expect(state.selectedItemId).toBeNull();
    expect(state.hoveredItemId).toBeNull();
    expect(state.zoom).toBe(1);
    expect(state.pan).toEqual({ x: 0, y: 0 });
    expect(state.gridSnap).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.isSyncing).toBe(false);
    expect(state.error).toBeNull();
  });

  it('creates session and fetches catalog and state on initSession', async () => {
    const store = createStudioStore(mockClient);

    await store.getState().initSession('kitchen', 1500000);

    const state = store.getState();
    expect(mockClient.createSession).toHaveBeenCalledWith({
      roomType: 'kitchen',
      budgetCents: 1500000,
    });
    expect(mockClient.getState).toHaveBeenCalledWith('test-session-123', 'cap-secret-abc');
    expect(mockClient.getCatalog).toHaveBeenCalledWith('kitchen');

    expect(state.sessionId).toBe('test-session-123');
    expect(state.capability).toBe('cap-secret-abc');
    expect(state.roomState).toEqual(mockRoomState);
    expect(state.evaluation).toEqual(mockEvaluation);
    expect(state.catalog).toEqual([mockProduct]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  describe('proposal lifecycle and non-mutating preview invariant', () => {
    it('sets activeProposal preview overlay WITHOUT mutating committed room state', async () => {
      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen');

      expect(store.getState().roomState?.version).toBe(0);

      // Submit proposal
      const proposal = await store.getState().propose(
        [
          {
            type: 'place',
            productId: 'sink-base-36',
            x: 24,
            y: 24,
            rotation: 0,
          },
        ],
        'Add secondary prep sink',
      );

      expect(proposal?.id).toBe('prop-1');
      const state = store.getState();

      // Invariant: activeProposal is set
      expect(state.activeProposal?.id).toBe('prop-1');
      expect(state.activeProposal?.status).toBe('pending_human');

      // Crucial Invariant: committed roomState remains version 0 and unmutated!
      expect(state.roomState?.version).toBe(0);
      expect(state.roomState?.items).toHaveLength(1);
    });

    it('approves proposal through decide without mutating committed room state', async () => {
      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen');
      await store.getState().propose([], 'Test');

      const decided = await store.getState().decide('prop-1', 'hash-abc', 'approved');

      expect(decided?.status).toBe('approved');
      const state = store.getState();
      expect(state.activeProposal?.status).toBe('approved');

      // Still version 0 before apply!
      expect(state.roomState?.version).toBe(0);
    });

    it('advances committed room version only upon apply', async () => {
      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen');
      await store.getState().propose([], 'Test');
      await store.getState().decide('prop-1', 'hash-abc', 'approved');

      await store.getState().apply('prop-1', 'hash-abc', 0);

      const state = store.getState();
      expect(mockClient.apply).toHaveBeenCalledWith(
        'test-session-123',
        'cap-secret-abc',
        expect.objectContaining({
          proposalId: 'prop-1',
          proposalHash: 'hash-abc',
          expectedVersion: 0,
        }),
      );

      // Now version has advanced!
      expect(state.roomState?.version).toBe(1);
      expect(state.activeProposal?.status).toBe('applied');
    });
  });

  describe('direct manual human editing (moveItem)', () => {
    it('calls edit with normalized rotation and updates state', async () => {
      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen');

      await store.getState().moveItem('item-1', 60, 80, 180);

      expect(mockClient.edit).toHaveBeenCalledWith(
        'test-session-123',
        'cap-secret-abc',
        expect.objectContaining({
          expectedVersion: 0,
          operations: [
            {
              type: 'move',
              itemId: 'item-1',
              x: 60,
              y: 80,
              rotation: 180,
            },
          ],
        }),
      );

      const state = store.getState();
      expect(state.roomState?.items[0]?.x).toBe(60);
      expect(state.roomState?.items[0]?.y).toBe(80);
      expect(state.roomState?.items[0]?.rotation).toBe(180);
    });
  });

  describe('protected action workflow', () => {
    it('requests confirmation and executes protected action with proof token', async () => {
      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen');

      const confRes = await store.getState().requestConfirmation('book_consultation', {
        designer: 'Sarah',
      });
      expect(confRes?.confirmation.id).toBe('conf-1');
      expect(confRes?.proof).toBe('proof-token-1');

      const actionRes = await store
        .getState()
        .executeProtectedAction('book_consultation', { designer: 'Sarah' }, confRes!.proof);
      expect(actionRes?.action).toBe('book_consultation');
      expect(actionRes?.reference).toBe('SYN-00112233');
    });
  });

  describe('viewport and selection actions', () => {
    it('updates selection, hover, viewport, camera, zoom, pan, and gridSnap', () => {
      const store = createStudioStore(mockClient);

      store.getState().selectItem('item-101');
      expect(store.getState().selectedItemId).toBe('item-101');

      store.getState().setHoveredItem('item-102');
      expect(store.getState().hoveredItemId).toBe('item-102');

      store.getState().setViewportMode('3d');
      expect(store.getState().viewportMode).toBe('3d');

      store.getState().setCameraMode('first-person');
      expect(store.getState().cameraMode).toBe('first-person');

      store.getState().setZoom(1.75);
      expect(store.getState().zoom).toBe(1.75);

      store.getState().setPan({ x: 45, y: -20 });
      expect(store.getState().pan).toEqual({ x: 45, y: -20 });

      store.getState().setGridSnap(false);
      expect(store.getState().gridSnap).toBe(false);
    });
  });

  describe('resetSession', () => {
    it('resets all state to initial defaults and clears storage', async () => {
      const store = createStudioStore(mockClient);
      await store.getState().initSession('kitchen');
      store.getState().selectItem('item-1');
      store.getState().setViewportMode('3d');

      expect(store.getState().sessionId).toBe('test-session-123');

      store.getState().resetSession();

      const state = store.getState();
      expect(state.sessionId).toBeNull();
      expect(state.capability).toBeNull();
      expect(state.roomState).toBeNull();
      expect(state.evaluation).toBeNull();
      expect(state.catalog).toEqual([]);
      expect(state.activeProposal).toBeNull();
      expect(state.selectedItemId).toBeNull();
      expect(state.viewportMode).toBe('2d');
    });
  });

  describe('hydration and storage persistence', () => {
    it('restores session when valid credentials exist in sessionStorage', async () => {
      // Mock window.sessionStorage
      const storage: Record<string, string> = {
        handshake_session_id: 'restored-sess-456',
        handshake_capability: 'restored-cap-xyz',
      };
      vi.stubGlobal('window', {
        sessionStorage: {
          getItem: (key: string) => storage[key] ?? null,
          setItem: (key: string, val: string) => {
            storage[key] = val;
          },
          removeItem: (key: string) => {
            delete storage[key];
          },
          clear: () => {
            for (const k in storage) delete storage[k];
          },
        },
      });

      const store = createStudioStore(mockClient);
      await store.getState().hydrate();

      const state = store.getState();
      expect(state.sessionId).toBe('restored-sess-456');
      expect(state.capability).toBe('restored-cap-xyz');
      expect(mockClient.getState).toHaveBeenCalledWith('restored-sess-456', 'restored-cap-xyz');
      expect(state.roomState).toBeDefined();

      vi.unstubAllGlobals();
    });

    it('clears storage and sets error when stored session restoration fails', async () => {
      const storage: Record<string, string> = {
        handshake_session_id: 'expired-sess',
        handshake_capability: 'expired-cap',
      };
      vi.stubGlobal('window', {
        sessionStorage: {
          getItem: (key: string) => storage[key] ?? null,
          setItem: (key: string, val: string) => {
            storage[key] = val;
          },
          removeItem: (key: string) => {
            delete storage[key];
          },
          clear: () => {
            for (const k in storage) delete storage[k];
          },
        },
      });

      const failingClient = {
        ...mockClient,
        getState: vi.fn().mockRejectedValue(new Error('Session not found')),
      } as unknown as HandshakeApiClient;

      const store = createStudioStore(failingClient);
      await store.getState().hydrate();

      const state = store.getState();
      expect(state.sessionId).toBeNull();
      expect(state.capability).toBeNull();
      expect(state.error).toBe('Session not found');
      expect(storage['handshake_session_id']).toBeUndefined();

      vi.unstubAllGlobals();
    });
  });
});
