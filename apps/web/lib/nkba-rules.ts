import type { CheckFindingCode } from '@handshake/contracts';

export interface FindingRuleMeta {
  title: string;
  citation: string;
  remediation: string;
}

export interface PassedGuideline {
  id: string;
  title: string;
  citation: string;
  detail: string;
}

export const NKBA_RULES_META: Record<CheckFindingCode, FindingRuleMeta> = {
  UNKNOWN_PRODUCT: {
    title: 'Unknown Catalog Product',
    citation: 'Handshake Catalog Specification § 2.1',
    remediation: 'Select a verified fixture SKU from the official catalog.',
  },
  OUT_OF_BOUNDS: {
    title: 'Fixture Outside Room Boundary',
    citation: 'NKBA Guideline 01: Architectural Boundary Clearance',
    remediation: 'Reposition the fixture so its bounding box lies entirely within room walls.',
  },
  FIXTURE_OVERLAP: {
    title: 'Fixture Geometric Collision',
    citation: 'NKBA Guideline 02: Clear Floor Space & Separation',
    remediation: 'Separate intersecting fixtures by at least 12" to resolve physical overlap.',
  },
  CLEARANCE_WARNING: {
    title: 'Front Work Clearance Encroachment',
    citation: 'NKBA Guideline 08: Front Appliance & Fixture Clearance',
    remediation: 'Maintain recommended clear floor space (≥ 36" or 42") in front of the fixture.',
  },
  OVER_BUDGET: {
    title: 'Total Project Budget Exceeded',
    citation: 'Handshake Financial Governance § 1.4',
    remediation:
      'Remove optional fixtures or replace premium appliances with budget-friendly alternatives.',
  },
  CATEGORY_ROOM_MISMATCH: {
    title: 'Room & Category Mismatch',
    citation: 'NKBA Guideline 00: Domain Typology Verification',
    remediation: 'Place bath fixtures in bathrooms and kitchen appliances in kitchens.',
  },
  DOOR_BLOCKED: {
    title: 'Door Swing Path Obstruction',
    citation: 'NKBA Kitchen Guideline 01: Door & Passage Clearance',
    remediation:
      'Relocate fixtures outside the 90-degree door swing arc to prevent door collision.',
  },
  OPENING_INVALID: {
    title: 'Wall Opening Placement Invalid',
    citation: 'NKBA Architectural Specification § 3.2',
    remediation:
      'Position doors and windows within room wall bounds with at least 6" corner clearance.',
  },
  APPLIANCE_DOOR_CONFLICT: {
    title: 'Appliance Door Interference',
    citation: 'NKBA Kitchen Guideline 02: Door Swing Interference',
    remediation: 'Ensure opposing cabinet doors and appliance doors do not intersect when open.',
  },
  WORK_TRIANGLE_TOO_LARGE: {
    title: 'Work Triangle Perimeter Exceeded',
    citation: 'NKBA Kitchen Guideline 03: Work Triangle Distance',
    remediation:
      'Move sink, cooktop, or refrigerator closer so the 3-leg perimeter totals ≤ 312" (26 ft).',
  },
  WORK_TRIANGLE_TOO_SMALL: {
    title: 'Work Triangle Too Constricted',
    citation: 'NKBA Kitchen Guideline 03: Work Triangle Distance',
    remediation: 'Space work centers further apart so the total perimeter is ≥ 156" (13 ft).',
  },
  WORK_TRIANGLE_LEG_INVALID: {
    title: 'Work Triangle Leg Distance Violation',
    citation: 'NKBA Kitchen Guideline 03: Individual Triangle Legs',
    remediation:
      'Adjust work center spacing so every individual leg measures between 48" (4 ft) and 108" (9 ft).',
  },
  MISSING_WORK_CENTER: {
    title: 'Missing Kitchen Work Center',
    citation: 'NKBA Kitchen Guideline 03: Primary Work Centers',
    remediation:
      'Place the missing work center (Sink, Cooktop/Range, or Refrigerator) to complete the layout.',
  },
  WORK_AISLE_TOO_NARROW: {
    title: 'Work Aisle Clearance Restricted',
    citation: 'NKBA Kitchen Guideline 04: Work Aisle Width',
    remediation:
      'Provide at least 42" of aisle clearance for a single cook, or 48" for multiple cooks.',
  },
  WALKWAY_TOO_NARROW: {
    title: 'Primary Walkway Restricted',
    citation: 'NKBA Kitchen Guideline 05: Walkway Circulation',
    remediation:
      'Ensure general circulation paths maintain at least 36" of clear, unobstructed width.',
  },
  MISSING_LANDING_AREA: {
    title: 'Appliance Landing Counter Insufficient',
    citation: 'NKBA Kitchen Guidelines 06 & 07: Appliance Landing Space',
    remediation: 'Provide continuous counter space adjacent to the appliance (15"-24" minimum).',
  },
  DISHWASHER_TOO_FAR_FROM_SINK: {
    title: 'Dishwasher Too Far From Sink Basin',
    citation: 'NKBA Kitchen Guideline 13: Dishwasher Placement',
    remediation: 'Position the dishwasher within 36" of the cleanup sink basin edge.',
  },
  CORNER_DEAD_ZONE: {
    title: 'Inaccessible Corner Space',
    citation: 'NKBA Kitchen Guideline 10: Corner Cabinet Access',
    remediation:
      'Incorporate corner carousels or diagonal sinks to make corner storage accessible.',
  },
  MISSING_SERVICE_ANCHOR: {
    title: 'Missing Utility Service Anchor',
    citation: 'NKBA Guideline 21: Utility Rough-in Proximity',
    remediation:
      'Relocate plumbed or high-voltage appliances within 48" of their utility rough-in.',
  },
  NO_TURNING_SPACE: {
    title: 'Turning Space Clearance Insufficient',
    citation: 'NKBA Accessibility Guideline 01: Universal Turning Diameter',
    remediation:
      'Ensure a clear 60" turning circle or T-turn for accessible wheelchair circulation.',
  },
};

export const CORE_PASSED_GUIDELINES: PassedGuideline[] = [
  {
    id: 'pass-triangle',
    title: 'NKBA Work Triangle (13–26 ft)',
    citation: 'NKBA Kitchen Guideline 03',
    detail: 'Perimeter and individual leg distances satisfy optimal ergonomic work flow.',
  },
  {
    id: 'pass-walkway',
    title: 'Circulation Walkways (≥ 36")',
    citation: 'NKBA Kitchen Guideline 05',
    detail: 'Major circulation pathways maintain unencumbered floor space.',
  },
  {
    id: 'pass-clearance',
    title: 'Fixture & Appliance Front Clearance',
    citation: 'NKBA Guideline 08',
    detail: 'All placed fixtures provide required user clearance without boundary intrusion.',
  },
  {
    id: 'pass-budget',
    title: 'Financial Ceiling Verification',
    citation: 'Handshake Budget Policy § 1.4',
    detail: 'Committed and proposed fixtures remain within specified client capital allocation.',
  },
];
