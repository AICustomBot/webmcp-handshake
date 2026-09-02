/**
 * Frozen machine-readable contracts for Handshake.
 *
 * Authority order: docs/IMPLEMENTATION-DECISIONS.md, then this file, then the
 * deterministic policy engine, then documentation, then the UI. Runtime code
 * may never widen these types locally. Changing a shape or an error code
 * requires an ADR under docs/decisions.
 *
 * All data in this system is synthetic. No real customer, pricing or
 * regulatory data is represented here.
 */

export const CONTRACT_VERSION = '1.0.0';

/**
 * Hard bounds. Every limit is enforced on the server and fails closed. The
 * client may mirror them for a better message but never for authorization.
 */
export const LIMITS = {
  maxOperationsPerProposal: 12,
  maxBodyBytes: 32768,
  proposalTtlSeconds: 600,
  confirmationTtlSeconds: 300,
  sessionTtlSeconds: 86400,
  maxPendingProposals: 8,
  maxItemsPerRoom: 40,
  maxAuditEvents: 500,
  minRoomDimensionIn: 48,
  maxRoomDimensionIn: 480,
} as const;

/**
 * Stable, client-visible error codes. Never reword or repurpose a code once
 * it ships; add a new one instead. Agents branch on these strings.
 */
export const ERROR_CODES = [
  'INVALID_INPUT',
  'LIMIT_EXCEEDED',
  'SESSION_NOT_FOUND',
  'PROPOSAL_NOT_FOUND',
  'VERSION_CONFLICT',
  'PROPOSAL_EXPIRED',
  'PROPOSAL_NOT_APPROVED',
  'PROPOSAL_REJECTED',
  'PROPOSAL_SUPERSEDED',
  'PROPOSAL_INVALIDATED',
  'PROPOSAL_ALREADY_DECIDED',
  'PROPOSAL_ALREADY_APPLIED',
  'PROPOSAL_HASH_MISMATCH',
  'IDEMPOTENCY_CONFLICT',
  'CONFIRMATION_REQUIRED',
  'CONFIRMATION_EXPIRED',
  'FORBIDDEN_ACTOR',
  'POLICY_BLOCKED',
  'RATE_LIMITED',
  'NOT_IMPLEMENTED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Only transient conditions are retryable. A consent failure is never
 * retryable, because retrying is exactly the attack we are refusing.
 */
export const RETRYABLE_ERROR_CODES: readonly ErrorCode[] = ['RATE_LIMITED'];

/** Returns whether an unknown value is a stable Handshake error code. */
export function isErrorCode(value: unknown): value is ErrorCode {
  if (typeof value !== 'string') return false;
  return (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Who is asking. Authorization derives from the request channel alone, never
 * from model text, DOM content, query parameters or hidden form fields.
 */
export type ActorKind = 'human_ui' | 'agent' | 'system';

export interface Actor {
  kind: ActorKind;
  sessionId: string;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface RoomItem {
  id: string;
  productId: string;
  /** Inches from the left wall to the item origin. */
  x: number;
  /** Inches from the top wall to the item origin. */
  y: number;
  rotation: Rotation;
}

export interface RoomState {
  sessionId: string;
  /** Monotonic committed version. Every applied change increments it by one. */
  version: number;
  widthIn: number;
  lengthIn: number;
  budgetCents: number;
  items: RoomItem[];
}

export type ProductCategory = 'vanity' | 'shower' | 'tub' | 'toilet' | 'storage' | 'lighting';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  finish: string;
  priceCents: number;
  widthIn: number;
  depthIn: number;
  /**
   * Demonstration clearance in front of the fixture. This is a product-design
   * preference for the demo, not a building-code or accessibility requirement.
   */
  clearanceIn: number;
  accessible: boolean;
}

export interface PlaceOperation {
  type: 'place';
  productId: string;
  x: number;
  y: number;
  rotation: Rotation;
}

export interface MoveOperation {
  type: 'move';
  itemId: string;
  x: number;
  y: number;
  rotation: Rotation;
}

export interface SwapOperation {
  type: 'swap';
  itemId: string;
  replacementProductId: string;
}

export interface RemoveOperation {
  type: 'remove';
  itemId: string;
}

export type Operation = PlaceOperation | MoveOperation | SwapOperation | RemoveOperation;

export const PROPOSAL_STATUSES = [
  'pending_human',
  'approved',
  'rejected',
  'applied',
  'expired',
  'superseded',
  'invalidated',
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Statuses from which no further transition is possible. */
export const TERMINAL_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  'rejected',
  'applied',
  'expired',
  'superseded',
  'invalidated',
];

export interface Proposal {
  id: string;
  sessionId: string;
  /** Committed room version this proposal was computed against. */
  baseVersion: number;
  /** Canonical hash binding the proposal to its exact operation list. */
  hash: string;
  status: ProposalStatus;
  operations: Operation[];
  rationale: string;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  appliedAt?: string;
  appliedVersion?: number;
}

export type ProtectedAction = 'book_consultation' | 'request_quote';

export interface Confirmation {
  id: string;
  sessionId: string;
  action: ProtectedAction;
  /** Hash of the exact payload the human saw and confirmed. */
  payloadHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export type CheckSeverity = 'info' | 'warning' | 'blocked';

export const CHECK_FINDING_CODES = [
  'UNKNOWN_PRODUCT',
  'OUT_OF_BOUNDS',
  'FIXTURE_OVERLAP',
  'CLEARANCE_WARNING',
  'OVER_BUDGET',
] as const;

export type CheckFindingCode = (typeof CHECK_FINDING_CODES)[number];

export interface CheckFinding {
  code: CheckFindingCode;
  severity: CheckSeverity;
  message: string;
  itemIds: string[];
}

export interface DesignEvaluation {
  version: number;
  committedCents: number;
  budgetCents: number;
  overBudget: boolean;
  findings: CheckFinding[];
}

export type AuditEventType =
  | 'session_created'
  | 'manual_edit'
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'proposal_applied'
  | 'proposal_superseded'
  | 'protected_action_blocked'
  | 'protected_action_confirmed'
  | 'protected_action_performed';

export interface AuditEvent {
  id: string;
  sessionId: string;
  type: AuditEventType;
  actor: ActorKind;
  at: string;
  version: number;
  proposalId?: string;
  detail: string;
}

/** The exportable proof artifact: what was decided, by whom, in what order. */
export interface Receipt {
  contractVersion: string;
  sessionId: string;
  generatedAt: string;
  finalVersion: number;
  evaluation: DesignEvaluation;
  proposals: Proposal[];
  events: AuditEvent[];
}

export interface ToolError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export type ToolResult<T> =
  { ok: true; requestId: string; data: T } | { ok: false; requestId: string; error: ToolError };

/**
 * The complete agent-callable tool surface. Approval and confirmation are
 * deliberately absent: there is no agent-callable path to consent.
 */
export const AGENT_TOOL_NAMES = [
  'get_room_state',
  'search_catalog',
  'evaluate_design',
  'propose_changes',
  'get_proposal',
  'apply_approved_proposal',
  'request_protected_action',
  'get_receipt',
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

/** Reachable only from the page UI, authorized by the request channel. */
export const HUMAN_ONLY_ENDPOINTS = [
  'POST /api/v1/sessions/:sessionId/edits',
  'POST /api/v1/sessions/:sessionId/decisions',
  'POST /api/v1/sessions/:sessionId/confirmations',
] as const;

export interface SessionScopedRequest {
  sessionId: string;
}

export interface SearchCatalogRequest extends SessionScopedRequest {
  query: string;
  category?: ProductCategory;
  maxPriceCents?: number;
  accessibleOnly?: boolean;
}

export interface ProposeChangesRequest extends SessionScopedRequest {
  expectedVersion: number;
  operations: Operation[];
  rationale: string;
  idempotencyKey: string;
}

export interface ApplyProposalRequest extends SessionScopedRequest {
  proposalId: string;
  expectedVersion: number;
  proposalHash: string;
  idempotencyKey: string;
}

export interface ProtectedActionRequest extends SessionScopedRequest {
  action: ProtectedAction;
  payload: Record<string, string>;
  confirmationId?: string;
  idempotencyKey: string;
}

/** Human-only. Present for completeness; never exposed as an agent tool. */
export interface DecisionRequest extends SessionScopedRequest {
  proposalId: string;
  proposalHash: string;
  outcome: 'approve' | 'reject';
}

export interface RoomStateResponse {
  state: RoomState;
  evaluation: DesignEvaluation;
}

export interface ProposalResponse {
  proposal: Proposal;
  /** Proposing never mutates committed state; this echoes it unchanged. */
  state: RoomState;
}

export interface ApplyResponse {
  state: RoomState;
  proposal: Proposal;
  evaluation: DesignEvaluation;
}

export interface ProtectedActionResponse {
  action: ProtectedAction;
  reference: string;
  performedAt: string;
}

export interface IdempotencyRecord {
  key: string;
  /** Canonical hash of the payload the key was first used with. */
  requestHash: string;
  /** Opaque reference to the stored result, such as a proposal id. */
  resultRef: string;
  createdAt: string;
}
