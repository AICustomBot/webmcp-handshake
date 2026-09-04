/**
 * WebMCP Tool Definitions and Model Context Bridge.
 *
 * Implements the 9 contracted tools for Handshake according to:
 * - docs/WEBMCP-TOOL-CONTRACTS.md
 * - docs/TOOL-CONTRACTS.md
 * - packages/contracts
 * - AGENTS.md Constitution (Zero state mutation by proposals, page-owned consent)
 */

import {
  CONTRACT_VERSION,
  LIMITS,
  CATEGORY_ROOM_TYPES,
  type ErrorCode,
  type Operation,
  type Product,
  type Proposal,
  type ProtectedAction,
  type RoomState,
} from '@handshake/contracts';

import { defaultApiClient, type HandshakeApiClient } from '../api-client';
import { useStudioStore } from '../store/studio-store';
import { SYNTHETIC_CATALOG } from './catalog';

export { SYNTHETIC_CATALOG };

export const WEBMCP_TOOL_NAMES = [
  'get_room_state',
  'search_catalog',
  'evaluate_design',
  'propose_changes',
  'get_proposal',
  'apply_approved_proposal',
  'request_protected_action',
  'get_receipt',
  'get_bill_of_materials',
] as const;

export type WebMCPToolName = (typeof WEBMCP_TOOL_NAMES)[number];

export interface ToolResult<T = any> {
  ok: boolean;
  requestId: string;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
  };
}

export interface WebMCPTool {
  name: WebMCPToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<ToolResult<any>>;
}

// In-memory proposal and confirmation caches for the active page session
export const webmcpProposalCache = new Map<string, Proposal>();
export const webmcpConfirmationGrants = new Map<
  string,
  { confirmationId: string; proof: string }
>();

function makeRequestId(): string {
  return `req_${Math.random().toString(36).slice(2, 11)}`;
}

function success<T>(data: T): ToolResult<T> {
  return { ok: true, requestId: makeRequestId(), data };
}

function failure(code: ErrorCode, message: string, retryable = false): ToolResult {
  return {
    ok: false,
    requestId: makeRequestId(),
    error: { code, message, retryable },
  };
}

function confirmationKey(input: { action: string; payload: Record<string, string> }): string {
  const sortedPayload = Object.keys(input.payload || {})
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      const val = input.payload[k];
      if (val !== undefined) {
        acc[k] = val;
      }
      return acc;
    }, {});
  return `${input.action}:${JSON.stringify(sortedPayload)}`;
}

const sessionSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string', description: 'The active Handshake session identifier' },
  },
  required: ['sessionId'],
  additionalProperties: false,
};

/**
 * Creates the 9 WebMCP tools bound to an optional API client and/or Zustand store.
 */
export function createWebMCPTools(client: HandshakeApiClient = defaultApiClient): WebMCPTool[] {
  return [
    {
      name: 'get_room_state',
      description:
        'Read committed room state, including dimensions, monotonic version, placed items, openings, and utility service anchors.',
      inputSchema: sessionSchema,
      execute: async (input: { sessionId: string }) => {
        if (!input?.sessionId) {
          return failure('INVALID_INPUT', 'Missing required parameter: sessionId');
        }
        // Try reading live store state first if matching active session
        const store = useStudioStore.getState();
        if (store.sessionId === input.sessionId && store.roomState) {
          return success({
            state: store.roomState,
            evaluation: store.evaluation,
            contractVersion: CONTRACT_VERSION,
          });
        }
        try {
          const cap = store.capability || '';
          const res = await client.getState(input.sessionId, cap);
          return success({
            state: res.state,
            evaluation: res.evaluation,
            contractVersion: CONTRACT_VERSION,
          });
        } catch (err: any) {
          return failure(err.code || 'SESSION_NOT_FOUND', err.message || 'Session not found');
        }
      },
    },
    {
      name: 'search_catalog',
      description:
        'Search the synthetic kitchen and bath catalog for items matching room type, category, or dimension constraints.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Active session ID' },
          query: { type: 'string', description: 'Search term matching name or finish' },
          category: { type: 'string', description: 'Product category filter' },
          maxPriceCents: { type: 'integer', description: 'Maximum price ceiling in cents' },
          accessibleOnly: { type: 'boolean', description: 'Filter for ADA accessible fixtures' },
          roomType: {
            type: 'string',
            enum: ['kitchen', 'bathroom'],
            description: 'Filter fixtures designed for this room type',
          },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      execute: async (input: {
        sessionId: string;
        query?: string;
        category?: string;
        maxPriceCents?: number;
        accessibleOnly?: boolean;
        roomType?: 'kitchen' | 'bathroom';
      }) => {
        if (!input?.sessionId) {
          return failure('INVALID_INPUT', 'Missing required parameter: sessionId');
        }
        const q = (input.query || '').toLowerCase().trim();
        const products = SYNTHETIC_CATALOG.filter((item: Product) => {
          const matchesQuery =
            !q || `${item.name} ${item.finish} ${item.id}`.toLowerCase().includes(q);
          const matchesCategory = !input.category || item.category === input.category;
          const matchesPrice =
            input.maxPriceCents === undefined || item.priceCents <= input.maxPriceCents;
          const matchesAccess = !input.accessibleOnly || item.accessible === true;
          const allowedRooms = CATEGORY_ROOM_TYPES[item.category] as readonly string[] | undefined;
          const matchesRoom =
            !input.roomType || Boolean(allowedRooms && allowedRooms.includes(input.roomType));
          return matchesQuery && matchesCategory && matchesPrice && matchesAccess && matchesRoom;
        });
        return success({ products });
      },
    },
    {
      name: 'evaluate_design',
      description: 'Return deterministic budget and NKBA layout findings for committed state.',
      inputSchema: sessionSchema,
      execute: async (input: { sessionId: string }) => {
        if (!input?.sessionId) {
          return failure('INVALID_INPUT', 'Missing required parameter: sessionId');
        }
        const store = useStudioStore.getState();
        let state: RoomState | null = store.sessionId === input.sessionId ? store.roomState : null;
        if (!state) {
          try {
            const cap = store.capability || '';
            const res = await client.getState(input.sessionId, cap);
            state = res.state;
          } catch (err: any) {
            return failure(err.code || 'SESSION_NOT_FOUND', err.message || 'Session not found');
          }
        }
        if (store.sessionId === input.sessionId && store.evaluation) {
          return success({ evaluation: store.evaluation });
        }
        try {
          const cap = store.capability || '';
          const res = await client.getState(input.sessionId, cap);
          return success({ evaluation: res.evaluation });
        } catch (err: any) {
          return failure(err.code || 'SESSION_NOT_FOUND', err.message || 'Session not found');
        }
      },
    },
    {
      name: 'propose_changes',
      description:
        'Create a non-mutating proposal for human review. Never mutates committed room state directly.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Active session ID' },
          expectedVersion: {
            type: 'integer',
            description: 'The monotonic room version this proposal is built against',
          },
          operations: {
            type: 'array',
            maxItems: LIMITS.maxOperationsPerProposal,
            items: { type: 'object' },
            description: 'Array of place, move, or remove operations (max 12)',
          },
          rationale: {
            type: 'string',
            description: 'Clear architectural explanation of why this design change is proposed',
          },
          idempotencyKey: {
            type: 'string',
            description: 'Unique client-generated idempotency key',
          },
        },
        required: ['sessionId', 'expectedVersion', 'operations', 'rationale', 'idempotencyKey'],
        additionalProperties: false,
      },
      execute: async (input: {
        sessionId: string;
        expectedVersion: number;
        operations: Operation[];
        rationale: string;
        idempotencyKey: string;
      }) => {
        if (
          !input?.sessionId ||
          input.expectedVersion === undefined ||
          !Array.isArray(input.operations) ||
          !input.rationale ||
          !input.idempotencyKey
        ) {
          return failure('INVALID_INPUT', 'Missing required parameters for proposal');
        }
        if (input.operations.length > LIMITS.maxOperationsPerProposal) {
          return failure(
            'LIMIT_EXCEEDED',
            `Operations exceed maximum limit of ${LIMITS.maxOperationsPerProposal}`,
          );
        }

        const store = useStudioStore.getState();
        const cap = store.capability || '';

        try {
          // Send to consensus backend via API client
          const res = await client.propose(input.sessionId, cap, {
            expectedVersion: input.expectedVersion,
            operations: input.operations,
            rationale: input.rationale,
            idempotencyKey: input.idempotencyKey,
          });

          // Cache locally
          webmcpProposalCache.set(res.proposal.id, res.proposal);

          // Update studio store: activates amber ghost preview on both 2D and 3D canvases
          // Committed roomState version remains unmutated!
          store.setActiveProposal(res.proposal);

          return success({ proposal: res.proposal });
        } catch (err: any) {
          return failure(err.code || 'INVALID_INPUT', err.message || 'Failed to submit proposal');
        }
      },
    },
    {
      name: 'get_proposal',
      description: 'Read a proposal created in this page session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Active session ID' },
          proposalId: { type: 'string', description: 'Proposal unique ID' },
        },
        required: ['sessionId', 'proposalId'],
        additionalProperties: false,
      },
      execute: async (input: { sessionId: string; proposalId: string }) => {
        if (!input?.sessionId || !input?.proposalId) {
          return failure('INVALID_INPUT', 'Missing required parameter: sessionId or proposalId');
        }
        const cached = webmcpProposalCache.get(input.proposalId);
        if (cached) {
          return success({ proposal: cached });
        }
        const store = useStudioStore.getState();
        if (store.activeProposal && store.activeProposal.id === input.proposalId) {
          return success({ proposal: store.activeProposal });
        }
        return failure('PROPOSAL_NOT_FOUND', 'Proposal is not available in this page session.');
      },
    },
    {
      name: 'apply_approved_proposal',
      description:
        'Apply one exact proposal only after the page-owned human approval route approved it.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Active session ID' },
          proposalId: { type: 'string', description: 'Approved proposal ID' },
          proposalHash: { type: 'string', description: 'SHA-256 hash of the proposal' },
          expectedVersion: {
            type: 'integer',
            description: 'Monotonic room version expected prior to apply',
          },
          idempotencyKey: { type: 'string', description: 'Unique idempotency key' },
        },
        required: ['sessionId', 'proposalId', 'proposalHash', 'expectedVersion', 'idempotencyKey'],
        additionalProperties: false,
      },
      execute: async (input: {
        sessionId: string;
        proposalId: string;
        proposalHash: string;
        expectedVersion: number;
        idempotencyKey: string;
      }) => {
        if (
          !input?.sessionId ||
          !input?.proposalId ||
          !input?.proposalHash ||
          input.expectedVersion === undefined ||
          !input?.idempotencyKey
        ) {
          return failure('INVALID_INPUT', 'Missing required parameters for apply');
        }
        const cached = webmcpProposalCache.get(input.proposalId);
        const store = useStudioStore.getState();

        // Consent check: Must be approved by human in the page UI
        const proposalStatus =
          cached?.status ||
          (store.activeProposal?.id === input.proposalId ? store.activeProposal.status : null);

        if (proposalStatus !== 'approved') {
          return failure(
            'PROPOSAL_NOT_APPROVED',
            'Proposal has not been approved by a human through page-owned UI.',
          );
        }

        try {
          const cap = store.capability || '';
          const res = await client.apply(input.sessionId, cap, {
            proposalId: input.proposalId,
            proposalHash: input.proposalHash,
            expectedVersion: input.expectedVersion,
            idempotencyKey: input.idempotencyKey,
          });

          // Refresh store with newly committed room state and clear active proposal preview
          await store.refreshState();
          store.setActiveProposal(null);

          return success({ state: res.state });
        } catch (err: any) {
          return failure(err.code || 'VERSION_CONFLICT', err.message || 'Failed to apply proposal');
        }
      },
    },
    {
      name: 'request_protected_action',
      description:
        'Request a protected synthetic action (book_consultation or request_quote). Confirmation remains page-owned.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Active session ID' },
          action: {
            type: 'string',
            enum: ['book_consultation', 'request_quote'],
            description: 'Protected action type',
          },
          payload: {
            type: 'object',
            description: 'Key-value parameters for the action',
            additionalProperties: { type: 'string' },
          },
          idempotencyKey: { type: 'string', description: 'Unique idempotency key' },
        },
        required: ['sessionId', 'action', 'payload', 'idempotencyKey'],
        additionalProperties: false,
      },
      execute: async (input: {
        sessionId: string;
        action: ProtectedAction;
        payload: Record<string, string>;
        idempotencyKey: string;
      }) => {
        if (!input?.sessionId || !input?.action || !input?.payload || !input?.idempotencyKey) {
          return failure('INVALID_INPUT', 'Missing required parameters for protected action');
        }

        const key = confirmationKey(input);
        const grant = webmcpConfirmationGrants.get(key);
        const store = useStudioStore.getState();

        if (grant) {
          // Valid proof token is available: execute the action
          try {
            const cap = store.capability || '';
            const res = await client.executeProtectedAction(input.sessionId, cap, {
              action: input.action,
              payload: input.payload,
              proof: grant.proof,
              confirmationId: grant.confirmationId,
              idempotencyKey: input.idempotencyKey,
            });
            webmcpConfirmationGrants.delete(key);
            return success({ response: res });
          } catch (err: any) {
            webmcpConfirmationGrants.delete(key);
            return failure(
              err.code || 'CONFIRMATION_EXPIRED',
              err.message || 'Protected action execution failed',
            );
          }
        }

        // Confirmation required: Trigger page-owned human confirmation gate
        webmcpConfirmationGrants.delete(key);
        store.setConfirmationRequest({
          key,
          action: input.action,
          payload: input.payload,
        });

        const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
        if (win && typeof win.dispatchEvent === 'function') {
          try {
            win.dispatchEvent(
              new CustomEvent('handshake:confirmation-requested', {
                detail: { key, action: input.action, payload: input.payload },
              }),
            );
          } catch {
            win.dispatchEvent({
              type: 'handshake:confirmation-requested',
              detail: { key, action: input.action, payload: input.payload },
            });
          }
        }

        return failure(
          'CONFIRMATION_REQUIRED',
          'Page-owned human confirmation required before executing this protected action.',
        );
      },
    },
    {
      name: 'get_receipt',
      description: 'Read the exportable, tamper-evident decision receipt when available.',
      inputSchema: sessionSchema,
      execute: async (input: { sessionId: string }) => {
        if (!input?.sessionId) {
          return failure('INVALID_INPUT', 'Missing required parameter: sessionId');
        }
        const store = useStudioStore.getState();
        try {
          const cap = store.capability || '';
          const res = await client.getReceipt(input.sessionId, cap);
          return success({ receipt: res.receipt });
        } catch (err: any) {
          return failure(
            err.code || 'SESSION_NOT_FOUND',
            err.message || 'Receipt could not be generated',
          );
        }
      },
    },
    {
      name: 'get_bill_of_materials',
      description: 'Read the itemized bill of materials and budget summary for committed state.',
      inputSchema: sessionSchema,
      execute: async (input: { sessionId: string }) => {
        if (!input?.sessionId) {
          return failure('INVALID_INPUT', 'Missing required parameter: sessionId');
        }
        const store = useStudioStore.getState();
        let state: RoomState | null = store.sessionId === input.sessionId ? store.roomState : null;

        if (!state) {
          try {
            const cap = store.capability || '';
            const res = await client.getState(input.sessionId, cap);
            state = res.state;
          } catch (err: any) {
            return failure(err.code || 'SESSION_NOT_FOUND', err.message || 'Session not found');
          }
        }

        if (!state) {
          return failure('SESSION_NOT_FOUND', 'Room state is not available');
        }

        // Try fetching official BOM from worker API first
        try {
          const cap = store.capability || '';
          const res = await client.getBillOfMaterials(input.sessionId, cap);
          if (res) {
            const bomData = (res as any).bom ?? res;
            return success({
              bom: bomData,
              remainingCents: (res as any).remainingCents ?? (bomData as any).remainingCents,
            });
          }
        } catch {}

        if (store.sessionId === input.sessionId && store.evaluation?.bom) {
          return success({ bom: store.evaluation.bom });
        }

        // Local fallback calculation based on placed items and catalog
        const lines: Array<{
          productId: string;
          name: string;
          quantity: number;
          unitPriceCents: number;
          totalCents: number;
        }> = [];
        const counts = new Map<string, number>();
        for (const item of state.items) {
          counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
        }
        let subtotalCents = 0;
        let itemCount = 0;
        for (const [productId, quantity] of counts.entries()) {
          const product = SYNTHETIC_CATALOG.find((p) => p.id === productId);
          if (!product) continue;
          const totalCents = product.priceCents * quantity;
          subtotalCents += totalCents;
          itemCount += quantity;
          lines.push({
            productId,
            name: product.name,
            quantity,
            unitPriceCents: product.priceCents,
            totalCents,
          });
        }
        const bom = {
          version: state.version,
          lines,
          itemCount,
          subtotalCents,
          budgetCents: state.budgetCents,
          remainingCents: state.budgetCents - subtotalCents,
          overBudget: subtotalCents > state.budgetCents,
          unpricedItemIds: [],
        };
        return success({ bom });
      },
    },
  ];
}

/**
 * Registers all 9 tools on `document.modelContext` if present in the browser runtime.
 * Returns an unregister cleanup function.
 */
export function registerModelContextTools(
  context?: any,
  tools: WebMCPTool[] = createWebMCPTools(),
): { registeredCount: number; unregister: () => void } {
  const target =
    context ?? (typeof document !== 'undefined' ? (document as any).modelContext : null);

  if (!target || typeof target.registerTool !== 'function') {
    return { registeredCount: 0, unregister: () => {} };
  }

  const registeredNames: string[] = [];

  for (const tool of tools) {
    try {
      target.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: tool.execute,
      });
      registeredNames.push(tool.name);
    } catch {
      // Ignore duplicates or unsupported signatures
    }
  }

  return {
    registeredCount: registeredNames.length,
    unregister: () => {
      if (typeof target.unregisterTool === 'function') {
        for (const name of registeredNames) {
          try {
            target.unregisterTool(name);
          } catch {}
        }
      }
    },
  };
}
