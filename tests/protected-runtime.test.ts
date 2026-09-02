import { describe, expect, it } from 'vitest';
import {
  buildReceipt,
  createHumanConfirmation,
  performProtectedAction,
} from '../apps/worker/src/protected-runtime';
import type { EvidenceLedger } from '../apps/worker/src/protected-runtime';

function ledger(): EvidenceLedger {
  return { confirmations: {}, events: [] };
}

describe('protected action transaction', () => {
  it('requires page confirmation, consumes it once, and records evidence', async () => {
    const evidence = ledger();
    const input = { action: 'request_quote' as const, payload: { fixture: 'harbor-vanity' } };
    expect(await performProtectedAction(evidence, 'session-1', 2, input)).toMatchObject({
      ok: false,
      code: 'CONFIRMATION_REQUIRED',
    });
    const issued = await createHumanConfirmation(
      evidence,
      'session-1',
      2,
      input.action,
      input.payload,
    );
    const protectedInput = {
      ...input,
      confirmationId: issued.confirmation.id,
      proof: issued.proof,
    };
    const completed = await performProtectedAction(evidence, 'session-1', 2, protectedInput);
    expect(completed).toMatchObject({ ok: true, action: 'request_quote' });
    expect(await performProtectedAction(evidence, 'session-1', 2, protectedInput)).toMatchObject({
      ok: false,
      code: 'CONFIRMATION_REQUIRED',
    });
    expect(evidence.events.map((event) => event.type)).toEqual([
      'protected_action_blocked',
      'protected_action_confirmed',
      'protected_action_performed',
      'protected_action_blocked',
    ]);
    expect(evidence.events[1]?.version).toBe(2);
  });

  it('exports an allowlisted receipt without proof material', async () => {
    const evidence = ledger();
    const issued = await createHumanConfirmation(evidence, 'session-1', 0, 'book_consultation', {
      day: '2026-09-05',
    });
    const receipt = buildReceipt(
      'session-1',
      {
        sessionId: 'session-1',
        version: 0,
        widthIn: 108,
        lengthIn: 132,
        budgetCents: 1000,
        items: [],
      },
      { version: 0, committedCents: 0, budgetCents: 1000, overBudget: false, findings: [] },
      [],
      evidence,
    );
    expect(JSON.stringify(receipt)).not.toContain(issued.proof);
    expect(receipt.events).toHaveLength(1);
  });
});
