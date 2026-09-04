import type {
  Product,
  ProductCategory,
  Proposal,
  RoomItem,
  RoomOpening,
  RoomState,
  Rotation,
  ServiceAnchor,
  ServiceKind,
  WallSide,
} from '@handshake/contracts';

/** Standard architectural constants */
export const WALL_THICKNESS = 4.5; // inches (nominal 2x4 framing + 1/2" drywall each side)
export const PERIMETER_MARGIN = 36; // inches (for dimension strings & leader ticks)

/** Pure Axis-Aligned Geometry Primitives for 2D Architectural Canvas */
export interface Footprint {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

/** Returns the unit vector an item at this rotation faces */
export function frontVector(rotation: Rotation): Vector {
  switch (rotation) {
    case 0:
      return { x: 0, y: 1 };
    case 90:
      return { x: -1, y: 0 };
    case 180:
      return { x: 0, y: -1 };
    case 270:
      return { x: 1, y: 0 };
  }
}

export function isQuarterTurned(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}

/** Returns the rotated floor footprint of an item */
export function footprintOf(item: RoomItem, product: Product): Footprint {
  const turned = isQuarterTurned(item.rotation);
  const width = turned ? product.depthIn : product.widthIn;
  const depth = turned ? product.widthIn : product.depthIn;
  return { left: item.x, top: item.y, right: item.x + width, bottom: item.y + depth };
}

/** Returns whether two open-edged floor rectangles overlap */
export function overlaps(a: Footprint, b: Footprint): boolean {
  if (a.right <= b.left || b.right <= a.left) return false;
  return !(a.bottom <= b.top || b.bottom <= a.top);
}

/** Returns whether a rectangle lies entirely inside the room */
export function fitsInsideRoom(state: RoomState, box: Footprint): boolean {
  if (box.left < 0 || box.top < 0) return false;
  return box.right <= state.widthIn && box.bottom <= state.lengthIn;
}

/** Returns the center point of a rectangle */
export function centerOf(box: Footprint): Point {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

/** Returns the straight-line distance between two points */
export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Returns the width of a rectangle */
export function widthOf(box: Footprint): number {
  return box.right - box.left;
}

/** Returns the depth of a rectangle */
export function depthOf(box: Footprint): number {
  return box.bottom - box.top;
}

export function stripBeside(box: Footprint, direction: Vector, depth: number): Footprint {
  if (direction.x === 0 && direction.y === 1) {
    return { left: box.left, top: box.bottom, right: box.right, bottom: box.bottom + depth };
  }
  if (direction.x === 0 && direction.y === -1) {
    return { left: box.left, top: box.top - depth, right: box.right, bottom: box.top };
  }
  if (direction.x === -1 && direction.y === 0) {
    return { left: box.left - depth, top: box.top, right: box.left, bottom: box.bottom };
  }
  return { left: box.right, top: box.top, right: box.right + depth, bottom: box.bottom };
}

/** Returns approach strip in front of a rotated fixture */
export function stripInFront(box: Footprint, rotation: Rotation, depth: number): Footprint {
  return stripBeside(box, frontVector(rotation), depth);
}

/** Returns the point on a wall at a given offset from origin corner */
export function pointOnWall(state: RoomState, wall: WallSide, offsetIn: number): Point {
  switch (wall) {
    case 'north':
      return { x: offsetIn, y: 0 };
    case 'south':
      return { x: offsetIn, y: state.lengthIn };
    case 'west':
      return { x: 0, y: offsetIn };
    case 'east':
      return { x: state.widthIn, y: offsetIn };
  }
}

/** Complete synthetic catalog fallback (16 synthetic items) */
export const FALLBACK_CATALOG: Product[] = [
  {
    id: 'harbor-vanity',
    name: 'Harbor vanity',
    category: 'vanity',
    finish: 'matte black',
    priceCents: 248000,
    widthIn: 36,
    depthIn: 21,
    heightIn: 34,
    clearanceIn: 30,
    accessible: true,
    sku: 'SYN-VAN-36-MB',
    mount: 'floor',
    doorSwingIn: 18,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'open-shower',
    name: 'Open-entry shower',
    category: 'shower',
    finish: 'clear glass',
    priceCents: 490000,
    widthIn: 42,
    depthIn: 42,
    heightIn: 84,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-SHW-42-CG',
    mount: 'floor',
    doorSwingIn: 0,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'compact-wc',
    name: 'Compact WC',
    category: 'toilet',
    finish: 'white',
    priceCents: 168000,
    widthIn: 20,
    depthIn: 29,
    heightIn: 30,
    clearanceIn: 30,
    accessible: false,
    sku: 'SYN-TOI-20-WH',
    mount: 'floor',
    doorSwingIn: 0,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'linen-tower',
    name: 'Linen tower',
    category: 'storage',
    finish: 'white oak',
    priceCents: 132000,
    widthIn: 18,
    depthIn: 16,
    heightIn: 72,
    clearanceIn: 24,
    accessible: true,
    sku: 'SYN-STR-18-WO',
    mount: 'floor',
    doorSwingIn: 16,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'french-door-fridge',
    name: 'Studio French-door refrigerator',
    category: 'refrigerator',
    finish: 'stainless',
    priceCents: 320000,
    widthIn: 36,
    depthIn: 32,
    heightIn: 70,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-REF-36-SS',
    mount: 'floor',
    workCenter: 'refrigerator',
    doorSwingIn: 30,
    requiresPlumbing: true,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 15,
    counterRun: false,
  },
  {
    id: 'undermount-sink',
    name: 'Undermount kitchen basin',
    category: 'sink',
    finish: 'stainless',
    priceCents: 95000,
    widthIn: 33,
    depthIn: 22,
    heightIn: 10,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-SNK-33-SS',
    mount: 'counter',
    workCenter: 'sink',
    doorSwingIn: 0,
    requiresPlumbing: true,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 24,
    landingRightIn: 18,
    counterRun: true,
  },
  {
    id: 'pro-gas-range',
    name: 'Pro-style convection range',
    category: 'range',
    finish: 'stainless',
    priceCents: 280000,
    widthIn: 30,
    depthIn: 26,
    heightIn: 36,
    clearanceIn: 40,
    accessible: false,
    sku: 'SYN-RNG-30-SS',
    mount: 'floor',
    workCenter: 'cooktop',
    doorSwingIn: 24,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: true,
    landingLeftIn: 15,
    landingRightIn: 12,
    counterRun: false,
  },
  {
    id: 'quiet-dishwasher',
    name: 'Integrated quiet dishwasher',
    category: 'dishwasher',
    finish: 'panel ready',
    priceCents: 145000,
    widthIn: 24,
    depthIn: 24,
    heightIn: 34,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-DSH-24-PR',
    mount: 'floor',
    doorSwingIn: 24,
    requiresPlumbing: true,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'base-drawer-unit',
    name: 'Three-drawer base cabinet',
    category: 'base_cabinet',
    finish: 'natural walnut',
    priceCents: 85000,
    widthIn: 30,
    depthIn: 24,
    heightIn: 34.5,
    clearanceIn: 30,
    accessible: true,
    sku: 'SYN-CAB-30-NW',
    mount: 'floor',
    doorSwingIn: 21,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'upper-glass-cabinet',
    name: 'Upper glazed wall cabinet',
    category: 'wall_cabinet',
    finish: 'natural walnut',
    priceCents: 62000,
    widthIn: 30,
    depthIn: 13,
    heightIn: 30,
    clearanceIn: 0,
    accessible: false,
    sku: 'SYN-WCB-30-NW',
    mount: 'wall',
    doorSwingIn: 14,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'pantry-tall-cabinet',
    name: 'Pantry tall cabinet',
    category: 'tall_cabinet',
    finish: 'matte slate',
    priceCents: 175000,
    widthIn: 24,
    depthIn: 24,
    heightIn: 84,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-TCB-24-MS',
    mount: 'floor',
    doorSwingIn: 24,
    requiresPlumbing: false,
    requiresElectrical: false,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'induction-cooktop',
    name: 'Four-zone induction cooktop',
    category: 'cooktop',
    finish: 'black ceramic',
    priceCents: 195000,
    widthIn: 30,
    depthIn: 21,
    heightIn: 4,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-CKT-30-BC',
    mount: 'counter',
    workCenter: 'cooktop',
    doorSwingIn: 0,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 15,
    landingRightIn: 12,
    counterRun: true,
  },
  {
    id: 'smart-wall-oven',
    name: 'Single convection wall oven',
    category: 'wall_oven',
    finish: 'stainless',
    priceCents: 235000,
    widthIn: 30,
    depthIn: 25,
    heightIn: 29,
    clearanceIn: 36,
    accessible: true,
    sku: 'SYN-OVN-30-SS',
    mount: 'wall',
    doorSwingIn: 22,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 15,
    counterRun: false,
  },
  {
    id: 'canopy-range-hood',
    name: 'Wall-mount canopy range hood',
    category: 'hood',
    finish: 'stainless',
    priceCents: 110000,
    widthIn: 30,
    depthIn: 20,
    heightIn: 24,
    clearanceIn: 0,
    accessible: false,
    sku: 'SYN-HOD-30-SS',
    mount: 'wall',
    doorSwingIn: 0,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: true,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
  {
    id: 'prep-island',
    name: 'Kitchen prep island',
    category: 'island',
    finish: 'butcher block',
    priceCents: 210000,
    widthIn: 60,
    depthIn: 36,
    heightIn: 36,
    clearanceIn: 42,
    accessible: true,
    sku: 'SYN-ISL-60-BB',
    mount: 'floor',
    doorSwingIn: 18,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: true,
  },
  {
    id: 'flush-mount-light',
    name: 'Architectural LED flush mount',
    category: 'lighting',
    finish: 'warm brass',
    priceCents: 45000,
    widthIn: 16,
    depthIn: 16,
    heightIn: 4,
    clearanceIn: 0,
    accessible: true,
    sku: 'SYN-LGT-16-WB',
    mount: 'ceiling',
    doorSwingIn: 0,
    requiresPlumbing: false,
    requiresElectrical: true,
    requiresVenting: false,
    landingLeftIn: 0,
    landingRightIn: 0,
    counterRun: false,
  },
];

/** Utility configuration & color tokens for all 6 service kinds */
export interface UtilityServiceConfig {
  label: string;
  symbol: 'circle' | 'diamond' | 'rect' | 'hexagon' | 'square';
  color: string;
  strokeColor: string;
  name: string;
}

export const UTILITY_SERVICE_CONFIG: Record<ServiceKind, UtilityServiceConfig> = {
  water: {
    label: 'W',
    symbol: 'circle',
    color: '#0284c7', // Sky Blue
    strokeColor: '#0284c7',
    name: 'Potable Water Supply',
  },
  drain: {
    label: 'D',
    symbol: 'circle',
    color: '#2563eb', // Royal Blue
    strokeColor: '#2563eb',
    name: 'Sanitary Drain',
  },
  gas: {
    label: 'G',
    symbol: 'diamond',
    color: '#eab308', // Amber / Yellow
    strokeColor: '#ca8a04',
    name: 'Natural Gas Supply',
  },
  electrical_120v: {
    label: '120V',
    symbol: 'rect',
    color: '#06b6d4', // Cyan
    strokeColor: '#0891b2',
    name: '120V Convenience Circuit',
  },
  electrical_240v: {
    label: '240V',
    symbol: 'hexagon',
    color: '#7c3aed', // Purple
    strokeColor: '#6d28d9',
    name: '240V Dedicated Appliance Circuit',
  },
  vent: {
    label: 'V',
    symbol: 'square',
    color: '#059669', // Emerald
    strokeColor: '#047857',
    name: 'HVAC Vent / Exhaust Flue',
  },
};

export function getUtilityConfig(kind: ServiceKind): UtilityServiceConfig {
  return UTILITY_SERVICE_CONFIG[kind];
}

/** Resolves product details from current catalog or fallback */
export function resolveCatalogProduct(productId: string, catalog?: Product[]): Product {
  if (catalog && catalog.length > 0) {
    const match = catalog.find((p) => p.id === productId);
    if (match) return match;
  }
  const fallback = FALLBACK_CATALOG.find((p) => p.id === productId);
  if (fallback) return fallback;
  return {
    id: productId,
    name: productId,
    category: 'storage',
    finish: 'matte',
    priceCents: 0,
    widthIn: 24,
    depthIn: 24,
    clearanceIn: 24,
    accessible: true,
  };
}

/** Calculates pure SVG viewBox string: 1 unit = 1 inch, origin Northwest */
export function calculateViewBox(state: RoomState): string {
  const wallThickness = WALL_THICKNESS;
  const margin = PERIMETER_MARGIN;
  const minX = -(wallThickness + margin);
  const minY = -(wallThickness + margin);
  const totalWidth = state.widthIn + 2 * (wallThickness + margin);
  const totalLength = state.lengthIn + 2 * (wallThickness + margin);
  return `${minX} ${minY} ${totalWidth} ${totalLength}`;
}

/** Formats integer inches into imperial feet-and-inches string */
export function formatDimension(d: number): string {
  const total = Math.max(0, Math.round(d));
  const feet = Math.floor(total / 12);
  const inches = total % 12;
  return `${feet}'-${inches}"`;
}

/** 12-inch architectural grid snapping */
export function snapToGrid(coord: number, enabled = true): number {
  if (!enabled) return coord;
  return Math.round(coord / 12) * 12;
}

/** Clamps coordinate inside room boundaries */
export function clampCoordinate(coord: number, footprintSpan: number, roomSpan: number): number {
  const maxCoord = Math.max(0, roomSpan - footprintSpan);
  return Math.max(0, Math.min(maxCoord, coord));
}

/** Front orientation vector matching Handshake rotation convention */
export function getOrientationVector(rotation: Rotation): { x: number; y: number } {
  return frontVector(rotation);
}

/** NKBA Work Triangle computation result */
export interface NKBAWorkTriangle {
  sinkCenter: Point;
  cooktopCenter: Point;
  fridgeCenter: Point;
  dSinkToCooktop: number;
  dCooktopToFridge: number;
  dFridgeToSink: number;
  perimeter: number;
  centroid: Point;
  compliant: boolean;
  issues: string[];
}

/** Calculates NKBA Kitchen Work Triangle if all three centers exist */
export function calculateNKBAWorkTriangle(
  items: RoomItem[],
  catalog: Product[] = FALLBACK_CATALOG,
): NKBAWorkTriangle | null {
  const sinkItem = items.find(
    (i) => resolveCatalogProduct(i.productId, catalog).workCenter === 'sink',
  );
  const cooktopItem = items.find(
    (i) => resolveCatalogProduct(i.productId, catalog).workCenter === 'cooktop',
  );
  const fridgeItem = items.find(
    (i) => resolveCatalogProduct(i.productId, catalog).workCenter === 'refrigerator',
  );

  if (!sinkItem || !cooktopItem || !fridgeItem) return null;

  const sinkProduct = resolveCatalogProduct(sinkItem.productId, catalog);
  const cooktopProduct = resolveCatalogProduct(cooktopItem.productId, catalog);
  const fridgeProduct = resolveCatalogProduct(fridgeItem.productId, catalog);

  const sinkCenter = centerOf(footprintOf(sinkItem, sinkProduct));
  const cooktopCenter = centerOf(footprintOf(cooktopItem, cooktopProduct));
  const fridgeCenter = centerOf(footprintOf(fridgeItem, fridgeProduct));

  const dSinkToCooktop = distanceBetween(sinkCenter, cooktopCenter);
  const dCooktopToFridge = distanceBetween(cooktopCenter, fridgeCenter);
  const dFridgeToSink = distanceBetween(fridgeCenter, sinkCenter);
  const perimeter = dSinkToCooktop + dCooktopToFridge + dFridgeToSink;

  const issues: string[] = [];
  if (perimeter < 156) issues.push('Work triangle perimeter too small (< 13 ft / 156")');
  if (perimeter > 312) issues.push('Work triangle perimeter too large (> 26 ft / 312")');
  if (dSinkToCooktop < 48) issues.push('Sink to cooktop leg too short (< 4 ft)');
  if (dSinkToCooktop > 108) issues.push('Sink to cooktop leg too long (> 9 ft)');
  if (dCooktopToFridge < 48) issues.push('Cooktop to fridge leg too short (< 4 ft)');
  if (dCooktopToFridge > 108) issues.push('Cooktop to fridge leg too long (> 9 ft)');
  if (dFridgeToSink < 48) issues.push('Fridge to sink leg too short (< 4 ft)');
  if (dFridgeToSink > 108) issues.push('Fridge to sink leg too long (> 9 ft)');

  const centroid: Point = {
    x: (sinkCenter.x + cooktopCenter.x + fridgeCenter.x) / 3,
    y: (sinkCenter.y + cooktopCenter.y + fridgeCenter.y) / 3,
  };

  return {
    sinkCenter,
    cooktopCenter,
    fridgeCenter,
    dSinkToCooktop,
    dCooktopToFridge,
    dFridgeToSink,
    perimeter,
    centroid,
    compliant: issues.length === 0,
    issues,
  };
}
