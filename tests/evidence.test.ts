import { describe, expect, it } from 'vitest';
import {
  consumeConfirmation,
  issueConfirmation,
  publicConfirmation,
} from '../apps/worker/src/evidence';

const action = 'request_quote' as const;
const payload = { fixture: 'harbor-vanity' };
const acceptClaim = async () => true;

describe('protected action evidence', () => {
  it('binds and consumes a random proof for one exact session, action, and payload', async () => {
    const issued = await issueConfirmation(
      'session-1',
      action,
      payload,
      new Date('2026-09-02T12:00:00Z'),
    );
    let persisted;
    expect(
      await consumeConfirmation(
        issued,
        issued.proof,
        'session-1',
        action,
        payload,
        async (value) => {
          persisted = { ...value };
          return true;
        },
        Date.parse('2026-09-02T12:01:00Z'),
      ),
    ).toBe('allowed');
    expect(persisted).toHaveProperty('consumedAt');
    expect(
      await consumeConfirmation(
        issued,
        issued.proof,
        'session-1',
        action,
        payload,
        acceptClaim,
        Date.parse('2026-09-02T12:01:01Z'),
      ),
    ).toBe('required');
    expect(publicConfirmation(issued)).not.toHaveProperty('proof');
  });

  it('allows only one concurrent atomic claim', async () => {
    const issued = await issueConfirmation('session-1', action, payload);
    let claimed = false;
    const claim = async () => {
      await Promise.resolve();
      if (claimed) return false;
      claimed = true;
      return true;
    };
    const outcomes = await Promise.all([
      consumeConfirmation({ ...issued }, issued.proof, 'session-1', action, payload, claim),
      consumeConfirmation({ ...issued }, issued.proof, 'session-1', action, payload, claim),
    ]);
    expect(outcomes.sort()).toEqual(['allowed', 'required']);
  });

  it('denies cross-session, mismatched, missing, consumed, and expired proof', async () => {
    const issued = await issueConfirmation(
      'session-1',
      action,
      payload,
      new Date('2026-09-02T12:00:00Z'),
    );
    expect(
      await consumeConfirmation(
        { ...issued },
        issued.proof,
        'session-2',
        action,
        payload,
        acceptClaim,
      ),
    ).toBe('required');
    expect(
      await consumeConfirmation(
        { ...issued },
        issued.proof,
        'session-1',
        action,
        { fixture: 'other' },
        acceptClaim,
      ),
    ).toBe('required');
    expect(
      await consumeConfirmation(undefined, undefined, 'session-1', action, payload, acceptClaim),
    ).toBe('required');
    expect(
      await consumeConfirmation(
        { ...issued, consumedAt: '2026-09-02T12:01:00Z' },
        issued.proof,
        'session-1',
        action,
        payload,
        acceptClaim,
      ),
    ).toBe('required');
    expect(
      await consumeConfirmation(
        { ...issued },
        issued.proof,
        'session-1',
        action,
        payload,
        acceptClaim,
        Date.parse('2026-09-02T12:06:00Z'),
      ),
    ).toBe('expired');
  });
});
