import { CONTRACT_VERSION, LIMITS } from '@handshake/contracts';
import type {
  AuditEvent,
  DesignEvaluation,
  ProtectedAction,
  Proposal,
  Receipt,
  RoomState,
} from '@handshake/contracts';
import { consumeConfirmation, issueConfirmation, publicConfirmation } from './evidence';
import type { StoredConfirmation } from './evidence';

export interface EvidenceLedger {
  confirmations: Record<string, StoredConfirmation>;
  events: AuditEvent[];
}

export interface ProtectedActionInput {
  action: ProtectedAction;
  payload: Record<string, string>;
  confirmationId?: string;
  proof?: string;
}

export type ProtectedActionOutcome =
  | { ok: true; action: ProtectedAction; reference: string; performedAt: string }
  | { ok: false; code: 'CONFIRMATION_REQUIRED' | 'CONFIRMATION_EXPIRED' };

/** Creates a page-owned confirmation and records only non-secret audit detail. */
export async function createHumanConfirmation(
  ledger: EvidenceLedger,
  sessionId: string,
  action: ProtectedAction,
  payload: Record<string, string>,
  now = new Date(),
): Promise<{ confirmation: ReturnType<typeof publicConfirmation>; proof: string }> {
  const confirmation = await issueConfirmation(action, payload, now);
  ledger.confirmations[confirmation.id] = confirmation;
  appendEvent(ledger, {
    id: crypto.randomUUID(),
    sessionId,
    type: 'protected_action_confirmed',
    actor: 'human_ui',
    at: now.toISOString(),
    version: 0,
    detail: `${action} confirmed for exact payload hash.`,
  });
  return { confirmation: publicConfirmation(confirmation), proof: confirmation.proof };
}

/** Consumes proof before producing a synthetic protected-action result. */
export async function performProtectedAction(
  ledger: EvidenceLedger,
  sessionId: string,
  version: number,
  input: ProtectedActionInput,
  now = new Date(),
): Promise<ProtectedActionOutcome> {
  const confirmation = input.confirmationId
    ? ledger.confirmations[input.confirmationId]
    : undefined;
  const outcome = await consumeConfirmation(
    confirmation,
    input.proof,
    input.action,
    input.payload,
    async (consumed) => {
      ledger.confirmations[consumed.id] = consumed;
    },
    now.getTime(),
  );
  if (outcome !== 'allowed') {
    appendEvent(ledger, {
      id: crypto.randomUUID(),
      sessionId,
      type: 'protected_action_blocked',
      actor: 'agent',
      at: now.toISOString(),
      version,
      detail: `${input.action} blocked: ${outcome}.`,
    });
    return {
      ok: false,
      code: outcome === 'expired' ? 'CONFIRMATION_EXPIRED' : 'CONFIRMATION_REQUIRED',
    };
  }
  const performedAt = now.toISOString();
  const reference = `SYN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  appendEvent(ledger, {
    id: crypto.randomUUID(),
    sessionId,
    type: 'protected_action_performed',
    actor: 'agent',
    at: performedAt,
    version,
    detail: `${input.action} completed with synthetic reference ${reference}.`,
  });
  return { ok: true, action: input.action, reference, performedAt };
}

/** Builds an allowlisted receipt without capabilities, proofs, or hidden reasoning. */
export function buildReceipt(
  sessionId: string,
  state: RoomState,
  evaluation: DesignEvaluation,
  proposals: Proposal[],
  ledger: EvidenceLedger,
  now = new Date(),
): Receipt {
  return {
    contractVersion: CONTRACT_VERSION,
    sessionId,
    generatedAt: now.toISOString(),
    finalVersion: state.version,
    evaluation,
    proposals: proposals.map((proposal) => ({ ...proposal, operations: [...proposal.operations] })),
    events: ledger.events.map((event) => ({ ...event })),
  };
}

/** Appends one audit event while enforcing the public contract bound. */
export function appendEvent(ledger: EvidenceLedger, event: AuditEvent): void {
  ledger.events.push(event);
  if (ledger.events.length > LIMITS.maxAuditEvents) {
    ledger.events.splice(0, ledger.events.length - LIMITS.maxAuditEvents);
  }
}
