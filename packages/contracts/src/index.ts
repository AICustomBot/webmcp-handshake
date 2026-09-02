export type ProposalStatus =
  'pending_human' | 'approved' | 'rejected' | 'applied' | 'expired' | 'superseded' | 'invalidated';
export type Operation =
  | { type: 'place'; productId: string; x: number; y: number; rotation: 0 | 90 | 180 | 270 }
  | { type: 'move'; itemId: string; x: number; y: number; rotation: 0 | 90 | 180 | 270 }
  | { type: 'swap'; itemId: string; replacementProductId: string }
  | { type: 'remove'; itemId: string };
/** Operations a capability-authenticated manual edit may carry (place/move only; see D1 for remove via proposals). */
export type ManualOp = Extract<Operation, { type: 'place' | 'move' }>;
export interface RoomState {
  sessionId: string;
  version: number;
  widthIn: number;
  lengthIn: number;
  budgetCents: number;
  items: RoomItem[];
}
export interface RoomItem {
  id: string;
  productId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
}
export interface Proposal {
  id: string;
  baseVersion: number;
  hash: string;
  status: ProposalStatus;
  operations: Operation[];
  createdAt: string;
  expiresAt: string;
}
/** Stored proposal: contract `Proposal` plus decision/apply bookkeeping (plan §2). */
export interface ProposalRecord extends Proposal {
  decidedAt?: string;
  appliedAt?: string;
  decidedBy?: 'human';
}
export type ToolResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: string; message: string; retryable: boolean }; requestId: string };
export const LIMITS = {
  maxOperationsPerProposal: 12,
  maxBodyBytes: 32768,
  proposalTtlSeconds: 600,
  confirmationTtlSeconds: 300,
  sessionTtlSeconds: 86400,
} as const;

/** Stable tool-surface error codes (plan §7, WEBMCP-TOOL-CONTRACTS.md). */
export const STABLE_ERROR_CODES = [
  'INVALID_INPUT',
  'VERSION_CONFLICT',
  'PROPOSAL_EXPIRED',
  'PROPOSAL_NOT_APPROVED',
  'PROPOSAL_REJECTED',
  'PROPOSAL_SUPERSEDED',
  'IDEMPOTENCY_CONFLICT',
  'CONFIRMATION_REQUIRED',
  'CONFIRMATION_EXPIRED',
  'POLICY_BLOCKED',
  'NOT_FOUND',
  'SESSION_EXPIRED',
  'RATE_LIMITED',
  'ORIGIN_DENIED',
] as const;
export type ErrorCode = (typeof STABLE_ERROR_CODES)[number];

/**
 * Deterministic JSON serialization: object keys recursively sorted (code-unit order),
 * array order preserved. Locale-independent, so the same payload hashes identically
 * in Workers and Node.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/** SHA-256 hex digest of `canonicalJson(value)` via the platform WebCrypto (Workers + Node 19+). */
export async function canonicalHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Random session id (plan D2: 128-bit random ids; no session list endpoint). */
export function newSessionId(): string {
  return crypto.randomUUID();
}

/** Session capability: 16 random bytes as 32-char hex, returned once at creation (plan D2). */
export function newCapability(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type CatalogCategory =
  'fixture' | 'storage' | 'vanity' | 'faucet' | 'toilet' | 'shower' | 'accessory';
export interface CatalogProduct {
  id: string;
  name: string;
  category: CatalogCategory;
  priceCents: number;
  widthIn: number;
  lengthIn: number;
  clearanceIn: number;
  wallMount: boolean;
}

/** Synthetic demo catalog (ADR-0003: synthetic-only; ids and prices fixed). */
export const CATALOG: readonly CatalogProduct[] = [
  {
    id: 'vanity-60-double',
    name: 'Vanity 60in Double Sink',
    category: 'vanity',
    priceCents: 189900,
    widthIn: 60,
    lengthIn: 22,
    clearanceIn: 21,
    wallMount: false,
  },
  {
    id: 'mirror-cabinet-36',
    name: 'Mirror Cabinet 36in',
    category: 'storage',
    priceCents: 24900,
    widthIn: 36,
    lengthIn: 5,
    clearanceIn: 0,
    wallMount: true,
  },
  {
    id: 'shower-corner-36',
    name: 'Corner Shower 36x36',
    category: 'shower',
    priceCents: 89900,
    widthIn: 36,
    lengthIn: 36,
    clearanceIn: 24,
    wallMount: false,
  },
  {
    id: 'toilet-elongated',
    name: 'Elongated Toilet',
    category: 'toilet',
    priceCents: 42900,
    widthIn: 15,
    lengthIn: 28,
    clearanceIn: 21,
    wallMount: false,
  },
  {
    id: 'faucet-matte-black',
    name: 'Matte Black Faucet',
    category: 'faucet',
    priceCents: 15900,
    widthIn: 8,
    lengthIn: 3,
    clearanceIn: 0,
    wallMount: false,
  },
  {
    id: 'towel-bar-matte',
    name: 'Towel Bar 24in Matte Black',
    category: 'accessory',
    priceCents: 4900,
    widthIn: 24,
    lengthIn: 2,
    clearanceIn: 0,
    wallMount: true,
  },
  {
    id: 'storage-tower-24',
    name: 'Storage Tower 24x18',
    category: 'storage',
    priceCents: 19900,
    widthIn: 24,
    lengthIn: 18,
    clearanceIn: 0,
    wallMount: false,
  },
  {
    id: 'vanity-light-36',
    name: 'Vanity Light 36in',
    category: 'accessory',
    priceCents: 8900,
    widthIn: 36,
    lengthIn: 4,
    clearanceIn: 0,
    wallMount: true,
  },
  {
    id: 'sink-undermount',
    name: 'Undermount Sink',
    category: 'fixture',
    priceCents: 21900,
    widthIn: 33,
    lengthIn: 19,
    clearanceIn: 0,
    wallMount: false,
  },
  {
    id: 'shelf-recessed',
    name: 'Recessed Shelf 16x24',
    category: 'storage',
    priceCents: 7900,
    widthIn: 16,
    lengthIn: 24,
    clearanceIn: 0,
    wallMount: true,
  },
];
