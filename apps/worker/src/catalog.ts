import type { Product } from '@handshake/contracts';

/** Synthetic-only fixture catalog used by authoritative policy evaluation. */
export const SYNTHETIC_CATALOG: readonly Product[] = [
  {
    id: 'harbor-vanity',
    name: 'Harbor vanity',
    category: 'vanity',
    finish: 'matte black',
    priceCents: 248000,
    widthIn: 36,
    depthIn: 21,
    clearanceIn: 30,
    accessible: true,
  },
  {
    id: 'open-shower',
    name: 'Open-entry shower',
    category: 'shower',
    finish: 'clear glass',
    priceCents: 490000,
    widthIn: 42,
    depthIn: 42,
    clearanceIn: 36,
    accessible: true,
  },
  {
    id: 'compact-wc',
    name: 'Compact WC',
    category: 'toilet',
    finish: 'white',
    priceCents: 168000,
    widthIn: 20,
    depthIn: 29,
    clearanceIn: 30,
    accessible: false,
  },
  {
    id: 'linen-tower',
    name: 'Linen tower',
    category: 'storage',
    finish: 'white oak',
    priceCents: 132000,
    widthIn: 18,
    depthIn: 16,
    clearanceIn: 24,
    accessible: true,
  },
];
