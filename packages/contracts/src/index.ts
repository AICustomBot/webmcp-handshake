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

/**
 * 2.0.0 widened the domain from bath-only to kitchen and bath. See
 * docs/decisions/ADR-0004-full-kitchen-and-bath-scope.md. Every change from
 * 1.0.0 is additive: no field was removed, renamed or retyped, and no error
 * code, proposal status or finding code changed meaning.
 */
export const CONTRACT_VERSION = '2.0.0';

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
  /** Openings are doors, windows and cased passages. */
  maxOpeningsPerRoom: 12,
  maxServiceAnchorsPerRoom: 16,
  /** Retained idempotency records per session, oldest pruned first. */
  maxIdempotencyRecords: 200,
  /** Per-session request ceilings, enforced server side. */
  maxRequestsPerMinute: 240,
  maxWritesPerMinute: 60,
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
 * The single source of truth for HTTP status mapping. Both the worker and the
 * page read this, so a consent failure can never be reported as a generic
 * `400` on one side and a `428` on the other.
 *
 * `CONFIRMATION_REQUIRED` is 428 Precondition Required: the request was
 * understood and is not malformed, it is missing a human confirmation.
 */
export const HTTP_STATUS_FOR_ERROR: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  LIMIT_EXCEEDED: 413,
  SESSION_NOT_FOUND: 404,
  PROPOSAL_NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  PROPOSAL_EXPIRED: 410,
  PROPOSAL_NOT_APPROVED: 403,
  PROPOSAL_REJECTED: 409,
  PROPOSAL_SUPERSEDED: 409,
  PROPOSAL_INVALIDATED: 409,
  PROPOSAL_ALREADY_DECIDED: 409,
  PROPOSAL_ALREADY_APPLIED: 409,
  PROPOSAL_HASH_MISMATCH: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CONFIRMATION_REQUIRED: 428,
  CONFIRMATION_EXPIRED: 403,
  FORBIDDEN_ACTOR: 403,
  POLICY_BLOCKED: 403,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
};

/**
 * Human sentences for every stable error code, so the UI never shows a raw
 * code to a person. Kept here rather than in the page so the worker, the tool
 * layer and the page all apologise in the same words.
 */
export const ERROR_COPY: Record<ErrorCode, string> = {
  INVALID_INPUT: 'That request was not something we could read. Nothing changed.',
  LIMIT_EXCEEDED: 'That request was larger than this session allows. Nothing changed.',
  SESSION_NOT_FOUND: 'This design session has ended. Start a new one to keep working.',
  PROPOSAL_NOT_FOUND: 'That suggestion is no longer available.',
  VERSION_CONFLICT: 'The room changed while that suggestion was open, so it no longer applies.',
  PROPOSAL_EXPIRED: 'That suggestion passed its review window and was not applied.',
  PROPOSAL_NOT_APPROVED: 'That suggestion still needs your approval.',
  PROPOSAL_REJECTED: 'You declined that suggestion, so it was not applied.',
  PROPOSAL_SUPERSEDED: 'A newer change replaced that suggestion.',
  PROPOSAL_INVALIDATED: 'That suggestion is no longer valid against the current room.',
  PROPOSAL_ALREADY_DECIDED: 'You already decided that suggestion.',
  PROPOSAL_ALREADY_APPLIED: 'That suggestion was already applied once and cannot repeat.',
  PROPOSAL_HASH_MISMATCH:
    'The suggestion contents did not match what you reviewed, so it was refused.',
  IDEMPOTENCY_CONFLICT: 'That request was reused with different contents and was refused.',
  CONFIRMATION_REQUIRED: 'This step needs your confirmation before it can go ahead.',
  CONFIRMATION_EXPIRED: 'That confirmation timed out. Confirm again to continue.',
  FORBIDDEN_ACTOR: 'That action is not available from here.',
  POLICY_BLOCKED: 'That action is not allowed in this session.',
  RATE_LIMITED: 'Too many requests at once. Wait a moment and try again.',
  NOT_IMPLEMENTED: 'That is not available yet.',
};

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

/**
 * Which room is being designed. Selects the planning rule pack. A stored
 * session written before 2.0.0 has no room type; readers treat that as
 * `bathroom` rather than guessing.
 */
export const ROOM_TYPES = ['bathroom', 'kitchen'] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

/**
 * Named walls of the axis-aligned room rectangle. `north` is y = 0, `south`
 * is y = lengthIn, `west` is x = 0 and `east` is x = widthIn.
 */
export const WALL_SIDES = ['north', 'east', 'south', 'west'] as const;

export type WallSide = (typeof WALL_SIDES)[number];

export type OpeningKind = 'door' | 'window' | 'passage';

/**
 * A door, window or cased passage in one wall.
 *
 * `offsetIn` is measured along the wall from its origin corner: x = 0 for the
 * north and south walls, y = 0 for the west and east walls. `swingIn` is how
 * far a door leaf sweeps into the room, and is 0 for windows and passages.
 */
export interface RoomOpening {
  id: string;
  kind: OpeningKind;
  wall: WallSide;
  offsetIn: number;
  widthIn: number;
  swingIn: number;
}

export const SERVICE_KINDS = [
  'water',
  'drain',
  'gas',
  'electrical_120v',
  'electrical_240v',
  'vent',
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

/**
 * An existing service location on a wall. Anchors are what make "move the sink
 * to the other wall" an expensive change rather than a free one, so the engine
 * can warn when a fixture needs a service that is not near it.
 */
export interface ServiceAnchor {
  id: string;
  kind: ServiceKind;
  wall: WallSide;
  offsetIn: number;
}

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
  /** Added at 2.0.0. Absent means `bathroom`. */
  roomType?: RoomType;
  /** Added at 2.0.0. Absent means no openings were modelled, not that there are none. */
  openings?: RoomOpening[];
  /** Added at 2.0.0. Absent means no service locations were modelled. */
  serviceAnchors?: ServiceAnchor[];
}

/**
 * Bath categories are unchanged from 1.0.0. Kitchen categories were added at
 * 2.0.0 under ADR-0004.
 */
export const PRODUCT_CATEGORIES = [
  'vanity',
  'shower',
  'tub',
  'toilet',
  'storage',
  'lighting',
  'base_cabinet',
  'wall_cabinet',
  'tall_cabinet',
  'countertop',
  'island',
  'sink',
  'range',
  'cooktop',
  'wall_oven',
  'refrigerator',
  'dishwasher',
  'microwave',
  'hood',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Which room types each category belongs in. Placing a range in a bathroom is
 * a planning mistake worth surfacing, not a crash.
 */
export const CATEGORY_ROOM_TYPES: Record<ProductCategory, readonly RoomType[]> = {
  vanity: ['bathroom'],
  shower: ['bathroom'],
  tub: ['bathroom'],
  toilet: ['bathroom'],
  storage: ['bathroom', 'kitchen'],
  lighting: ['bathroom', 'kitchen'],
  base_cabinet: ['kitchen'],
  wall_cabinet: ['kitchen'],
  tall_cabinet: ['kitchen'],
  countertop: ['kitchen'],
  island: ['kitchen'],
  sink: ['kitchen'],
  range: ['kitchen'],
  cooktop: ['kitchen'],
  wall_oven: ['kitchen'],
  refrigerator: ['kitchen'],
  dishwasher: ['kitchen'],
  microwave: ['kitchen'],
  hood: ['kitchen'],
};

/** How a product meets the room, which decides whether it consumes floor area. */
export type MountType = 'floor' | 'wall' | 'counter' | 'ceiling' | 'under_counter';

/** The three kitchen work centers that form the work triangle. */
export type WorkCenter = 'sink' | 'cooktop' | 'refrigerator';

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
  /** Added at 2.0.0. Absent members fall back to a documented category default. */
  sku?: string;
  heightIn?: number;
  mount?: MountType;
  /** How far a hinged door or drawer front projects when opened. */
  doorSwingIn?: number;
  requiresPlumbing?: boolean;
  requiresElectrical?: boolean;
  requiresVenting?: boolean;
  /** Marks this product as one of the three kitchen work centers. */
  workCenter?: WorkCenter;
  /** Required counter landing to the left of the product, facing it. */
  landingLeftIn?: number;
  /** Required counter landing to the right of the product, facing it. */
  landingRightIn?: number;
  /** Whether this product itself provides usable counter surface. */
  counterRun?: boolean;
  tags?: readonly string[];
}

/**
 * Bath planning thresholds, in inches.
 *
 * Source: NKBA Kitchen & Bath Planning Guidelines with Access Standards, and
 * the IRC clearances the NKBA cites. These are planning recommendations
 * applied to synthetic data, not a code-compliance certification. Where the
 * recommendation and the code minimum differ, both are kept: the
 * recommendation drives `warning`, the code minimum drives `blocked`.
 */
export const BATH_GUIDELINES = {
  /** Bath Guideline 4. Clear floor space in front of every fixture. */
  clearFloorSpaceIn: 30,
  /** IRC P2705.1.5 / R307.1 minimum in front of a lavatory, toilet or bidet. */
  codeMinFixtureClearanceIn: 21,
  /** IRC minimum in front of a tub. */
  codeMinTubClearanceIn: 24,
  /** Bath Guideline 1. Recommended door width; 32 in is the usable minimum. */
  recommendedDoorwayIn: 36,
  minDoorwayIn: 32,
  /** Centerline of a toilet to any wall or obstruction. */
  toiletCenterlineToWallIn: 18,
  codeMinToiletCenterlineToWallIn: 15,
  /** A shower this size lets one person step clear of the spray. */
  minShowerWidthIn: 36,
  minShowerDepthIn: 42,
  /** Access Standard turning circle for a wheelchair or mobility aid. */
  turningCircleIn: 60,
} as const;

/**
 * Kitchen planning thresholds, in inches. Same source and same limits as
 * `BATH_GUIDELINES`: recommendations applied to synthetic data.
 */
export const KITCHEN_GUIDELINES = {
  /** Guideline 5. Sum of the three work triangle legs, 13 ft to 26 ft. */
  workTriangleMinTotalIn: 156,
  workTriangleMaxTotalIn: 312,
  /** No single leg shorter than 4 ft or longer than 9 ft. */
  workTriangleLegMinIn: 48,
  workTriangleLegMaxIn: 108,
  /** Guideline 6. Work aisle width, by number of cooks. */
  workAisleOneCookIn: 42,
  workAisleTwoCookIn: 48,
  /** Guideline 6. A walkway that is not a work aisle. */
  walkwayIn: 36,
  /** Guideline 1. Any kitchen doorway. */
  minDoorwayIn: 32,
  recommendedDoorwayIn: 36,
  /** Guideline 11. Landing area either side of a sink. */
  sinkLandingPrimaryIn: 24,
  sinkLandingSecondaryIn: 18,
  /** Guideline 12. Continuous prep counter next to the sink. */
  prepCounterIn: 36,
  /** Guideline 13. Dishwasher edge to nearest sink edge. */
  dishwasherToSinkMaxIn: 36,
  /** Guidelines 14 to 18. Landing area beside each appliance. */
  refrigeratorLandingIn: 15,
  cooktopLandingPrimaryIn: 15,
  cooktopLandingSecondaryIn: 12,
  ovenLandingIn: 15,
  microwaveLandingIn: 15,
  /** Guideline 18. Two landing areas that overlap need the larger plus 12 in. */
  combinedLandingBonusIn: 12,
  /** Guideline 9. Counter seating. */
  seatingWidthPerDinerIn: 24,
  /** Access Standard turning circle for a wheelchair or mobility aid. */
  turningCircleIn: 60,
} as const;

/** Cited on every finding so a reviewer can audit the threshold. */
export const GUIDELINE_SOURCE =
  'NKBA Kitchen & Bath Planning Guidelines with Access Standards, with the IRC minimums it cites. Planning recommendations applied to synthetic data; not a code-compliance certification.';

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

/**
 * Added at 2.0.0. Changes the room envelope itself. Every member is optional
 * so a proposal can change only the budget, or only the room type, without
 * restating geometry it does not intend to touch.
 */
export interface ConfigureRoomOperation {
  type: 'configure_room';
  roomType?: RoomType;
  widthIn?: number;
  lengthIn?: number;
  budgetCents?: number;
}

export interface AddOpeningOperation {
  type: 'add_opening';
  kind: OpeningKind;
  wall: WallSide;
  offsetIn: number;
  widthIn: number;
  swingIn: number;
}

export interface MoveOpeningOperation {
  type: 'move_opening';
  openingId: string;
  wall?: WallSide;
  offsetIn?: number;
  widthIn?: number;
  swingIn?: number;
}

export interface RemoveOpeningOperation {
  type: 'remove_opening';
  openingId: string;
}

export type Operation =
  | PlaceOperation
  | MoveOperation
  | SwapOperation
  | RemoveOperation
  | ConfigureRoomOperation
  | AddOpeningOperation
  | MoveOpeningOperation
  | RemoveOpeningOperation;

/** Operations that target an existing room item by id. */
export type ItemOperation = MoveOperation | SwapOperation | RemoveOperation;

/** Operations that target an existing opening by id. */
export type OpeningOperation = MoveOpeningOperation | RemoveOpeningOperation;

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

/**
 * The first five codes are unchanged from 1.0.0. The rest were added at 2.0.0
 * under ADR-0004. None of these gate approval; they are the proof a human
 * reviews before deciding.
 */
export const CHECK_FINDING_CODES = [
  'UNKNOWN_PRODUCT',
  'OUT_OF_BOUNDS',
  'FIXTURE_OVERLAP',
  'CLEARANCE_WARNING',
  'OVER_BUDGET',
  'CATEGORY_ROOM_MISMATCH',
  'DOOR_BLOCKED',
  'OPENING_INVALID',
  'APPLIANCE_DOOR_CONFLICT',
  'WORK_TRIANGLE_TOO_LARGE',
  'WORK_TRIANGLE_TOO_SMALL',
  'WORK_TRIANGLE_LEG_INVALID',
  'MISSING_WORK_CENTER',
  'WORK_AISLE_TOO_NARROW',
  'WALKWAY_TOO_NARROW',
  'MISSING_LANDING_AREA',
  'DISHWASHER_TOO_FAR_FROM_SINK',
  'CORNER_DEAD_ZONE',
  'MISSING_SERVICE_ANCHOR',
  'NO_TURNING_SPACE',
] as const;

export type CheckFindingCode = (typeof CHECK_FINDING_CODES)[number];

export interface CheckFinding {
  code: CheckFindingCode;
  severity: CheckSeverity;
  message: string;
  itemIds: string[];
  /** Added at 2.0.0. The guideline this finding came from, for audit. */
  guideline?: string;
  /** Added at 2.0.0. What the layout measures, in inches. */
  measuredIn?: number;
  /** Added at 2.0.0. What the guideline recommends, in inches. */
  recommendedIn?: number;
  /** Added at 2.0.0. Openings implicated, when the finding is about one. */
  openingIds?: string[];
}

/** One catalog product rolled up across every placed instance of it. */
export interface BomLine {
  productId: string;
  name: string;
  category: ProductCategory;
  sku?: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

/**
 * The bill of materials promised by docs/PRODUCT-SPEC.md. Derived entirely
 * from committed state and the catalog, so it can never disagree with the
 * room the human approved.
 */
export interface BillOfMaterials {
  lines: BomLine[];
  subtotalCents: number;
  itemCount: number;
  /** Items whose product is missing from the catalog, and so cannot be priced. */
  unpricedItemIds: string[];
}

export interface DesignEvaluation {
  version: number;
  committedCents: number;
  budgetCents: number;
  overBudget: boolean;
  findings: CheckFinding[];
  /** Added at 2.0.0. Always populated by the policy engine. */
  roomType?: RoomType;
  /** Budget less committed cost. Negative when over budget. */
  remainingCents?: number;
  blockedCount?: number;
  warningCount?: number;
  bom?: BillOfMaterials;
  guidelineSource?: string;
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
  | { ok: true; requestId: string; data: T }
  | { ok: false; requestId: string; error: ToolError };

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
  'get_bill_of_materials',
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

/** Reachable only from the page UI, authorized by the request channel. */
export const HUMAN_ONLY_ENDPOINTS = [
  'POST /api/v1/sessions/:sessionId/edits',
  'POST /api/v1/sessions/:sessionId/decisions',
  'POST /api/v1/sessions/:sessionId/confirmations',
] as const;

/** Session-independent reads. The catalog is public, static and unprivileged. */
export const PUBLIC_ENDPOINTS = ['GET /api/v1/catalog', 'GET /api/v1/health'] as const;

export interface SessionScopedRequest {
  sessionId: string;
}

export interface SearchCatalogRequest extends SessionScopedRequest {
  query: string;
  category?: ProductCategory;
  maxPriceCents?: number;
  accessibleOnly?: boolean;
  /** Added at 2.0.0. Restricts results to categories valid for a room type. */
  roomType?: RoomType;
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

/** Added at 2.0.0. The server-owned catalog, replacing three client copies. */
export interface CatalogResponse {
  contractVersion: string;
  products: Product[];
  guidelineSource: string;
}

/** Added at 2.0.0. */
export interface BillOfMaterialsResponse {
  version: number;
  bom: BillOfMaterials;
  budgetCents: number;
  remainingCents: number;
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
