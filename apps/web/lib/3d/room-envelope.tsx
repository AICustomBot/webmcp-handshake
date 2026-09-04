'use client';

import React, { useMemo } from 'react';
import type { RoomState } from '@handshake/contracts';
import { PBR_MATERIALS } from './materials';
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  DOOR_HEIGHT,
  WINDOW_SILL_HEIGHT,
  WINDOW_TOP_HEIGHT,
  calculateWallSegments,
  type WallSegment,
} from './room-envelope-utils';

export {
  WALL_HEIGHT,
  WALL_THICKNESS,
  DOOR_HEIGHT,
  WINDOW_SILL_HEIGHT,
  WINDOW_TOP_HEIGHT,
  calculateWallSegments,
  type WallSegment,
};

interface RoomEnvelopeProps {
  state: RoomState;
  showCeiling?: boolean;
}

export function RoomEnvelope({ state, showCeiling = false }: RoomEnvelopeProps) {
  const { widthIn, lengthIn, roomType = 'kitchen' } = state;

  const floorMaterial = useMemo(() => {
    return roomType === 'bathroom' ? PBR_MATERIALS.floorTile : PBR_MATERIALS.floorWood;
  }, [roomType]);

  const wallSegments = useMemo(() => {
    return calculateWallSegments(state);
  }, [state]);

  return (
    <group name="room-envelope">
      {/* 1. Finished Floor Slab */}
      <mesh
        position={[widthIn / 2, -0.75, lengthIn / 2]}
        material={floorMaterial}
        receiveShadow
        name="floor-slab"
      >
        <boxGeometry args={[widthIn + WALL_THICKNESS * 2, 1.5, lengthIn + WALL_THICKNESS * 2]} />
      </mesh>

      {/* 2. Optional Ceiling Slab (Walkthrough Mode) */}
      {showCeiling && (
        <mesh
          position={[widthIn / 2, WALL_HEIGHT + 0.75, lengthIn / 2]}
          material={PBR_MATERIALS.drywallInterior}
          receiveShadow
          name="ceiling-slab"
        >
          <boxGeometry args={[widthIn + WALL_THICKNESS * 2, 1.5, lengthIn + WALL_THICKNESS * 2]} />
        </mesh>
      )}

      {/* 3. Procedural Extruded Wall Segments & Glazing */}
      {wallSegments.map((seg, idx) => (
        <mesh
          key={`wall-seg-${idx}`}
          position={[seg.x, seg.y, seg.z]}
          material={
            seg.isGlazing ? PBR_MATERIALS.architecturalGlass : PBR_MATERIALS.drywallInterior
          }
          castShadow={!seg.isGlazing}
          receiveShadow
          name={seg.isGlazing ? `window-glazing-${idx}` : `wall-segment-${idx}`}
        >
          <boxGeometry args={[seg.width, seg.height, seg.depth]} />
        </mesh>
      ))}

      {/* Baseboard Trim molding along interior floor corners */}
      <mesh
        position={[widthIn / 2, 2.5, 0.35]}
        material={PBR_MATERIALS.matteWhite}
        name="baseboard-north"
      >
        <boxGeometry args={[widthIn, 5, 0.7]} />
      </mesh>
      <mesh
        position={[widthIn / 2, 2.5, lengthIn - 0.35]}
        material={PBR_MATERIALS.matteWhite}
        name="baseboard-south"
      >
        <boxGeometry args={[widthIn, 5, 0.7]} />
      </mesh>
      <mesh
        position={[0.35, 2.5, lengthIn / 2]}
        material={PBR_MATERIALS.matteWhite}
        name="baseboard-west"
      >
        <boxGeometry args={[0.7, 5, lengthIn]} />
      </mesh>
      <mesh
        position={[widthIn - 0.35, 2.5, lengthIn / 2]}
        material={PBR_MATERIALS.matteWhite}
        name="baseboard-east"
      >
        <boxGeometry args={[0.7, 5, lengthIn]} />
      </mesh>
    </group>
  );
}
