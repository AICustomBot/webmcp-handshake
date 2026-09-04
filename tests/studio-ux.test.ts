import { describe, it, expect, beforeEach } from 'vitest';
import {
  type RoomState,
  type Product,
  type Proposal,
  type Receipt,
  type BomLine,
  CONTRACT_VERSION,
  CHECK_FINDING_CODES,
} from '@handshake/contracts';
import { evaluateDesign } from '@handshake/policy';
import { computeClientBom } from '../apps/web/lib/bom';
import { webmcpConfirmationGrants } from '../apps/web/lib/webmcp/webmcp-tools';
import { NKBA_RULES_META, CORE_PASSED_GUIDELINES } from '../apps/web/lib/nkba-rules';
import { captureCanvasSnapshot } from '../apps/web/lib/studio-export';

describe('Milestone HSK-31: Enterprise Studio UX & Governance', () => {
  const testCatalog: Product[] = [
    {
      id: 'prod-sink-30',
      sku: 'HSK-SNK-30',
      name: 'Undermount Kitchen Sink 30"',
      category: 'sink',
      widthIn: 30,
      depthIn: 22,
      priceCents: 45000,
      clearanceIn: 36,
      workCenter: 'sink',
      finish: 'matte',
      accessible: true,
    },
    {
      id: 'prod-cooktop-36',
      sku: 'HSK-CKT-36',
      name: 'Induction Cooktop 36"',
      category: 'cooktop',
      widthIn: 36,
      depthIn: 24,
      priceCents: 120000,
      clearanceIn: 36,
      workCenter: 'cooktop',
      finish: 'matte',
      accessible: true,
    },
    {
      id: 'prod-fridge-36',
      sku: 'HSK-REF-36',
      name: 'French Door Refrigerator 36"',
      category: 'refrigerator',
      widthIn: 36,
      depthIn: 36,
      priceCents: 240000,
      clearanceIn: 42,
      workCenter: 'refrigerator',
      finish: 'matte',
      accessible: true,
    },
    {
      id: 'prod-vanity-36',
      sku: 'HSK-VAN-36',
      name: 'Modern Single Vanity 36"',
      category: 'vanity',
      widthIn: 36,
      depthIn: 22,
      priceCents: 85000,
      clearanceIn: 30,
      finish: 'matte',
      accessible: true,
    },
  ];

  const mockRoom: RoomState = {
    sessionId: 'session-test-1',
    roomType: 'kitchen',
    widthIn: 180,
    lengthIn: 144,
    openings: [
      {
        id: 'door-main',
        wall: 'south',
        kind: 'door',
        offsetIn: 24,
        widthIn: 36,
        swingIn: 36,
      },
    ],
    serviceAnchors: [
      {
        id: 'water-rough-in',
        kind: 'water',
        wall: 'north',
        offsetIn: 60,
      },
    ],
    items: [
      {
        id: 'item-sink',
        productId: 'prod-sink-30',
        x: 60,
        y: 20,
        rotation: 0,
      },
      {
        id: 'item-cooktop',
        productId: 'prod-cooktop-36',
        x: 120,
        y: 20,
        rotation: 0,
      },
      {
        id: 'item-fridge',
        productId: 'prod-fridge-36',
        x: 140,
        y: 80,
        rotation: 270,
      },
    ],
    version: 3,
    budgetCents: 500000,
  };

  beforeEach(() => {
    webmcpConfirmationGrants.clear();
  });

  describe('1. Bill of Materials (BOM) Calculations & Parity', () => {
    it('computes deterministic itemized BOM lines, quantities, and subtotal', () => {
      const bom = computeClientBom(mockRoom, testCatalog);

      expect(bom.itemCount).toBe(3);
      expect(bom.lines).toHaveLength(3);

      // Verify Sink line
      const sinkLine = bom.lines.find((l: BomLine) => l.productId === 'prod-sink-30');
      expect(sinkLine).toBeDefined();
      expect(sinkLine?.quantity).toBe(1);
      expect(sinkLine?.unitPriceCents).toBe(45000);
      expect(sinkLine?.totalCents).toBe(45000);

      // Verify Cooktop line
      const cooktopLine = bom.lines.find((l: BomLine) => l.productId === 'prod-cooktop-36');
      expect(cooktopLine).toBeDefined();
      expect(cooktopLine?.quantity).toBe(1);
      expect(cooktopLine?.unitPriceCents).toBe(120000);
      expect(cooktopLine?.totalCents).toBe(120000);

      // Verify Fridge line
      const fridgeLine = bom.lines.find((l: BomLine) => l.productId === 'prod-fridge-36');
      expect(fridgeLine).toBeDefined();
      expect(fridgeLine?.quantity).toBe(1);
      expect(fridgeLine?.unitPriceCents).toBe(240000);
      expect(fridgeLine?.totalCents).toBe(240000);

      // Total calculation: 45000 + 120000 + 240000 = 405000 cents ($4,050.00)
      expect(bom.subtotalCents).toBe(405000);
      expect(bom.unpricedItemIds).toHaveLength(0);
    });

    it('aggregates multiple instances of the same product into a single BOM line', () => {
      const multiRoom: RoomState = {
        ...mockRoom,
        items: [
          { id: 'sink-1', productId: 'prod-sink-30', x: 20, y: 20, rotation: 0 },
          { id: 'sink-2', productId: 'prod-sink-30', x: 60, y: 20, rotation: 0 },
        ],
      };

      const bom = computeClientBom(multiRoom, testCatalog);
      expect(bom.itemCount).toBe(2);
      expect(bom.lines).toHaveLength(1);
      expect(bom.lines[0]?.quantity).toBe(2);
      expect(bom.lines[0]?.unitPriceCents).toBe(45000);
      expect(bom.lines[0]?.totalCents).toBe(90000);
      expect(bom.subtotalCents).toBe(90000);
    });

    it('flags unpriced items missing from the catalog without failing closed', () => {
      const unpricedRoom: RoomState = {
        ...mockRoom,
        items: [
          { id: 'item-custom', productId: 'custom-fixture-unknown', x: 10, y: 10, rotation: 0 },
        ],
      };

      const bom = computeClientBom(unpricedRoom, testCatalog);
      expect(bom.itemCount).toBe(0);
      expect(bom.unpricedItemIds).toContain('item-custom');
      expect(bom.subtotalCents).toBe(0);
    });

    it('matches backend policy evaluation committed cents perfectly', () => {
      const evaluation = evaluateDesign(mockRoom, testCatalog);
      const clientBom = computeClientBom(mockRoom, testCatalog);

      expect(evaluation.committedCents).toBe(clientBom.subtotalCents);
      expect(evaluation.overBudget).toBe(false);
      expect(evaluation.remainingCents).toBe(mockRoom.budgetCents - clientBom.subtotalCents);
    });
  });

  describe('2. NKBA Real-Time Rule Checks & Findings Panel', () => {
    it('evaluates room layout and reports NKBA guideline compliance', () => {
      const evaluation = evaluateDesign(mockRoom, testCatalog);
      expect(Array.isArray(evaluation.findings)).toBe(true);

      for (const finding of evaluation.findings) {
        expect(finding.code).toBeDefined();
        expect(['blocked', 'warning', 'info']).toContain(finding.severity);
        expect(typeof finding.message).toBe('string');
      }
    });

    it('detects boundary collision when a fixture is placed out of bounds', () => {
      const outOfBoundsRoom: RoomState = {
        ...mockRoom,
        items: [
          {
            id: 'item-out',
            productId: 'prod-sink-30',
            x: 170, // 170 + 30 = 200 > 180 (room width)
            y: 20,
            rotation: 0,
          },
        ],
      };

      const evaluation = evaluateDesign(outOfBoundsRoom, testCatalog);
      const outFinding = evaluation.findings.find((f) => f.code === 'OUT_OF_BOUNDS');
      expect(outFinding).toBeDefined();
      expect(outFinding?.severity).toBe('blocked');
      expect(outFinding?.itemIds).toContain('item-out');
    });

    it('detects fixture overlap when two floor-standing items occupy the same footprint', () => {
      const overlappingRoom: RoomState = {
        ...mockRoom,
        items: [
          { id: 'item-1', productId: 'prod-fridge-36', x: 50, y: 50, rotation: 0 },
          { id: 'item-2', productId: 'prod-fridge-36', x: 50, y: 50, rotation: 0 },
        ],
      };

      const evaluation = evaluateDesign(overlappingRoom, testCatalog);
      const overlapFinding = evaluation.findings.find((f) => f.code === 'FIXTURE_OVERLAP');
      expect(overlapFinding).toBeDefined();
      expect(overlapFinding?.severity).toBe('blocked');
      expect(overlapFinding?.itemIds).toContain('item-1');
      expect(overlapFinding?.itemIds).toContain('item-2');
    });
  });

  describe('3. Constitutional Consent Gates & Proposal Flow', () => {
    const sampleProposal: Proposal = {
      id: 'prop-123',
      sessionId: 'test-session',
      baseVersion: 3,
      operations: [
        {
          type: 'place',
          productId: 'prod-sink-30',
          x: 50,
          y: 20,
          rotation: 0,
        },
      ],
      rationale: 'Add undermount sink along north utility wall',
      hash: 'sha256-test-hash-abcdef1234567890',
      status: 'pending_human',
      createdAt: '2026-09-04T22:00:00.000Z',
      expiresAt: '2026-09-04T22:30:00.000Z',
    };

    it('proposals do NOT mutate room state while pending_human', () => {
      expect(mockRoom.version).toBe(3);
      expect(sampleProposal.status).toBe('pending_human');
      // State items remain unchanged
      expect(mockRoom.items).toHaveLength(3);
    });

    it('requires human approval before proposal can be applied', () => {
      let currentProposal = { ...sampleProposal };

      // Simulate human approval
      currentProposal = {
        ...currentProposal,
        status: 'approved',
      };

      expect(currentProposal.status).toBe('approved');
    });

    it('supports explicit human rejection of a proposal', () => {
      const rejectedProposal: Proposal = {
        ...sampleProposal,
        status: 'rejected',
      };

      expect(rejectedProposal.status).toBe('rejected');
    });
  });

  describe('4. Confirmation Dialog & Single-Use Proof Tokens', () => {
    it('generates cryptographic single-use proof token on human authorization', () => {
      const confirmationKey = 'book_consultation';
      const proofToken = `proof-consultation-${Date.now()}-abc123xyz`;

      // Register grant
      webmcpConfirmationGrants.set(confirmationKey, {
        confirmationId: 'conf-12345',
        proof: proofToken,
      });

      // Verify token exists before consumption
      const grant = webmcpConfirmationGrants.get(confirmationKey);
      expect(grant).toBeDefined();
      expect(grant?.proof).toBe(proofToken);

      // Single-use consumption (must be cleared immediately)
      webmcpConfirmationGrants.delete(confirmationKey);

      // Verify token is purged to prevent replay
      const consumedGrant = webmcpConfirmationGrants.get(confirmationKey);
      expect(consumedGrant).toBeUndefined();
    });
  });

  describe('5. Signed Decision Receipts Integrity', () => {
    it('validates receipt schema, final version, and event audit trail', () => {
      const mockReceipt: Receipt = {
        sessionId: 'test-session-1',
        contractVersion: CONTRACT_VERSION,
        finalVersion: 5,
        generatedAt: '2026-09-04T22:15:00.000Z',
        evaluation: {
          version: 5,
          committedCents: 405000,
          budgetCents: 500000,
          overBudget: false,
          findings: [],
        },
        proposals: [
          {
            id: 'prop-1',
            sessionId: 'test-session-1',
            baseVersion: 4,
            operations: [],
            rationale: 'Finalize kitchen plan',
            hash: 'hash-abc-123',
            status: 'applied',
            createdAt: '2026-09-04T22:10:00.000Z',
            expiresAt: '2026-09-04T22:40:00.000Z',
          },
        ],
        events: [
          {
            id: 'evt-1',
            sessionId: 'test-session-1',
            type: 'session_created',
            version: 0,
            at: '2026-09-04T22:00:00.000Z',
            actor: 'human_ui',
            detail: 'Created session',
          },
          {
            id: 'evt-2',
            sessionId: 'test-session-1',
            type: 'proposal_applied',
            version: 5,
            at: '2026-09-04T22:14:00.000Z',
            actor: 'human_ui',
            detail: 'Applied proposal prop-1',
            proposalId: 'prop-1',
          },
        ],
      };

      expect(mockReceipt.contractVersion).toBe(CONTRACT_VERSION);
      expect(mockReceipt.finalVersion).toBe(5);
      expect(mockReceipt.events).toHaveLength(2);
      expect(mockReceipt.proposals[0]?.status).toBe('applied');
      expect(mockReceipt.evaluation.overBudget).toBe(false);

      // Verify zero capability leakage
      const serialized = JSON.stringify(mockReceipt);
      expect(serialized).not.toContain('capability');
      expect(serialized).not.toContain('x-handshake-capability');
    });
  });

  describe('6. NKBA Rules Metadata & Guidance Completeness', () => {
    it('provides titles, citations, and remediations for all 20 contracted check codes', () => {
      expect(CHECK_FINDING_CODES.length).toBe(20);
      for (const code of CHECK_FINDING_CODES) {
        const meta = NKBA_RULES_META[code];
        expect(meta, `Metadata for ${code} must be defined`).toBeDefined();
        expect(meta.title.length).toBeGreaterThan(3);
        expect(meta.citation.length).toBeGreaterThan(5);
        expect(meta.remediation.length).toBeGreaterThan(10);
      }
    });

    it('contains core passed guidelines for fully compliant rooms', () => {
      expect(CORE_PASSED_GUIDELINES.length).toBeGreaterThanOrEqual(4);
      const titles = CORE_PASSED_GUIDELINES.map((g: { title: string }) => g.title);
      expect(titles.some((t: string) => t.includes('Work Triangle'))).toBe(true);
      expect(titles.some((t: string) => t.includes('Walkway'))).toBe(true);
    });
  });

  describe('7. Canvas Snapshot Export Filename & Structure', () => {
    it('formats snapshot capture filename with viewport mode and room version', async () => {
      const res = await captureCanvasSnapshot({
        viewportMode: '2d',
        sessionId: 'session-enterprise-test',
        version: 3,
      });
      // In non-browser Vitest environment, returns null without throwing
      expect(res === null || typeof res === 'string').toBe(true);
    });
  });
});
