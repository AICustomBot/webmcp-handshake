import * as THREE from 'three';

/**
 * Realistic Physically-Based Rendering (PBR) Materials
 * Designed for procedural parametric architectural studio visualization.
 */

// Colors
export const COLORS = {
  stainless: '#e2e8f0',
  matteWhite: '#f8fafc',
  shakerGray: '#475569',
  matteSlate: '#334155',
  naturalWalnut: '#5c4033',
  whiteOak: '#d4b996',
  butcherBlock: '#c29b6e',
  matteBlack: '#18181b',
  quartzCountertop: '#f1f5f9',
  warmBrass: '#d97706',
  brushedBrass: '#eab308',
  glazedPorcelain: '#ffffff',
  architecturalGlass: '#e0f2fe',
  ceramicBlack: '#0f172a',
  castIron: '#1c1917',
  proposalAmber: '#f59e0b',
  proposalAmberEmissive: '#d97706',
  proposalRemoveRed: '#ef4444',
  proposalRemoveEmissive: '#b91c1c',
  selectionBlue: '#3b82f6',
  selectionEmissive: '#1d4ed8',
  floorTile: '#cbd5e1',
  floorWood: '#b48a60',
  drywallInterior: '#f8fafc',
  drywallExterior: '#64748b',
} as const;

export const PBR_MATERIALS = {
  stainless: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.stainless),
    metalness: 0.9,
    roughness: 0.22,
    name: 'stainless',
  }),

  matteWhite: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.matteWhite),
    metalness: 0.04,
    roughness: 0.45,
    name: 'matteWhite',
  }),

  shakerGray: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.shakerGray),
    metalness: 0.12,
    roughness: 0.6,
    name: 'shakerGray',
  }),

  matteSlate: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.matteSlate),
    metalness: 0.15,
    roughness: 0.65,
    name: 'matteSlate',
  }),

  naturalWalnut: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.naturalWalnut),
    metalness: 0.05,
    roughness: 0.65,
    name: 'naturalWalnut',
  }),

  whiteOak: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.whiteOak),
    metalness: 0.03,
    roughness: 0.7,
    name: 'whiteOak',
  }),

  butcherBlock: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.butcherBlock),
    metalness: 0.04,
    roughness: 0.6,
    name: 'butcherBlock',
  }),

  matteBlack: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.matteBlack),
    metalness: 0.3,
    roughness: 0.75,
    name: 'matteBlack',
  }),

  polishedQuartz: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.quartzCountertop),
    metalness: 0.08,
    roughness: 0.15,
    name: 'polishedQuartz',
  }),

  warmBrass: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.warmBrass),
    metalness: 0.85,
    roughness: 0.28,
    name: 'warmBrass',
  }),

  glazedPorcelain: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.glazedPorcelain),
    metalness: 0.02,
    roughness: 0.08,
    name: 'glazedPorcelain',
  }),

  architecturalGlass: new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(COLORS.architecturalGlass),
    transmission: 0.9,
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    ior: 1.52,
    name: 'architecturalGlass',
  }),

  ceramicGlass: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.ceramicBlack),
    metalness: 0.4,
    roughness: 0.1,
    name: 'ceramicGlass',
  }),

  castIron: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.castIron),
    metalness: 0.75,
    roughness: 0.65,
    name: 'castIron',
  }),

  floorWood: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.floorWood),
    metalness: 0.03,
    roughness: 0.55,
    name: 'floorWood',
  }),

  floorTile: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.floorTile),
    metalness: 0.05,
    roughness: 0.45,
    name: 'floorTile',
  }),

  drywallInterior: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.drywallInterior),
    metalness: 0.02,
    roughness: 0.85,
    name: 'drywallInterior',
  }),

  drywallExterior: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.drywallExterior),
    metalness: 0.05,
    roughness: 0.9,
    name: 'drywallExterior',
  }),

  // Constitutional Translucent Amber Proposal Ghost Material
  proposalGhost: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.proposalAmber),
    emissive: new THREE.Color(COLORS.proposalAmberEmissive),
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.55,
    roughness: 0.3,
    metalness: 0.1,
    name: 'proposalGhost',
  }),

  // Proposal Removal Staged Material
  proposalRemoveGhost: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.proposalRemoveRed),
    emissive: new THREE.Color(COLORS.proposalRemoveEmissive),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.5,
    roughness: 0.3,
    name: 'proposalRemoveGhost',
  }),

  // Selection Glow Material
  selectedHighlight: new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLORS.selectionBlue),
    emissive: new THREE.Color(COLORS.selectionEmissive),
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.7,
    roughness: 0.2,
    name: 'selectedHighlight',
  }),
};
