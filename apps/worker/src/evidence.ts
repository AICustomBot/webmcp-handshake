import { LIMITS } from '@handshake/contracts';
import type { ProtectedAction } from '@handshake/contracts';
import { requestHash } from '@handshake/policy';

export interface StoredConfirmation {
  id: string;
  proof: string;
  action: ProtectedAction;
  payloadHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export function randomProof(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function protectedPayloadHash(
  action: ProtectedAction,
  payload: Record<string, string>,
): Promise<string> {
  return requestHash({ action, payload });
}

export async function issueConfirmation(
  action: ProtectedAction,
  payload: Record<string, string>,
  now = new Date(),
): Promise<StoredConfirmation> {
  return {
    id: crypto.randomUUID(),
    proof: randomProof(),
    action,
    payloadHash: await protectedPayloadHash(action, payload),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LIMITS.confirmationTtlSeconds * 1000).toISOString(),
  };
}

export async function verifyConfirmation(
  confirmation: StoredConfirmation | undefined,
  proof: string | undefined,
  action: ProtectedAction,
  payload: Record<string, string>,
  now = Date.now(),
): Promise<'allowed' | 'required' | 'expired'> {
  if (!confirmation || !proof || confirmation.proof !== proof || confirmation.consumedAt) {
    return 'required';
  }
  if (!Number.isFinite(Date.parse(confirmation.expiresAt)) || Date.parse(confirmation.expiresAt) <= now) {
    return 'expired';
  }
  const hash = await protectedPayloadHash(action, payload);
  return confirmation.action === action && confirmation.payloadHash === hash ? 'allowed' : 'required';
}

export function publicConfirmation(confirmation: StoredConfirmation) {
  const { proof: _proof, ...safe } = confirmation;
  return safe;
}
