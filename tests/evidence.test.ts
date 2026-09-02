import { describe, expect, it } from 'vitest';
import { consumeConfirmation, issueConfirmation, publicConfirmation } from '../apps/worker/src/evidence';

const action = 'request_quote' as const;
const payload = { fixture: 'harbor-vanity' };
const noopPersist = async () => {};

describe('protected action evidence', () => {
  it('binds and consumes a random proof for one exact session, action, and payload', async () => {
    const issued = await issueConfirmation('session-1', action, payload, new Date('2026-09-02T12:00:00Z'));
    let persisted;
    expect(await consumeConfirmation(issued, issued.proof, 'session-1', action, payload, async (value) => { persisted = { ...value }; }, Date.parse('2026-09-02T12:01:00Z'))).toBe('allowed');
    expect(persisted).toHaveProperty('consumedAt');
    expect(await consumeConfirmation(issued, issued.proof, 'session-1', action, payload, noopPersist, Date.parse('2026-09-02T12:01:01Z'))).toBe('required');
    expect(publicConfirmation(issued)).not.toHaveProperty('proof');
  });

  it('denies cross-session, mismatched, missing, consumed, and expired proof', async () => {
    const issued = await issueConfirmation('session-1', action, payload, new Date('2026-09-02T12:00:00Z'));
    expect(await consumeConfirmation({ ...issued }, issued.proof, 'session-2', action, payload, noopPersist)).toBe('required');
    expect(await consumeConfirmation({ ...issued }, issued.proof, 'session-1', action, { fixture: 'other' }, noopPersist)).toBe('required');
    expect(await consumeConfirmation(undefined, undefined, 'session-1', action, payload, noopPersist)).toBe('required');
    expect(await consumeConfirmation({ ...issued, consumedAt: '2026-09-02T12:01:00Z' }, issued.proof, 'session-1', action, payload, noopPersist)).toBe('required');
    expect(await consumeConfirmation({ ...issued }, issued.proof, 'session-1', action, payload, noopPersist, Date.parse('2026-09-02T12:06:00Z'))).toBe('expired');
  });
});
