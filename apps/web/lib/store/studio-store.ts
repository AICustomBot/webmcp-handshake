import { create } from 'zustand';
import type {
  Confirmation,
  DesignEvaluation,
  Operation,
  Product,
  Proposal,
  ProtectedAction,
  ProtectedActionResponse,
  RoomItem,
  RoomState,
  RoomType,
  Rotation,
} from '@handshake/contracts';
import { defaultApiClient, HandshakeApiClient, type ConfirmationResponse } from '../api-client';

const SESSION_ID_STORAGE_KEY = 'handshake_session_id';
const CAPABILITY_STORAGE_KEY = 'handshake_capability';

export function getStoredCredentials(): {
  sessionId: string | null;
  capability: string | null;
} {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return { sessionId: null, capability: null };
  }
  try {
    const sessionId = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
    const capability = window.sessionStorage.getItem(CAPABILITY_STORAGE_KEY);
    return { sessionId, capability };
  } catch {
    return { sessionId: null, capability: null };
  }
}

export function persistCredentials(sessionId: string | null, capability: string | null): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    if (sessionId && capability) {
      window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
      window.sessionStorage.setItem(CAPABILITY_STORAGE_KEY, capability);
    } else {
      window.sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);
      window.sessionStorage.removeItem(CAPABILITY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage exceptions (quota, incognito restriction)
  }
}

export type WebGLStatus = 'checking' | 'ready' | 'unsupported' | 'context_lost';

export interface StudioState {
  sessionId: string | null;
  capability: string | null;
  roomState: RoomState | null;
  evaluation: DesignEvaluation | null;
  catalog: Product[];
  activeProposal: Proposal | null;
  viewportMode: '2d' | '3d';
  cameraMode: 'orbit' | 'first-person' | 'orthographic';
  webglStatus: WebGLStatus;
  webglError: string | null;
  isCopilotOpen: boolean;
  confirmationRequest: {
    key: string;
    action: ProtectedAction;
    payload: Record<string, string>;
  } | null;
  selectedItemId: string | null;
  hoveredItemId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  gridSnap: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
}

export interface StudioActions {
  initSession: (roomType?: RoomType, budgetCents?: number) => Promise<void>;
  fetchCatalog: (roomType?: RoomType) => Promise<void>;
  refreshState: () => Promise<void>;
  propose: (operations: Operation[], rationale: string) => Promise<Proposal | null>;
  decide: (
    proposalId: string,
    proposalHash: string,
    decision: 'approved' | 'rejected',
  ) => Promise<Proposal | null>;
  apply: (proposalId: string, proposalHash: string, expectedVersion: number) => Promise<void>;
  setActiveProposal: (proposal: Proposal | null) => void;
  setCopilotOpen: (open: boolean) => void;
  setConfirmationRequest: (
    req: {
      key: string;
      action: ProtectedAction;
      payload: Record<string, string>;
    } | null,
  ) => void;
  moveItem: (itemId: string, x: number, y: number, rotationDeg?: number) => Promise<void>;
  requestConfirmation: (
    action: ProtectedAction,
    payload: Record<string, string>,
  ) => Promise<ConfirmationResponse | null>;
  executeProtectedAction: (
    action: ProtectedAction,
    payload: Record<string, string>,
    proof: string,
    confirmationId?: string,
  ) => Promise<ProtectedActionResponse | null>;
  resetSession: () => void;
  setViewportMode: (mode: '2d' | '3d') => void;
  setCameraMode: (mode: 'orbit' | 'first-person' | 'orthographic') => void;
  setWebGLStatus: (status: WebGLStatus, error?: string) => void;
  selectItem: (itemId: string | null) => void;
  setHoveredItem: (itemId: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setGridSnap: (enabled: boolean) => void;
  hydrate: () => Promise<void>;
}

export type StudioStore = StudioState & StudioActions;

export const createStudioStore = (client: HandshakeApiClient = defaultApiClient) =>
  create<StudioStore>((set, get) => ({
    // Initial State
    sessionId: null,
    capability: null,
    roomState: null,
    evaluation: null,
    catalog: [],
    activeProposal: null,
    viewportMode: '2d',
    cameraMode: 'orbit',
    webglStatus: 'ready',
    webglError: null,
    isCopilotOpen: false,
    confirmationRequest: null,
    selectedItemId: null,
    hoveredItemId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    gridSnap: true,
    isLoading: false,
    isSyncing: false,
    error: null,

    // Actions
    initSession: async (roomType?: RoomType, budgetCents?: number) => {
      set({ isLoading: true, error: null });
      try {
        const sessionOpts: { roomType?: RoomType; budgetCents?: number } = {};
        if (roomType !== undefined) sessionOpts.roomType = roomType;
        if (budgetCents !== undefined) sessionOpts.budgetCents = budgetCents;
        const { sessionId, capability } = await client.createSession(sessionOpts);
        persistCredentials(sessionId, capability);

        const [stateRes, catalogRes] = await Promise.all([
          client.getState(sessionId, capability),
          client.getCatalog(roomType),
        ]);

        set({
          sessionId,
          capability,
          roomState: stateRes.state,
          evaluation: stateRes.evaluation,
          catalog: catalogRes.products,
          activeProposal: null,
          selectedItemId: null,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to initialize session',
        });
      }
    },

    fetchCatalog: async (roomType?: RoomType) => {
      try {
        const res = await client.getCatalog(roomType);
        set({ catalog: res.products });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to fetch catalog',
        });
      }
    },

    refreshState: async () => {
      const { sessionId, capability } = get();
      if (!sessionId || !capability) return;
      set({ isSyncing: true });
      try {
        const res = await client.getState(sessionId, capability);
        set({
          roomState: res.state,
          evaluation: res.evaluation,
          isSyncing: false,
          error: null,
        });
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to refresh state',
        });
      }
    },

    propose: async (operations: Operation[], rationale: string) => {
      const { sessionId, capability, roomState } = get();
      if (!sessionId || !capability || !roomState) {
        set({ error: 'No active session' });
        return null;
      }
      set({ isSyncing: true, error: null });
      try {
        const idempotencyKey = crypto.randomUUID();
        const res = await client.propose(sessionId, capability, {
          expectedVersion: roomState.version,
          operations,
          rationale,
          idempotencyKey,
        });
        // Non-mutating proposal preview: sets activeProposal overlay, committed roomState unmutated
        set({
          activeProposal: res.proposal,
          roomState: res.state,
          isSyncing: false,
        });
        return res.proposal;
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to submit proposal',
        });
        return null;
      }
    },

    decide: async (proposalId: string, proposalHash: string, decision: 'approved' | 'rejected') => {
      const { sessionId, capability, activeProposal } = get();
      if (!sessionId || !capability) {
        set({ error: 'No active session' });
        return null;
      }
      set({ isSyncing: true, error: null });
      try {
        const res = await client.decide(sessionId, capability, {
          proposalId,
          proposalHash,
          decision,
        });
        if (activeProposal && activeProposal.id === proposalId) {
          set({ activeProposal: res.proposal });
        }
        set({ isSyncing: false });
        return res.proposal;
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to decide proposal',
        });
        return null;
      }
    },

    apply: async (proposalId: string, proposalHash: string, expectedVersion: number) => {
      const { sessionId, capability } = get();
      if (!sessionId || !capability) {
        set({ error: 'No active session' });
        return;
      }
      set({ isSyncing: true, error: null });
      try {
        const idempotencyKey = crypto.randomUUID();
        const res = await client.apply(sessionId, capability, {
          proposalId,
          proposalHash,
          expectedVersion,
          idempotencyKey,
        });
        set({
          roomState: res.state,
          activeProposal: res.proposal,
        });
        // Sync design evaluation for newly applied version
        const stateRes = await client.getState(sessionId, capability);
        set({
          roomState: stateRes.state,
          evaluation: stateRes.evaluation,
          isSyncing: false,
        });
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to apply proposal',
        });
      }
    },

    moveItem: async (itemId: string, x: number, y: number, rotationDeg?: number) => {
      const { sessionId, capability, roomState } = get();
      if (!sessionId || !capability || !roomState) {
        set({ error: 'No active session' });
        return;
      }
      const item = roomState.items.find((i: RoomItem) => i.id === itemId);
      let rotation: Rotation = item?.rotation ?? 0;
      if (rotationDeg !== undefined) {
        const normalized = (((Math.round(rotationDeg / 90) * 90) % 360) + 360) % 360;
        if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
          rotation = normalized;
        }
      }

      set({ isSyncing: true, error: null });
      try {
        const editRes = await client.edit(sessionId, capability, {
          expectedVersion: roomState.version,
          operations: [
            {
              type: 'move',
              itemId,
              x,
              y,
              rotation,
            },
          ],
        });
        set({ roomState: editRes.state });

        // Update evaluation after human manual edit
        const stateRes = await client.getState(sessionId, capability);
        set({
          roomState: stateRes.state,
          evaluation: stateRes.evaluation,
          isSyncing: false,
        });
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to move item',
        });
      }
    },

    requestConfirmation: async (action: ProtectedAction, payload: Record<string, string>) => {
      const { sessionId, capability } = get();
      if (!sessionId || !capability) {
        set({ error: 'No active session' });
        return null;
      }
      set({ isSyncing: true, error: null });
      try {
        const res = await client.requestConfirmation(sessionId, capability, {
          action,
          payload,
        });
        set({ isSyncing: false });
        return res;
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to request confirmation',
        });
        return null;
      }
    },

    executeProtectedAction: async (
      action: ProtectedAction,
      payload: Record<string, string>,
      proof: string,
      confirmationId?: string,
    ) => {
      const { sessionId, capability } = get();
      if (!sessionId || !capability) {
        set({ error: 'No active session' });
        return null;
      }
      set({ isSyncing: true, error: null });
      try {
        const idempotencyKey = crypto.randomUUID();
        const res = await client.executeProtectedAction(sessionId, capability, {
          action,
          payload,
          proof,
          confirmationId,
          idempotencyKey,
        });
        set({ isSyncing: false });
        return res;
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to execute protected action',
        });
        return null;
      }
    },

    resetSession: () => {
      persistCredentials(null, null);
      set({
        sessionId: null,
        capability: null,
        roomState: null,
        evaluation: null,
        catalog: [],
        activeProposal: null,
        viewportMode: '2d',
        cameraMode: 'orbit',
        webglStatus: 'ready',
        webglError: null,
        isCopilotOpen: false,
        confirmationRequest: null,
        selectedItemId: null,
        hoveredItemId: null,
        zoom: 1,
        pan: { x: 0, y: 0 },
        gridSnap: true,
        isLoading: false,
        isSyncing: false,
        error: null,
      });
    },

    setActiveProposal: (activeProposal: Proposal | null) => set({ activeProposal }),
    setCopilotOpen: (isCopilotOpen: boolean) => set({ isCopilotOpen }),
    setConfirmationRequest: (
      confirmationRequest: {
        key: string;
        action: ProtectedAction;
        payload: Record<string, string>;
      } | null,
    ) => set({ confirmationRequest }),

    setViewportMode: (viewportMode: '2d' | '3d') => set({ viewportMode }),
    setCameraMode: (cameraMode: 'orbit' | 'first-person' | 'orthographic') => set({ cameraMode }),
    setWebGLStatus: (webglStatus: WebGLStatus, webglError?: string) => {
      const updates: Partial<StudioState> = {
        webglStatus,
        webglError: webglError ?? null,
      };
      if (webglStatus === 'unsupported' || webglStatus === 'context_lost') {
        updates.viewportMode = '2d';
      }
      set(updates);
    },
    selectItem: (selectedItemId: string | null) => set({ selectedItemId }),
    setHoveredItem: (hoveredItemId: string | null) => set({ hoveredItemId }),
    setZoom: (zoom: number) => set({ zoom }),
    setPan: (pan: { x: number; y: number }) => set({ pan }),
    setGridSnap: (gridSnap: boolean) => set({ gridSnap }),

    hydrate: async () => {
      const { sessionId, capability } = getStoredCredentials();
      if (sessionId && capability && !get().sessionId) {
        set({ sessionId, capability, isLoading: true, error: null });
        try {
          const [stateRes, catalogRes] = await Promise.all([
            client.getState(sessionId, capability),
            client.getCatalog(),
          ]);
          set({
            roomState: stateRes.state,
            evaluation: stateRes.evaluation,
            catalog: catalogRes.products,
            isLoading: false,
          });
        } catch (err) {
          persistCredentials(null, null);
          set({
            sessionId: null,
            capability: null,
            roomState: null,
            evaluation: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to restore session',
          });
        }
      }
    },
  }));

export const useStudioStore = createStudioStore(defaultApiClient);
