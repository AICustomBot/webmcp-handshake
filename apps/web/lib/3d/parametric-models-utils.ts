import type { Product, RoomItem, Rotation } from '@handshake/contracts';

export const ALL_16_CATALOG_ITEM_IDS = [
  'base-drawer-unit',
  'upper-glass-cabinet',
  'pantry-tall-cabinet',
  'undermount-sink',
  'pro-gas-range',
  'induction-cooktop',
  'smart-wall-oven',
  'french-door-fridge',
  'quiet-dishwasher',
  'canopy-range-hood',
  'prep-island',
  'harbor-vanity',
  'open-shower',
  'compact-wc',
  'linen-tower',
  'flush-mount-light',
] as const;

/** Determines if rotation is 90 or 270 degrees (quarter turned) */
export function isQuarterTurned(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}

/** Resolves the center coordinate and height for any catalog fixture */
export function calculateFixtureTransform(item: RoomItem, product: Product) {
  const turned = isQuarterTurned(item.rotation);
  const footprintWidth = turned ? product.depthIn : product.widthIn;
  const footprintDepth = turned ? product.widthIn : product.depthIn;

  const centerX = item.x + footprintWidth / 2;
  const centerZ = item.y + footprintDepth / 2;

  const heightIn = product.heightIn ?? 34;
  let centerY = heightIn / 2;

  if (product.mount === 'wall') {
    if (product.category === 'hood') {
      centerY = 66 + heightIn / 2;
    } else if (product.category === 'wall_cabinet') {
      centerY = 54 + heightIn / 2;
    } else if (product.category === 'wall_oven') {
      centerY = 30 + heightIn / 2;
    } else {
      centerY = 48 + heightIn / 2;
    }
  } else if (product.mount === 'ceiling') {
    centerY = 96 - heightIn / 2;
  } else if (product.mount === 'counter') {
    if (product.category === 'sink') {
      centerY = 34.5 - heightIn / 2;
    } else {
      centerY = 36 + heightIn / 2;
    }
  } else {
    // Floor mounted
    centerY = heightIn / 2;
  }

  const rotationY = -(item.rotation * Math.PI) / 180;

  return {
    position: [centerX, centerY, centerZ] as [number, number, number],
    rotation: [0, rotationY, 0] as [number, number, number],
    footprintWidth,
    footprintDepth,
  };
}

/** Resolves product category model mapping for 16 catalog items and fallbacks */
export function resolveModelType(productId: string): string {
  if (productId === 'base-drawer-unit') return 'base-drawer-unit';
  if (productId === 'upper-glass-cabinet') return 'upper-glass-cabinet';
  if (productId === 'pantry-tall-cabinet') return 'pantry-tall-cabinet';
  if (productId === 'undermount-sink') return 'undermount-sink';
  if (productId === 'pro-gas-range') return 'pro-gas-range';
  if (productId === 'induction-cooktop') return 'induction-cooktop';
  if (productId === 'smart-wall-oven') return 'smart-wall-oven';
  if (productId === 'french-door-fridge') return 'french-door-fridge';
  if (productId === 'quiet-dishwasher') return 'quiet-dishwasher';
  if (productId === 'canopy-range-hood') return 'canopy-range-hood';
  if (productId === 'prep-island') return 'prep-island';
  if (productId === 'harbor-vanity') return 'harbor-vanity';
  if (productId === 'open-shower') return 'open-shower';
  if (productId === 'compact-wc') return 'compact-wc';
  if (productId === 'linen-tower') return 'linen-tower';
  if (productId === 'flush-mount-light') return 'flush-mount-light';

  // Fallbacks
  if (productId.includes('vanity')) return 'harbor-vanity';
  if (productId.includes('shower')) return 'open-shower';
  if (productId.includes('wc') || productId.includes('toilet')) return 'compact-wc';
  if (productId.includes('tub')) return 'freestanding-tub';
  if (productId.includes('fridge') || productId.includes('ref')) return 'french-door-fridge';
  if (productId.includes('range') || productId.includes('stove')) return 'pro-gas-range';
  if (productId.includes('sink')) return 'undermount-sink';
  if (productId.includes('island')) return 'prep-island';
  if (productId.includes('hood')) return 'canopy-range-hood';
  if (productId.includes('light')) return 'flush-mount-light';
  return 'base-drawer-unit';
}
