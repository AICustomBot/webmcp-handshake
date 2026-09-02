import { describe, expect, it } from 'vitest';
import { issueConfirmation, publicConfirmation, verifyConfirmation } from '../apps/worker/src/evidence';

const action = 'request_quote' as const;
const payload = { fixture: 'harbor-vanity' };

describe('protected action evidence', () => {
  it('binds a random proof to one exact action and payload', async () => {
    const issued = await issueConfirmation(action, payload, new Date('2026-09-02T12:00:00Z'));
    expect(await verifyConfirmation(issued, issued.proof, action, payload, Date.parse('2026-09-02T12:01:00Z'))).toBe('allowed');
    expect(await verifyConfirmation(issued, issued.proof, action, { fixture: 'other' }, Date.parse('2026-09-02T12:01:00Z'))).toBe('required');
    expect(publicConfirmation(issued)).not.toHaveProperty('proof');
  });

  it('denies missing, consumed, and expired proof', async () => {
    const issued = await issueConfirmation(action, payload, new Date('2026-09-02T12:00:00Z'));
    expect(await verifyConfirmation(undefined, undefined, action, payload)).toBe('required');
    expect(await verifyConfirmation({ ...issued, consumedAt: '2026-09-02T12:01:00Z' }, issued.proof, action, payload)).toBe('required');
    expect(await verifyConfirmation(issued, issued.proof, action, payload, Date.parse('2026-09-02T12:06:00Z'))).toBe('expired');
  });
});
