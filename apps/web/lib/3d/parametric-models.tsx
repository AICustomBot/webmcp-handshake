'use client';

import React from 'react';
import type { Product, RoomItem, Rotation } from '@handshake/contracts';
import { PBR_MATERIALS } from './materials';

interface ParametricFixtureProps {
  item: RoomItem;
  product: Product;
  isGhost?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

import {
  isQuarterTurned,
  calculateFixtureTransform,
  ALL_16_CATALOG_ITEM_IDS,
  resolveModelType,
} from './parametric-models-utils';

export { isQuarterTurned, calculateFixtureTransform, ALL_16_CATALOG_ITEM_IDS, resolveModelType };

// ----------------------------------------------------------------------------
// 16 Parametric Procedural Models
// ----------------------------------------------------------------------------

/** 1. Base Drawer Unit (base_cabinet: 30 x 24 x 34.5) */
export function BaseDrawerUnitModel({ isGhost = false }: { isGhost?: boolean }) {
  const mat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.naturalWalnut;
  const topMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.polishedQuartz;
  const pullMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;

  return (
    <group name="base-drawer-unit">
      {/* Toe-kick recess */}
      <mesh position={[0, -15.25, -1.5]} material={mat}>
        <boxGeometry args={[29.5, 4, 21]} />
      </mesh>
      {/* Main carcass */}
      <mesh position={[0, 0, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[30, 26.5, 23.5]} />
      </mesh>
      {/* 3 Drawer fronts with reveals */}
      {[-8.5, 0, 8.5].map((yOffset, i) => (
        <group key={`drawer-${i}`} position={[0, yOffset, 12]}>
          <mesh material={mat} castShadow>
            <boxGeometry args={[29, 8, 0.75]} />
          </mesh>
          {/* Pull handle */}
          <mesh position={[0, 0, 0.75]} rotation={[0, 0, Math.PI / 2]} material={pullMat}>
            <cylinderGeometry args={[0.3, 0.3, 6, 12]} />
          </mesh>
        </group>
      ))}
      {/* 1.5" Quartz Countertop Slab */}
      <mesh position={[0, 16.5, 0.5]} material={topMat} castShadow receiveShadow>
        <boxGeometry args={[30.5, 1.5, 25]} />
      </mesh>
    </group>
  );
}

/** 2. Upper Glazed Wall Cabinet (wall_cabinet: 30 x 13 x 30) */
export function UpperGlassCabinetModel({ isGhost = false }: { isGhost?: boolean }) {
  const frameMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.naturalWalnut;
  const glassMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.architecturalGlass;
  const pullMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;

  return (
    <group name="upper-glass-cabinet">
      {/* Outer Carcass Frame */}
      <mesh material={frameMat} castShadow receiveShadow>
        <boxGeometry args={[30, 30, 13]} />
      </mesh>
      {/* Dual Tempered Glass Door Inserts */}
      <mesh position={[-7.2, 0, 6.6]} material={glassMat}>
        <boxGeometry args={[13.5, 27, 0.375]} />
      </mesh>
      <mesh position={[7.2, 0, 6.6]} material={glassMat}>
        <boxGeometry args={[13.5, 27, 0.375]} />
      </mesh>
      {/* Interior Glass Shelf */}
      <mesh position={[0, 0, 0]} material={glassMat}>
        <boxGeometry args={[28, 0.375, 11]} />
      </mesh>
      {/* Twin Vertical Handles */}
      <mesh position={[-1.5, -6, 7.2]} material={pullMat}>
        <cylinderGeometry args={[0.25, 0.25, 5, 8]} />
      </mesh>
      <mesh position={[1.5, -6, 7.2]} material={pullMat}>
        <cylinderGeometry args={[0.25, 0.25, 5, 8]} />
      </mesh>
    </group>
  );
}

/** 3. Pantry Tall Cabinet (tall_cabinet: 24 x 24 x 84) */
export function PantryTallCabinetModel({ isGhost = false }: { isGhost?: boolean }) {
  const bodyMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteSlate;
  const handleMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteBlack;

  return (
    <group name="pantry-tall-cabinet">
      {/* Recessed 4" Toe-kick */}
      <mesh position={[0, -40, -1.5]} material={bodyMat}>
        <boxGeometry args={[23.5, 4, 21]} />
      </mesh>
      {/* Main Tower Carcass */}
      <mesh position={[0, 2, 0]} material={bodyMat} castShadow receiveShadow>
        <boxGeometry args={[24, 80, 23.5]} />
      </mesh>
      {/* Lower Shaker Door (32" high) */}
      <mesh position={[0, -22, 12]} material={bodyMat} castShadow>
        <boxGeometry args={[23, 31.5, 0.75]} />
      </mesh>
      <mesh position={[9, -22, 12.8]} material={handleMat}>
        <cylinderGeometry args={[0.3, 0.3, 8, 8]} />
      </mesh>
      {/* Upper Shaker Door (48" high) */}
      <mesh position={[0, 18, 12]} material={bodyMat} castShadow>
        <boxGeometry args={[23, 47.5, 0.75]} />
      </mesh>
      <mesh position={[9, 4, 12.8]} material={handleMat}>
        <cylinderGeometry args={[0.3, 0.3, 12, 8]} />
      </mesh>
    </group>
  );
}

/** 4. Undermount Kitchen Basin (sink: 33 x 22 x 10) */
export function UndermountSinkModel({ isGhost = false }: { isGhost?: boolean }) {
  const steelMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;
  const faucetMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.warmBrass;

  return (
    <group name="undermount-sink">
      {/* Basin Outer Rim Flange */}
      <mesh position={[0, 4.8, 0]} material={steelMat}>
        <boxGeometry args={[33, 0.5, 22]} />
      </mesh>
      {/* Dropped Basin Cavity */}
      <mesh position={[0, 0, 0]} material={steelMat} castShadow receiveShadow>
        <boxGeometry args={[30, 9.5, 19]} />
      </mesh>
      {/* Waste Strainer Drain */}
      <mesh position={[0, -4.5, 0]} material={steelMat}>
        <cylinderGeometry args={[2.5, 2.5, 0.5, 16]} />
      </mesh>
      {/* Arched Gooseneck Faucet */}
      <group position={[0, 5, -8]}>
        {/* Base */}
        <mesh position={[0, 2, 0]} material={faucetMat}>
          <cylinderGeometry args={[1, 1.2, 4, 16]} />
        </mesh>
        {/* Vertical Spout */}
        <mesh position={[0, 7, 0]} material={faucetMat}>
          <cylinderGeometry args={[0.4, 0.4, 6, 12]} />
        </mesh>
        {/* Gooseneck Arch */}
        <mesh position={[0, 10, 2]} rotation={[Math.PI / 4, 0, 0]} material={faucetMat}>
          <cylinderGeometry args={[0.4, 0.4, 4, 12]} />
        </mesh>
        {/* Single Lever Handle */}
        <mesh position={[2, 4, 0]} rotation={[0, 0, Math.PI / 4]} material={faucetMat}>
          <cylinderGeometry args={[0.2, 0.2, 3, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** 5. Pro-Style Convection Range (range: 30 x 26 x 36) */
export function ProGasRangeModel({ isGhost = false }: { isGhost?: boolean }) {
  const bodyMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;
  const grateMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.castIron;
  const glassMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.ceramicGlass;

  return (
    <group name="pro-gas-range">
      {/* Heavy Stainless Body */}
      <mesh position={[0, 0, 0]} material={bodyMat} castShadow receiveShadow>
        <boxGeometry args={[30, 35, 26]} />
      </mesh>
      {/* 4 Cast Iron Burner Grates on Top Deck */}
      {[-7, 7].map((gx) =>
        [-6, 6].map((gz) => (
          <mesh key={`grate-${gx}-${gz}`} position={[gx, 18, gz]} material={grateMat} castShadow>
            <cylinderGeometry args={[4.5, 4.5, 0.75, 16]} />
          </mesh>
        )),
      )}
      {/* 5 Front Burner Control Dials */}
      {[-10, -5, 0, 5, 10].map((bx, idx) => (
        <mesh
          key={`dial-${idx}`}
          position={[bx, 14, 13.5]}
          rotation={[Math.PI / 2, 0, 0]}
          material={grateMat}
        >
          <cylinderGeometry args={[1, 1, 0.8, 12]} />
        </mesh>
      ))}
      {/* Oven Window & Towel Bar */}
      <mesh position={[0, 2, 13.2]} material={glassMat}>
        <boxGeometry args={[24, 14, 0.25]} />
      </mesh>
      <mesh position={[0, 9.5, 14.5]} rotation={[0, 0, Math.PI / 2]} material={bodyMat}>
        <cylinderGeometry args={[0.4, 0.4, 22, 12]} />
      </mesh>
      {/* Bottom Storage Drawer Panel */}
      <mesh position={[0, -12, 13.2]} material={bodyMat}>
        <boxGeometry args={[28, 6, 0.5]} />
      </mesh>
    </group>
  );
}

/** 6. Four-Zone Induction Cooktop (cooktop: 30 x 21 x 4) */
export function InductionCooktopModel({ isGhost = false }: { isGhost?: boolean }) {
  const glassMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.ceramicGlass;
  const ringMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.shakerGray;

  return (
    <group name="induction-cooktop">
      {/* Ceramic Glass Top Surface */}
      <mesh position={[0, 1.8, 0]} material={glassMat} receiveShadow>
        <boxGeometry args={[30, 0.4, 21]} />
      </mesh>
      {/* Recessed Under-Counter Housing */}
      <mesh position={[0, -0.5, 0]} material={PBR_MATERIALS.matteBlack}>
        <boxGeometry args={[28, 3.5, 19]} />
      </mesh>
      {/* 4 Induction Ring Markings */}
      {[-7, 7].map((rx) =>
        [-5, 5].map((rz) => (
          <mesh
            key={`zone-${rx}-${rz}`}
            position={[rx, 2.05, rz]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={ringMat}
          >
            <ringGeometry args={[2.5, 3.2, 24]} />
          </mesh>
        )),
      )}
      {/* Front Digital Touch Display Bar */}
      <mesh position={[0, 2.05, 8.5]} material={ringMat}>
        <boxGeometry args={[10, 0.05, 1.5]} />
      </mesh>
    </group>
  );
}

/** 7. Single Convection Wall Oven (wall_oven: 30 x 25 x 29) */
export function SmartWallOvenModel({ isGhost = false }: { isGhost?: boolean }) {
  const bodyMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;
  const glassMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.ceramicGlass;

  return (
    <group name="smart-wall-oven">
      {/* Recessed Cabinet Housing */}
      <mesh material={bodyMat} castShadow receiveShadow>
        <boxGeometry args={[30, 29, 25]} />
      </mesh>
      {/* Dark Glass Door */}
      <mesh position={[0, -2, 12.8]} material={glassMat}>
        <boxGeometry args={[28, 19, 0.5]} />
      </mesh>
      {/* Top LCD Display Screen */}
      <mesh position={[0, 10.5, 12.8]} material={glassMat}>
        <boxGeometry args={[28, 5, 0.5]} />
      </mesh>
      {/* Horizontal Heavy Bar Handle */}
      <mesh position={[0, 6, 14.5]} rotation={[0, 0, Math.PI / 2]} material={bodyMat}>
        <cylinderGeometry args={[0.4, 0.4, 24, 12]} />
      </mesh>
    </group>
  );
}

/** 8. Studio French-Door Refrigerator (refrigerator: 36 x 32 x 70) */
export function FrenchDoorFridgeModel({ isGhost = false }: { isGhost?: boolean }) {
  const steelMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;
  const darkMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteSlate;

  return (
    <group name="french-door-fridge">
      {/* Tall Main Carcass */}
      <mesh position={[0, 0, -1]} material={steelMat} castShadow receiveShadow>
        <boxGeometry args={[36, 70, 30]} />
      </mesh>
      {/* Left French Door */}
      <mesh position={[-8.8, 11, 15]} material={steelMat} castShadow>
        <boxGeometry args={[17.5, 44, 2]} />
      </mesh>
      <mesh position={[-1, 11, 16.5]} material={steelMat}>
        <cylinderGeometry args={[0.4, 0.4, 30, 12]} />
      </mesh>
      {/* Right French Door */}
      <mesh position={[8.8, 11, 15]} material={steelMat} castShadow>
        <boxGeometry args={[17.5, 44, 2]} />
      </mesh>
      <mesh position={[1, 11, 16.5]} material={steelMat}>
        <cylinderGeometry args={[0.4, 0.4, 30, 12]} />
      </mesh>
      {/* Bottom Pull-Out Freezer Drawer */}
      <mesh position={[0, -23, 15]} material={steelMat} castShadow>
        <boxGeometry args={[35.5, 22, 2]} />
      </mesh>
      <mesh position={[0, -15, 16.5]} rotation={[0, 0, Math.PI / 2]} material={steelMat}>
        <cylinderGeometry args={[0.4, 0.4, 26, 12]} />
      </mesh>
      {/* Ice/Water Dispenser Recess on Left Door */}
      <mesh position={[-8.5, 14, 16.1]} material={darkMat}>
        <boxGeometry args={[6, 9, 0.2]} />
      </mesh>
    </group>
  );
}

/** 9. Integrated Quiet Dishwasher (dishwasher: 24 x 24 x 34) */
export function QuietDishwasherModel({ isGhost = false }: { isGhost?: boolean }) {
  const panelMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;
  const handleMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;

  return (
    <group name="quiet-dishwasher">
      {/* Recessed 4" Toe-Kick */}
      <mesh position={[0, -15, -1.5]} material={PBR_MATERIALS.matteBlack}>
        <boxGeometry args={[23.8, 4, 21]} />
      </mesh>
      {/* Dishwasher Front Door */}
      <mesh position={[0, 2, 0]} material={panelMat} castShadow receiveShadow>
        <boxGeometry args={[24, 30, 24]} />
      </mesh>
      {/* Concealed Top Controls Strip */}
      <mesh position={[0, 16.2, 10]} material={PBR_MATERIALS.matteBlack}>
        <boxGeometry args={[22, 0.8, 3]} />
      </mesh>
      {/* Horizontal Handle */}
      <mesh position={[0, 13, 12.8]} rotation={[0, 0, Math.PI / 2]} material={handleMat}>
        <cylinderGeometry args={[0.35, 0.35, 18, 12]} />
      </mesh>
    </group>
  );
}

/** 10. Wall-Mount Canopy Range Hood (hood: 30 x 20 x 24) */
export function CanopyRangeHoodModel({ isGhost = false }: { isGhost?: boolean }) {
  const steelMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;

  return (
    <group name="canopy-range-hood">
      {/* Pyramidal Canopy Cowl */}
      <mesh position={[0, -6, 0]} material={steelMat} castShadow>
        <boxGeometry args={[30, 12, 20]} />
      </mesh>
      {/* Vertical Flue Duct Chimney */}
      <mesh position={[0, 6, -3]} material={steelMat} castShadow>
        <boxGeometry args={[10, 12, 12]} />
      </mesh>
      {/* Grease Filter Baffles & Recessed Spotlights */}
      <mesh position={[0, -12, 0]} material={PBR_MATERIALS.castIron}>
        <boxGeometry args={[26, 0.5, 16]} />
      </mesh>
      {[-8, 8].map((lx) => (
        <mesh key={`hood-light-${lx}`} position={[lx, -12.3, 5]} material={PBR_MATERIALS.warmBrass}>
          <cylinderGeometry args={[1, 1, 0.2, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** 11. Kitchen Prep Island (island: 60 x 36 x 36) */
export function PrepIslandModel({ isGhost = false }: { isGhost?: boolean }) {
  const baseMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.whiteOak;
  const topMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.butcherBlock;
  const pullMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteBlack;

  return (
    <group name="prep-island">
      {/* Base Carcass Box */}
      <mesh position={[0, -0.75, -5]} material={baseMat} castShadow receiveShadow>
        <boxGeometry args={[56, 34.5, 26]} />
      </mesh>
      {/* Shaker Panel Doors */}
      {[-15, 15].map((px) => (
        <mesh key={`island-door-${px}`} position={[px, -0.75, 8.2]} material={baseMat}>
          <boxGeometry args={[24, 30, 0.5]} />
        </mesh>
      ))}
      {/* Handles */}
      {[-5, 5].map((hx) => (
        <mesh key={`island-pull-${hx}`} position={[hx, 4, 9]} material={pullMat}>
          <cylinderGeometry args={[0.25, 0.25, 6, 8]} />
        </mesh>
      ))}
      {/* 1.5" Solid Butcher-Block Top with 10" Seating Overhang */}
      <mesh position={[0, 17.25, 0]} material={topMat} castShadow receiveShadow>
        <boxGeometry args={[60, 1.5, 36]} />
      </mesh>
    </group>
  );
}

/** 12. Harbor Vanity with Sink (vanity: 36 x 21 x 34) */
export function HarborVanityModel({ isGhost = false }: { isGhost?: boolean }) {
  const cabMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteBlack;
  const topMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.polishedQuartz;
  const faucetMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.warmBrass;

  return (
    <group name="harbor-vanity">
      {/* Console Cabinet Body */}
      <mesh position={[0, 2, 0]} material={cabMat} castShadow receiveShadow>
        <boxGeometry args={[36, 28, 21]} />
      </mesh>
      {/* 4 Square Leg Elevations (4" tall) */}
      {[-16.5, 16.5].map((lx) =>
        [-9, 9].map((lz) => (
          <mesh key={`leg-${lx}-${lz}`} position={[lx, -15, lz]} material={cabMat} castShadow>
            <boxGeometry args={[1.5, 4, 1.5]} />
          </mesh>
        )),
      )}
      {/* Cabinet Doors with Brass Pulls */}
      {[-8.5, 8.5].map((dx) => (
        <mesh key={`vanity-door-${dx}`} position={[dx, 2, 10.7]} material={cabMat}>
          <boxGeometry args={[16.8, 25, 0.5]} />
        </mesh>
      ))}
      {[-2, 2].map((bx) => (
        <mesh key={`vanity-pull-${bx}`} position={[bx, 6, 11.5]} material={faucetMat}>
          <cylinderGeometry args={[0.2, 0.2, 5, 8]} />
        </mesh>
      ))}
      {/* 1.5" Polished Quartz Countertop */}
      <mesh position={[0, 16.5, 0]} material={topMat} castShadow receiveShadow>
        <boxGeometry args={[36.5, 1.5, 21.5]} />
      </mesh>
      {/* Undermount Oval Sink Cavity */}
      <mesh position={[0, 15.5, 0]} material={PBR_MATERIALS.glazedPorcelain} receiveShadow>
        <cylinderGeometry args={[8, 7, 6, 24]} />
      </mesh>
      {/* Widespread Brass Faucet */}
      <mesh position={[0, 19.5, -6]} material={faucetMat}>
        <cylinderGeometry args={[0.3, 0.3, 5, 12]} />
      </mesh>
      {[-4, 4].map((hx) => (
        <mesh key={`handle-${hx}`} position={[hx, 18, -6]} material={faucetMat}>
          <boxGeometry args={[2, 1, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

/** 13. Open-Entry Frameless Shower (shower: 42 x 42 x 84) */
export function OpenShowerModel({ isGhost = false }: { isGhost?: boolean }) {
  const panMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.glazedPorcelain;
  const glassMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.architecturalGlass;
  const hardwareMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteBlack;

  return (
    <group name="open-shower">
      {/* 2.5" Low-Profile Composite Shower Pan */}
      <mesh position={[0, -40.75, 0]} material={panMat} receiveShadow>
        <boxGeometry args={[42, 2.5, 42]} />
      </mesh>
      {/* Linear Floor Drain */}
      <mesh position={[0, -39.4, -15]} material={hardwareMat}>
        <boxGeometry args={[24, 0.2, 2]} />
      </mesh>
      {/* Frameless Glass Panel (3/8" Architectural Glass) */}
      <mesh position={[20.5, 2, 0]} material={glassMat}>
        <boxGeometry args={[0.375, 83, 42]} />
      </mesh>
      {/* Corner Wall Brackets */}
      {[-30, 0, 30].map((by) => (
        <mesh key={`bracket-${by}`} position={[20.5, by, -20.5]} material={hardwareMat}>
          <boxGeometry args={[1.5, 2, 1.5]} />
        </mesh>
      ))}
      {/* Ceiling Rainfall Showerhead Arm */}
      <mesh position={[0, 38, -12]} material={hardwareMat}>
        <cylinderGeometry args={[0.3, 0.3, 6, 8]} />
      </mesh>
      <mesh position={[0, 35, -12]} material={hardwareMat}>
        <cylinderGeometry args={[5, 5, 0.5, 24]} />
      </mesh>
    </group>
  );
}

/** 14. Compact Toilet (toilet: 20 x 29 x 30) */
export function CompactWCModel({ isGhost = false }: { isGhost?: boolean }) {
  const porcelainMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.glazedPorcelain;
  const chromeMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.stainless;

  return (
    <group name="compact-wc">
      {/* Elongated Pedestal & Bowl Base */}
      <mesh position={[0, -7, 4]} material={porcelainMat} castShadow receiveShadow>
        <boxGeometry args={[15, 16, 20]} />
      </mesh>
      {/* Contoured Seat Ring & Lid */}
      <mesh position={[0, 1.2, 4]} material={porcelainMat}>
        <cylinderGeometry args={[7.5, 7.5, 0.6, 24]} />
      </mesh>
      {/* Rear Rectangular Water Tank */}
      <mesh position={[0, 4.5, -9]} material={porcelainMat} castShadow receiveShadow>
        <boxGeometry args={[18, 21, 9]} />
      </mesh>
      {/* Tank Top Lid */}
      <mesh position={[0, 15.3, -9]} material={porcelainMat}>
        <boxGeometry args={[19, 0.8, 9.8]} />
      </mesh>
      {/* Dual Flush Chrome Buttons on Lid */}
      <mesh position={[0, 16, -9]} material={chromeMat}>
        <cylinderGeometry args={[1.2, 1.2, 0.5, 16]} />
      </mesh>
    </group>
  );
}

/** 15. Linen Tower (storage: 18 x 16 x 72) */
export function LinenTowerModel({ isGhost = false }: { isGhost?: boolean }) {
  const woodMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.whiteOak;
  const slateMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.shakerGray;

  return (
    <group name="linen-tower">
      {/* Slender Outer Cabinet Tower */}
      <mesh position={[0, 0, 0]} material={woodMat} castShadow receiveShadow>
        <boxGeometry args={[18, 72, 16]} />
      </mesh>
      {/* 3 Open Upper Cubbies */}
      {[10, 22].map((sy) => (
        <mesh key={`shelf-${sy}`} position={[0, sy, 0]} material={woodMat}>
          <boxGeometry args={[16.5, 0.75, 14.5]} />
        </mesh>
      ))}
      {/* Folded Towel Accents in Open Shelves */}
      {[5, 17].map((ty) => (
        <mesh key={`towel-${ty}`} position={[0, ty, 2]} material={PBR_MATERIALS.matteWhite}>
          <boxGeometry args={[10, 3, 10]} />
        </mesh>
      ))}
      {/* Lower Closed Cabinet Door */}
      <mesh position={[0, -20, 8.2]} material={slateMat} castShadow>
        <boxGeometry args={[16.5, 30, 0.75]} />
      </mesh>
      {/* Minimalist Handle */}
      <mesh position={[6, -16, 9]} material={PBR_MATERIALS.matteBlack}>
        <cylinderGeometry args={[0.2, 0.2, 4, 8]} />
      </mesh>
    </group>
  );
}

/** 16. Architectural Flush Mount LED Light (lighting: 16 x 16 x 4) */
export function FlushMountLightModel({ isGhost = false }: { isGhost?: boolean }) {
  const brassMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.warmBrass;
  const lensMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.matteWhite;

  return (
    <group name="flush-mount-light">
      {/* Warm Brass Bezel Ring */}
      <mesh position={[0, 1.5, 0]} material={brassMat}>
        <cylinderGeometry args={[8, 8.2, 1, 32]} />
      </mesh>
      {/* Frosted Acrylic Diffuser Lens */}
      <mesh position={[0, 0.5, 0]} material={lensMat}>
        <cylinderGeometry args={[7.5, 7.5, 1.5, 32]} />
      </mesh>
      {/* Embedded Point Light (Warm 3000K) */}
      {!isGhost && <pointLight color="#fef3c7" intensity={0.9} distance={180} decay={2} />}
    </group>
  );
}

/** Bonus Freestanding Soaking Tub (tub: 66 x 32 x 24) */
export function FreestandingTubModel({ isGhost = false }: { isGhost?: boolean }) {
  const porcelainMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.glazedPorcelain;
  const chromeMat = isGhost ? PBR_MATERIALS.proposalGhost : PBR_MATERIALS.warmBrass;

  return (
    <group name="freestanding-tub">
      {/* Contoured Oval Tub Body */}
      <mesh position={[0, 0, 0]} material={porcelainMat} castShadow receiveShadow>
        <cylinderGeometry args={[16, 13, 24, 32]} />
      </mesh>
      {/* Floor Mounted Faucet Filler */}
      <mesh position={[18, 4, 0]} material={chromeMat}>
        <cylinderGeometry args={[0.5, 0.5, 32, 12]} />
      </mesh>
      <mesh position={[16, 19, 0]} rotation={[0, 0, -Math.PI / 4]} material={chromeMat}>
        <cylinderGeometry args={[0.4, 0.4, 6, 12]} />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------------------
// Model Dispatcher Map
// ----------------------------------------------------------------------------

export function renderCatalogItemMesh(productId: string, isGhost = false) {
  switch (productId) {
    case 'base-drawer-unit':
      return <BaseDrawerUnitModel isGhost={isGhost} />;
    case 'upper-glass-cabinet':
      return <UpperGlassCabinetModel isGhost={isGhost} />;
    case 'pantry-tall-cabinet':
      return <PantryTallCabinetModel isGhost={isGhost} />;
    case 'undermount-sink':
      return <UndermountSinkModel isGhost={isGhost} />;
    case 'pro-gas-range':
      return <ProGasRangeModel isGhost={isGhost} />;
    case 'induction-cooktop':
      return <InductionCooktopModel isGhost={isGhost} />;
    case 'smart-wall-oven':
      return <SmartWallOvenModel isGhost={isGhost} />;
    case 'french-door-fridge':
      return <FrenchDoorFridgeModel isGhost={isGhost} />;
    case 'quiet-dishwasher':
      return <QuietDishwasherModel isGhost={isGhost} />;
    case 'canopy-range-hood':
      return <CanopyRangeHoodModel isGhost={isGhost} />;
    case 'prep-island':
      return <PrepIslandModel isGhost={isGhost} />;
    case 'harbor-vanity':
      return <HarborVanityModel isGhost={isGhost} />;
    case 'open-shower':
      return <OpenShowerModel isGhost={isGhost} />;
    case 'compact-wc':
      return <CompactWCModel isGhost={isGhost} />;
    case 'linen-tower':
      return <LinenTowerModel isGhost={isGhost} />;
    case 'flush-mount-light':
      return <FlushMountLightModel isGhost={isGhost} />;
    default:
      // Category fallback if SKU differs
      if (productId.includes('vanity')) return <HarborVanityModel isGhost={isGhost} />;
      if (productId.includes('shower')) return <OpenShowerModel isGhost={isGhost} />;
      if (productId.includes('wc') || productId.includes('toilet'))
        return <CompactWCModel isGhost={isGhost} />;
      if (productId.includes('tub')) return <FreestandingTubModel isGhost={isGhost} />;
      if (productId.includes('fridge') || productId.includes('ref'))
        return <FrenchDoorFridgeModel isGhost={isGhost} />;
      if (productId.includes('range') || productId.includes('stove'))
        return <ProGasRangeModel isGhost={isGhost} />;
      if (productId.includes('sink')) return <UndermountSinkModel isGhost={isGhost} />;
      if (productId.includes('island')) return <PrepIslandModel isGhost={isGhost} />;
      if (productId.includes('hood')) return <CanopyRangeHoodModel isGhost={isGhost} />;
      if (productId.includes('light')) return <FlushMountLightModel isGhost={isGhost} />;
      return <BaseDrawerUnitModel isGhost={isGhost} />;
  }
}

/**
 * High-level Parametric 3D Fixture Component
 * Positioned and rotated accurately according to Handshake coordinate geometry.
 */
export function ParametricFixture3D({
  item,
  product,
  isGhost = false,
  isSelected = false,
  onSelect,
}: ParametricFixtureProps) {
  const { position, rotation } = calculateFixtureTransform(item, product);
  const heightIn = product.heightIn ?? 34;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(item.id);
    }
  };

  return (
    <group
      name={`fixture-${item.id}`}
      position={position}
      rotation={rotation}
      onClick={handleClick}
    >
      {/* 3D Parametric Mesh */}
      {renderCatalogItemMesh(product.id, isGhost)}

      {/* Selected Halo Outline */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[product.widthIn + 1, heightIn + 1, product.depthIn + 1]} />
          <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.8} />
        </mesh>
      )}

      {/* Proposal Ghost Wireframe Outline */}
      {isGhost && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[product.widthIn + 0.5, heightIn + 0.5, product.depthIn + 0.5]} />
          <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
