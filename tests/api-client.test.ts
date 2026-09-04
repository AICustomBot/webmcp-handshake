import { describe, expect, it, vi } from 'vitest';
import {
  HandshakeApiClient,
  HandshakeApiError,
  type DecideBody,
  type ProposeBody,
} from '../apps/web/lib/api-client';
import type { Operation } from '@handshake/contracts';

describe('HandshakeApiClient', () => {
  describe('baseUrl sanitization', () => {
    it('removes trailing slashes from string baseUrl', () => {
      const client1 = new HandshakeApiClient('https://api.example.com/');
      expect(client1.baseUrl).toBe('https://api.example.com');

      const client2 = new HandshakeApiClient('https://api.example.com///');
      expect(client2.baseUrl).toBe('https://api.example.com');
    });

    it('removes trailing slashes from options.baseUrl', () => {
      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787/' });
      expect(client.baseUrl).toBe('http://localhost:8787');
    });

    it('handles empty baseUrl without error', () => {
      const client = new HandshakeApiClient('');
      expect(client.baseUrl).toBe('');
    });
  });

  describe('endpoint calls and header propagation', () => {
    it('calls healthz via GET /healthz without capability', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedHeaders: Record<string, string> = {};

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method ?? 'GET';
        requestedHeaders = (init?.headers as Record<string, string>) ?? {};
        return new Response(
          JSON.stringify({
            ok: true,
            service: 'handshake',
            contractVersion: '2.0.0',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.healthz();

      expect(requestedUrl).toBe('http://localhost:8787/healthz');
      expect(requestedMethod).toBe('GET');
      expect(requestedHeaders['x-handshake-capability']).toBeUndefined();
      expect(res).toEqual({
        ok: true,
        service: 'handshake',
        contractVersion: '2.0.0',
      });
    });

    it('calls getCatalog via GET /api/v1/catalog with query parameters', async () => {
      let requestedUrl = '';
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        requestedUrl = url.toString();
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              contractVersion: '2.0.0',
              products: [
                { id: 'base-sink-36', name: 'Sink Base Cabinet', category: 'base_cabinet' },
              ],
              guidelineSource: 'NKBA',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.getCatalog('kitchen', 'base_cabinet');

      expect(requestedUrl).toBe(
        'http://localhost:8787/api/v1/catalog?roomType=kitchen&category=base_cabinet',
      );
      expect(res.products).toHaveLength(1);
      expect(res.products[0]?.id).toBe('base-sink-36');
    });

    it('calls createSession via POST /api/v1/sessions', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let sentBody: any = null;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method ?? 'GET';
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              sessionId: 'sess-101',
              capability: 'cap-xyz',
              contractVersion: '2.0.0',
            },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.createSession({ roomType: 'kitchen', budgetCents: 2000000 });

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions');
      expect(requestedMethod).toBe('POST');
      expect(sentBody).toEqual({ roomType: 'kitchen', budgetCents: 2000000 });
      expect(res.sessionId).toBe('sess-101');
      expect(res.capability).toBe('cap-xyz');
    });

    it('calls getState with capability header', async () => {
      let requestedUrl = '';
      let capabilityHeader = '';

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        capabilityHeader =
          (init?.headers as Record<string, string>)['x-handshake-capability'] ?? '';
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              state: { sessionId: 'sess-101', version: 0, items: [] },
              evaluation: { version: 0, committedCents: 0, overBudget: false, findings: [] },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.getState('sess-101', 'cap-xyz');

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/state');
      expect(capabilityHeader).toBe('cap-xyz');
      expect(res.state.sessionId).toBe('sess-101');
    });

    it('calls propose via POST /api/v1/sessions/:id/proposals', async () => {
      let requestedUrl = '';
      let capabilityHeader = '';
      let sentBody: any = null;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        capabilityHeader =
          (init?.headers as Record<string, string>)['x-handshake-capability'] ?? '';
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              proposal: {
                id: 'prop-1',
                sessionId: 'sess-101',
                baseVersion: 0,
                hash: 'hash-abc',
                status: 'pending_human',
                operations: sentBody.operations,
                rationale: 'Add sink cabinet',
                createdAt: new Date().toISOString(),
                expiresAt: new Date().toISOString(),
              },
              state: { sessionId: 'sess-101', version: 0, items: [] },
            },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const op: Operation = {
        type: 'place',
        productId: 'base-sink-36',
        x: 10,
        y: 20,
        rotation: 0,
      };
      const body: ProposeBody = {
        expectedVersion: 0,
        operations: [op],
        rationale: 'Add sink cabinet',
        idempotencyKey: 'idem-1',
      };
      const res = await client.propose('sess-101', 'cap-xyz', body);

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/proposals');
      expect(capabilityHeader).toBe('cap-xyz');
      expect(sentBody).toEqual(body);
      expect(res.proposal.id).toBe('prop-1');
      expect(res.state.version).toBe(0); // State not mutated
    });

    it('calls decide via POST /api/v1/sessions/:id/decisions mapping decision to outcome', async () => {
      let sentBody: any = null;
      let capabilityHeader = '';

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capabilityHeader =
          (init?.headers as Record<string, string>)['x-handshake-capability'] ?? '';
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              proposal: {
                id: sentBody.proposalId,
                status: sentBody.outcome === 'approve' ? 'approved' : 'rejected',
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });

      // Test decision: 'approved'
      const decideBody1: DecideBody = {
        proposalId: 'prop-1',
        proposalHash: 'hash-abc',
        decision: 'approved',
      };
      const res1 = await client.decide('sess-101', 'cap-xyz', decideBody1);
      expect(capabilityHeader).toBe('cap-xyz');
      expect(sentBody.outcome).toBe('approve');
      expect(res1.proposal.status).toBe('approved');

      // Test decision: 'rejected'
      const decideBody2: DecideBody = {
        proposalId: 'prop-1',
        proposalHash: 'hash-abc',
        decision: 'rejected',
      };
      const res2 = await client.decide('sess-101', 'cap-xyz', decideBody2);
      expect(sentBody.outcome).toBe('reject');
      expect(res2.proposal.status).toBe('rejected');
    });

    it('calls apply via POST /api/v1/sessions/:id/apply', async () => {
      let requestedUrl = '';
      let sentBody: any = null;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              proposal: { id: 'prop-1', status: 'applied', appliedVersion: 1 },
              state: { sessionId: 'sess-101', version: 1, items: [] },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.apply('sess-101', 'cap-xyz', {
        proposalId: 'prop-1',
        proposalHash: 'hash-abc',
        expectedVersion: 0,
        idempotencyKey: 'idem-apply-1',
      });

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/apply');
      expect(sentBody.expectedVersion).toBe(0);
      expect(res.state.version).toBe(1);
      expect(res.proposal.status).toBe('applied');
    });

    it('calls edit via POST /api/v1/sessions/:id/edits', async () => {
      let requestedUrl = '';
      let sentBody: any = null;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              state: { sessionId: 'sess-101', version: 2, items: [] },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.edit('sess-101', 'cap-xyz', {
        expectedVersion: 1,
        operations: [
          {
            type: 'move',
            itemId: 'item-1',
            x: 50,
            y: 50,
            rotation: 90,
          },
        ],
      });

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/edits');
      expect(sentBody.operations[0].type).toBe('move');
      expect(res.state.version).toBe(2);
    });

    it('calls requestConfirmation via POST /api/v1/sessions/:id/confirmations', async () => {
      let requestedUrl = '';
      let sentBody: any = null;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              confirmation: {
                id: 'conf-1',
                sessionId: 'sess-101',
                action: sentBody.action,
                payloadHash: 'hash-payload',
                createdAt: new Date().toISOString(),
                expiresAt: new Date().toISOString(),
              },
              proof: 'proof-token-123',
            },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.requestConfirmation('sess-101', 'cap-xyz', {
        action: 'book_consultation',
        payload: { designer: 'Sarah' },
      });

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/confirmations');
      expect(res.confirmation.id).toBe('conf-1');
      expect(res.proof).toBe('proof-token-123');
    });

    it('calls executeProtectedAction via POST /api/v1/sessions/:id/protected-actions', async () => {
      let requestedUrl = '';
      let sentBody: any = null;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        sentBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              ok: true,
              action: sentBody.action,
              reference: 'SYN-12345678',
              performedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.executeProtectedAction('sess-101', 'cap-xyz', {
        action: 'book_consultation',
        payload: { designer: 'Sarah' },
        proof: 'proof-token-123',
        idempotencyKey: 'idem-action-1',
      });

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/protected-actions');
      expect(res.action).toBe('book_consultation');
      expect(res.reference).toBe('SYN-12345678');
    });

    it('calls getReceipt via GET /api/v1/sessions/:id/receipt', async () => {
      let requestedUrl = '';

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        requestedUrl = url.toString();
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              receipt: {
                contractVersion: '2.0.0',
                sessionId: 'sess-101',
                generatedAt: new Date().toISOString(),
                finalVersion: 3,
                evaluation: { version: 3, committedCents: 1000, overBudget: false, findings: [] },
                proposals: [],
                events: [],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.getReceipt('sess-101', 'cap-xyz');

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/receipt');
      expect(res.receipt.sessionId).toBe('sess-101');
      expect(res.receipt.finalVersion).toBe(3);
    });

    it('calls getBillOfMaterials via GET /api/v1/sessions/:id/bom', async () => {
      let requestedUrl = '';

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        requestedUrl = url.toString();
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              version: 2,
              bom: { lines: [], subtotalCents: 50000, itemCount: 1, unpricedItemIds: [] },
              budgetCents: 100000,
              remainingCents: 50000,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });
      const res = await client.getBillOfMaterials('sess-101', 'cap-xyz');

      expect(requestedUrl).toBe('http://localhost:8787/api/v1/sessions/sess-101/bom');
      expect(res.version).toBe(2);
      expect(res.remainingCents).toBe(50000);
    });
  });

  describe('error handling and envelope decoding', () => {
    it('decodes VERSION_CONFLICT (409) into typed HandshakeApiError', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            requestId: 'req-conflict',
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Committed state changed.',
              retryable: false,
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });

      await expect(
        client.apply('sess-101', 'cap-xyz', {
          proposalId: 'prop-1',
          proposalHash: 'hash-abc',
          expectedVersion: 0,
          idempotencyKey: 'idem-1',
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HandshakeApiError);
        const apiErr = err as HandshakeApiError;
        expect(apiErr.code).toBe('VERSION_CONFLICT');
        expect(apiErr.status).toBe(409);
        expect(apiErr.message).toBe('Committed state changed.');
        expect(apiErr.requestId).toBe('req-conflict');
        expect(apiErr.retryable).toBe(false);
        return true;
      });
    });

    it('decodes RATE_LIMITED (429) into typed retryable HandshakeApiError', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            requestId: 'req-rate-limit',
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests for this session. Please retry after backoff.',
              retryable: true,
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });

      await expect(client.getState('sess-101', 'cap-xyz')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HandshakeApiError);
        const apiErr = err as HandshakeApiError;
        expect(apiErr.code).toBe('RATE_LIMITED');
        expect(apiErr.status).toBe(429);
        expect(apiErr.retryable).toBe(true);
        return true;
      });
    });

    it('handles network failure (fetch throws) as status 0 HandshakeApiError', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Connection refused');
      }) as unknown as typeof fetch;

      const client = new HandshakeApiClient({ baseUrl: 'http://localhost:8787', fetch: mockFetch });

      await expect(client.healthz()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HandshakeApiError);
        const apiErr = err as HandshakeApiError;
        expect(apiErr.status).toBe(0);
        expect(apiErr.message).toBe('Connection refused');
        return true;
      });
    });
  });
});
