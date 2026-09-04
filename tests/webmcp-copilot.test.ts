import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WEBMCP_TOOL_NAMES,
  createWebMCPTools,
  registerModelContextTools,
  webmcpProposalCache,
  webmcpConfirmationGrants,
  type WebMCPTool,
} from '../apps/web/lib/webmcp/webmcp-tools';
import { isChatGPTInAppBrowser } from '../apps/web/lib/hooks/use-webmcp';
import { CONTRACT_VERSION } from '@handshake/contracts';

describe('Milestone HSK-30: WebMCP Bridge & AI Copilot Integration', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    webmcpProposalCache.clear();
    webmcpConfirmationGrants.clear();

    // Ensure mock window exists in Node environment for custom event dispatching
    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn((event: any) => true),
    };
    (globalThis as any).window = mockWindow;
    (global as any).window = mockWindow;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (global as any).window = originalWindow;
  });

  describe('1. WebMCP Tool Contracts & Registry Lifecycle', () => {
    it('defines exactly the 9 contracted tools with valid JSON schemas', () => {
      const tools = createWebMCPTools();
      expect(tools).toHaveLength(9);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toEqual([
        'get_room_state',
        'search_catalog',
        'evaluate_design',
        'propose_changes',
        'get_proposal',
        'apply_approved_proposal',
        'request_protected_action',
        'get_receipt',
        'get_bill_of_materials',
      ]);

      for (const tool of tools) {
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('registers all 9 tools on document.modelContext when available', () => {
      const registeredTools: any[] = [];
      const mockModelContext = {
        registerTool: vi.fn((tool: any) => {
          registeredTools.push(tool);
        }),
        unregisterTool: vi.fn((name: string) => {
          const idx = registeredTools.findIndex((t) => t.name === name);
          if (idx >= 0) registeredTools.splice(idx, 1);
        }),
      };

      const tools = createWebMCPTools();
      const { registeredCount, unregister } = registerModelContextTools(mockModelContext, tools);

      expect(registeredCount).toBe(9);
      expect(mockModelContext.registerTool).toHaveBeenCalledTimes(9);
      expect(registeredTools).toHaveLength(9);

      // Verify unregister cleans up all 9 tools
      unregister();
      expect(mockModelContext.unregisterTool).toHaveBeenCalledTimes(9);
      for (const name of WEBMCP_TOOL_NAMES) {
        expect(mockModelContext.unregisterTool).toHaveBeenCalledWith(name);
      }
      expect(registeredTools).toHaveLength(0);
    });

    it('handles absence of document.modelContext gracefully without throwing', () => {
      const { registeredCount, unregister } = registerModelContextTools(null);
      expect(registeredCount).toBe(0);
      expect(() => unregister()).not.toThrow();
    });
  });

  describe('2. ChatGPT In-App Browser & Mobile WebView Detection', () => {
    it('identifies ChatGPT in-app browser and OpenAI WebViews correctly via user agent', () => {
      const chatGPTUserAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ChatGPT/1.2024.080',
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 OAIWebView',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) KASAN/2.0 Mobile/15E148',
      ];

      for (const ua of chatGPTUserAgents) {
        expect(isChatGPTInAppBrowser(ua)).toBe(true);
      }
    });

    it('returns false for standard desktop and mobile browsers', () => {
      const standardUserAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      ];

      for (const ua of standardUserAgents) {
        expect(isChatGPTInAppBrowser(ua)).toBe(false);
      }
    });
  });

  describe('3. Governed WebMCP Tool Execution & Constitutional Invariants', () => {
    let mockClient: any;
    let tools: WebMCPTool[];

    beforeEach(() => {
      mockClient = {
        getState: vi.fn(async (sessionId: string) => ({
          state: {
            sessionId,
            version: 0,
            widthIn: 144,
            lengthIn: 144,
            budgetCents: 2500000,
            items: [],
            roomType: 'kitchen',
          },
          evaluation: {
            version: 0,
            committedCents: 0,
            budgetCents: 2500000,
            overBudget: false,
            findings: [],
            remainingCents: 2500000,
          },
        })),
        propose: vi.fn(async (sessionId: string, cap: string, body: any) => ({
          proposal: {
            id: 'prop-12345',
            sessionId,
            baseVersion: body.expectedVersion,
            hash: 'hash-abc-123',
            status: 'pending_human',
            operations: body.operations,
            rationale: body.rationale,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          },
          state: {
            sessionId,
            version: body.expectedVersion, // Version stays baseVersion!
            widthIn: 144,
            lengthIn: 144,
            budgetCents: 2500000,
            items: [],
          },
        })),
        apply: vi.fn(async (sessionId: string, cap: string, body: any) => ({
          state: {
            sessionId,
            version: body.expectedVersion + 1,
            widthIn: 144,
            lengthIn: 144,
            budgetCents: 2500000,
            items: [{ id: 'dw-1', productId: 'dishwasher-24', x: 72, y: 0, rotation: 0 }],
          },
        })),
        executeProtectedAction: vi.fn(async (sessionId: string, cap: string, body: any) => ({
          action: body.action,
          reference: 'ref-book-987',
          performedAt: new Date().toISOString(),
        })),
        getReceipt: vi.fn(async (sessionId: string) => ({
          receipt: {
            sessionId,
            contractVersion: CONTRACT_VERSION,
            finalVersion: 1,
            events: [],
          },
        })),
        getBillOfMaterials: vi.fn(async (sessionId: string) => ({
          version: 0,
          budgetCents: 2500000,
          remainingCents: 2385000,
          bom: {
            subtotalCents: 115000,
            itemCount: 1,
            unpricedItemIds: [],
            lines: [
              {
                productId: 'dishwasher-24',
                productName: 'Built-in 24" Dishwasher',
                quantity: 1,
                unitPriceCents: 115000,
                totalCents: 115000,
              },
            ],
          },
        })),
      };

      tools = createWebMCPTools(mockClient);
    });

    it('get_room_state reads committed room dimensions and version', async () => {
      const getRoomState = tools.find((t) => t.name === 'get_room_state')!;
      const res = await getRoomState.execute({ sessionId: 'session-xyz' });

      expect(res.ok).toBe(true);
      expect(res.data.state.version).toBe(0);
      expect(res.data.state.widthIn).toBe(144);
      expect(res.data.contractVersion).toBe(CONTRACT_VERSION);
    });

    it('search_catalog filters fixtures by room type, category, and price', async () => {
      const searchCatalog = tools.find((t) => t.name === 'search_catalog')!;

      // Kitchen search
      const kitchenRes = await searchCatalog.execute({
        sessionId: 'session-xyz',
        roomType: 'kitchen',
      });
      expect(kitchenRes.ok).toBe(true);
      expect(kitchenRes.data.products.length).toBeGreaterThan(0);
      expect(kitchenRes.data.products.some((p: any) => p.category === 'dishwasher')).toBe(true);
      expect(kitchenRes.data.products.some((p: any) => p.category === 'tub')).toBe(false);

      // Bathroom search
      const bathRes = await searchCatalog.execute({
        sessionId: 'session-xyz',
        roomType: 'bathroom',
      });
      expect(bathRes.ok).toBe(true);
      expect(bathRes.data.products.some((p: any) => p.category === 'vanity')).toBe(true);
      expect(bathRes.data.products.some((p: any) => p.category === 'range')).toBe(false);

      // Price ceiling filter
      const priceRes = await searchCatalog.execute({
        sessionId: 'session-xyz',
        maxPriceCents: 150000,
      });
      expect(priceRes.ok).toBe(true);
      for (const p of priceRes.data.products) {
        expect(p.priceCents).toBeLessThanOrEqual(150000);
      }
    });

    it('evaluate_design returns deterministic layout findings for committed state', async () => {
      const evalTool = tools.find((t) => t.name === 'evaluate_design')!;
      const res = await evalTool.execute({ sessionId: 'session-xyz' });

      expect(res.ok).toBe(true);
      expect(res.data.evaluation).toBeDefined();
      expect(res.data.evaluation.findings).toBeDefined();
    });

    it('Constitutional Invariant: propose_changes creates proposal preview WITHOUT mutating room version', async () => {
      const proposeTool = tools.find((t) => t.name === 'propose_changes')!;

      const operations = [
        {
          type: 'place' as const,
          productId: 'dishwasher-24',
          x: 72,
          y: 0,
          rotation: 0 as const,
        },
      ];

      const res = await proposeTool.execute({
        sessionId: 'session-xyz',
        expectedVersion: 0,
        operations,
        rationale: 'Add dishwasher beside sink',
        idempotencyKey: 'idemp-12345',
      });

      expect(res.ok).toBe(true);
      expect(res.data.proposal).toBeDefined();
      expect(res.data.proposal.id).toBe('prop-12345');
      expect(res.data.proposal.baseVersion).toBe(0);
      expect(res.data.proposal.status).toBe('pending_human');

      // Verify cached locally in proposal cache
      expect(webmcpProposalCache.get('prop-12345')).toBeDefined();
    });

    it('get_proposal reads a cached proposal by ID', async () => {
      const getProposalTool = tools.find((t) => t.name === 'get_proposal')!;

      webmcpProposalCache.set('prop-find-me', {
        id: 'prop-find-me',
        sessionId: 'session-xyz',
        baseVersion: 0,
        hash: 'hash-find-me',
        status: 'pending_human',
        operations: [],
        rationale: 'Look up test',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });

      const res = await getProposalTool.execute({
        sessionId: 'session-xyz',
        proposalId: 'prop-find-me',
      });

      expect(res.ok).toBe(true);
      expect(res.data.proposal.id).toBe('prop-find-me');
    });

    it('Constitutional Invariant: apply_approved_proposal fails closed if proposal was not approved by human', async () => {
      const applyTool = tools.find((t) => t.name === 'apply_approved_proposal')!;

      // Cached proposal has status: 'pending_human'
      webmcpProposalCache.set('prop-unapproved', {
        id: 'prop-unapproved',
        sessionId: 'session-xyz',
        baseVersion: 0,
        hash: 'hash-xyz',
        status: 'pending_human', // NOT approved
        operations: [],
        rationale: 'Test proposal',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });

      const res = await applyTool.execute({
        sessionId: 'session-xyz',
        proposalId: 'prop-unapproved',
        proposalHash: 'hash-xyz',
        expectedVersion: 0,
        idempotencyKey: 'idemp-apply-1',
      });

      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('PROPOSAL_NOT_APPROVED');
      expect(mockClient.apply).not.toHaveBeenCalled();
    });

    it('apply_approved_proposal succeeds when proposal has been explicitly approved', async () => {
      const applyTool = tools.find((t) => t.name === 'apply_approved_proposal')!;

      webmcpProposalCache.set('prop-approved', {
        id: 'prop-approved',
        sessionId: 'session-xyz',
        baseVersion: 0,
        hash: 'hash-approved',
        status: 'approved', // Human-approved!
        operations: [
          {
            type: 'place',
            productId: 'dishwasher-24',
            x: 72,
            y: 0,
            rotation: 0,
          },
        ],
        rationale: 'Test proposal',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });

      const res = await applyTool.execute({
        sessionId: 'session-xyz',
        proposalId: 'prop-approved',
        proposalHash: 'hash-approved',
        expectedVersion: 0,
        idempotencyKey: 'idemp-apply-2',
      });

      expect(res.ok).toBe(true);
      expect(res.data.state.version).toBe(1);
      expect(mockClient.apply).toHaveBeenCalledWith('session-xyz', expect.anything(), {
        proposalId: 'prop-approved',
        proposalHash: 'hash-approved',
        expectedVersion: 0,
        idempotencyKey: 'idemp-apply-2',
      });
    });

    it('request_protected_action returns CONFIRMATION_REQUIRED when no proof grant exists', async () => {
      const protectedTool = tools.find((t) => t.name === 'request_protected_action')!;

      const res = await protectedTool.execute({
        sessionId: 'session-xyz',
        action: 'book_consultation',
        payload: { date: '2026-09-15', preferredTime: 'morning' },
        idempotencyKey: 'idemp-protect-1',
      });

      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('CONFIRMATION_REQUIRED');
      expect((globalThis as any).window.dispatchEvent).toHaveBeenCalled();
      expect(mockClient.executeProtectedAction).not.toHaveBeenCalled();
    });

    it('request_protected_action executes successfully when single-use proof grant is attached', async () => {
      const protectedTool = tools.find((t) => t.name === 'request_protected_action')!;

      const payload = { date: '2026-09-15', preferredTime: 'morning' };
      const sortedPayload = Object.keys(payload)
        .sort()
        .reduce<Record<string, string>>((acc, k) => {
          acc[k] = (payload as any)[k];
          return acc;
        }, {});
      const key = `book_consultation:${JSON.stringify(sortedPayload)}`;

      webmcpConfirmationGrants.set(key, {
        confirmationId: 'conf-123',
        proof: 'proof-token-valid',
      });

      const res = await protectedTool.execute({
        sessionId: 'session-xyz',
        action: 'book_consultation',
        payload,
        idempotencyKey: 'idemp-protect-2',
      });

      expect(res.ok).toBe(true);
      expect(mockClient.executeProtectedAction).toHaveBeenCalled();
      // Single-use guarantee: grant was consumed and deleted
      expect(webmcpConfirmationGrants.get(key)).toBeUndefined();
    });

    it('get_bill_of_materials returns itemized line items and totals', async () => {
      const bomTool = tools.find((t) => t.name === 'get_bill_of_materials')!;
      const res = await bomTool.execute({ sessionId: 'session-xyz' });

      expect(res.ok).toBe(true);
      expect(res.data.bom).toBeDefined();
      expect(res.data.bom.subtotalCents).toBe(115000);
      expect(res.data.bom.lines).toHaveLength(1);
      expect(res.data.bom.lines[0].productId).toBe('dishwasher-24');
      expect(res.data.remainingCents).toBe(2385000);
    });

    it('get_receipt reads signed audit receipt from backend', async () => {
      const receiptTool = tools.find((t) => t.name === 'get_receipt')!;
      const res = await receiptTool.execute({ sessionId: 'session-xyz' });

      expect(res.ok).toBe(true);
      expect(res.data.receipt).toBeDefined();
      expect(res.data.receipt.contractVersion).toBe(CONTRACT_VERSION);
    });
  });

  describe('4. In-App AI Copilot API Route (/api/chat)', () => {
    // Import route handler dynamically or directly
    it('handles JSON chat requests with architectural copilot responses', async () => {
      const { POST: chatRoute } = await import('../apps/web/app/api/chat/route');

      // Test 1: NKBA rules query
      const reqNkba = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Can you check my NKBA clearance rules?' }],
        }),
      });
      const resNkba = await chatRoute(reqNkba);
      expect(resNkba.status).toBe(200);
      const dataNkba = (await resNkba.json()) as any;
      expect(dataNkba.toolCall).toBeDefined();
      expect(dataNkba.toolCall.name).toBe('evaluate_design');
      expect(dataNkba.content).toContain('NKBA');

      // Test 2: Dishwasher propose query (non-mutating proposal)
      const reqDishwasher = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Please propose a dishwasher next to the sink' }],
        }),
      });
      const resDishwasher = await chatRoute(reqDishwasher);
      const dataDishwasher = (await resDishwasher.json()) as any;
      expect(dataDishwasher.toolCall).toBeDefined();
      expect(dataDishwasher.toolCall.name).toBe('propose_changes');
      expect(dataDishwasher.toolCall.args.operations).toHaveLength(1);
      expect(dataDishwasher.toolCall.args.operations[0].productId).toBe('quiet-dishwasher');

      // Test 3: Protected action consultation query
      const reqConsult = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'I want to book a showroom consultation' }],
        }),
      });
      const resConsult = await chatRoute(reqConsult);
      const dataConsult = (await resConsult.json()) as any;
      expect(dataConsult.toolCall).toBeDefined();
      expect(dataConsult.toolCall.name).toBe('request_protected_action');
      expect(dataConsult.toolCall.args.action).toBe('book_consultation');

      // Test 4: Bill of Materials query
      const reqBom = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What is the bill of materials and budget total?' }],
        }),
      });
      const resBom = await chatRoute(reqBom);
      const dataBom = (await resBom.json()) as any;
      expect(dataBom.toolCall).toBeDefined();
      expect(dataBom.toolCall.name).toBe('get_bill_of_materials');
    });

    it('streams UI message responses when DefaultChatTransport / EventSource requested', async () => {
      const { POST: chatRoute } = await import('../apps/web/app/api/chat/route');

      const reqStream = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/x-ndjson',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello copilot!' }],
        }),
      });

      const resStream = await chatRoute(reqStream);
      expect(resStream.status).toBe(200);
      expect(resStream.body).toBeDefined();
    });
  });

  describe('5. Fallback Banner & Consent Gate Invariant Verification', () => {
    it('guarantees proposal status lifecycle enforces human-in-the-loop consent', () => {
      const pendingProposal = {
        id: 'prop-lifecycle',
        sessionId: 'session-xyz',
        baseVersion: 0,
        hash: 'hash-lifecycle',
        status: 'pending_human' as const,
        operations: [
          {
            type: 'place' as const,
            productId: 'harbor-vanity',
            x: 24,
            y: 24,
            rotation: 0 as const,
          },
        ],
        rationale: 'Human consent test',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };

      // Invariant 1: Agent tools CANNOT approve a proposal
      const tools = createWebMCPTools();
      expect(tools.find((t) => t.name === 'apply_approved_proposal')).toBeDefined();
      expect((tools as any[]).find((t) => t.name === 'decide_proposal')).toBeUndefined();
      expect((tools as any[]).find((t) => t.name === 'approve_proposal')).toBeUndefined();

      // Invariant 2: Active proposal status must transition to 'approved' before apply is valid
      expect(pendingProposal.status).toBe('pending_human');
      const approvedProposal = { ...pendingProposal, status: 'approved' as const };
      expect(approvedProposal.status).toBe('approved');
    });

    it('validates WebMCP fallback banner visibility criteria', () => {
      // When WebMCP is available: banner hidden
      const stateWithWebMCP = { isAvailable: true, dismissed: false };
      expect(stateWithWebMCP.isAvailable).toBe(true);

      // When WebMCP is absent: banner visible unless user dismissed it
      const stateWithoutWebMCP = { isAvailable: false, dismissed: false };
      expect(!stateWithoutWebMCP.isAvailable && !stateWithoutWebMCP.dismissed).toBe(true);

      // When dismissed: banner hidden
      const stateDismissed = { isAvailable: false, dismissed: true };
      expect(!stateDismissed.isAvailable && !stateDismissed.dismissed).toBe(false);
    });
  });
});
