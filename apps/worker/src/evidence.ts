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

/** Generates a server-held 256-bit confirmation proof. */
export function randomProof(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hashes the exact protected action and payload shown to the human. */
export async function protectedPayloadHash(
  action: ProtectedAction,
  payload: Record<string, string>,
): Promise<string> {
  return requestHash({ action, payload });
}

/** Issues a short-lived confirmation whose proof is never publicly serialized. */
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

/** Verifies, consumes, and persists one proof before the protected action runs. */
export async function consumeConfirmation(
  confirmation: StoredConfirmation | undefined,
  proof: string | undefined,
  action: ProtectedAction,
  payload: Record<string, string>,
  persist: (value: StoredConfirmation) => Promise<void>,
  now = Date.now(),
): Promise<'allowed' | 'required' | 'expired'> {
  if (!confirmation || !proof || confirmation.proof !== proof || confirmation.consumedAt) {
    return 'required';
  }
  if (!Number.isFinite(Date.parse(confirmation.expiresAt)) || Date.parse(confirmation.expiresAt) <= now) {
    return 'expired';
  }
  const hash = await protectedPayloadHash(action, payload);
  if (confirmation.action !== action || confirmation.payloadHash !== hash) return 'required';
  confirmation.consumedAt = new Date(now).toISOString();
  await persist(confirmation);
  return 'allowed';
}

/** Removes secret proof material from exported confirmation evidence. */
export function publicConfirmation(confirmation: StoredConfirmation) {
  const { proof: _proof, ...safe } = confirmation;
  return safe;
}
