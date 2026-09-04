import type { RoomOpening, RoomState, WallSide } from '@handshake/contracts';

export const WALL_HEIGHT = 96; // 8-foot standard residential ceiling (inches)
export const WALL_THICKNESS = 4.5; // Standard 2x4 stud framing + 1/2" drywall
export const DOOR_HEIGHT = 80; // Standard 6'8" residential interior door
export const WINDOW_SILL_HEIGHT = 36; // Standard 3' window sill apron
export const WINDOW_TOP_HEIGHT = 72; // Standard window head height

export interface WallSegment {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  isGlazing?: boolean;
}

/**
 * Calculates extruded 3D wall segments and openings (doors, windows, passages, glazing)
 * for all four room boundaries.
 */
export function calculateWallSegments(state: RoomState): WallSegment[] {
  const { widthIn, lengthIn, openings = [] } = state;
  const segments: WallSegment[] = [];

  const addSegment = (
    wallSide: WallSide,
    alongOffset: number,
    yPos: number,
    segW: number,
    segH: number,
    thick: number,
    isGlazing = false,
  ) => {
    if (wallSide === 'north') {
      segments.push({
        x: alongOffset,
        y: yPos,
        z: -thick / 2,
        width: segW,
        height: segH,
        depth: thick,
        isGlazing,
      });
    } else if (wallSide === 'south') {
      segments.push({
        x: alongOffset,
        y: yPos,
        z: lengthIn + thick / 2,
        width: segW,
        height: segH,
        depth: thick,
        isGlazing,
      });
    } else if (wallSide === 'west') {
      segments.push({
        x: -thick / 2,
        y: yPos,
        z: alongOffset,
        width: thick,
        height: segH,
        depth: segW,
        isGlazing,
      });
    } else if (wallSide === 'east') {
      segments.push({
        x: widthIn + thick / 2,
        y: yPos,
        z: alongOffset,
        width: thick,
        height: segH,
        depth: segW,
        isGlazing,
      });
    }
  };

  const generateWall = (
    wallSide: WallSide,
    wallLength: number,
    thickness: number,
    wallHeight: number,
  ) => {
    const wallOpenings = openings
      .filter((o) => o.wall === wallSide)
      .sort((a, b) => a.offsetIn - b.offsetIn);

    let currentOffset = 0;

    for (const op of wallOpenings) {
      const opStart = Math.max(0, Math.min(wallLength, op.offsetIn));
      const opEnd = Math.max(opStart, Math.min(wallLength, op.offsetIn + op.widthIn));
      const opWidth = opEnd - opStart;

      if (opStart > currentOffset) {
        const segWidth = opStart - currentOffset;
        const segOffset = currentOffset + segWidth / 2;
        addSegment(wallSide, segOffset, wallHeight / 2, segWidth, wallHeight, thickness);
      }

      const opCenterOffset = opStart + opWidth / 2;

      if (op.kind === 'door' || op.kind === 'passage') {
        const lintelH = wallHeight - DOOR_HEIGHT;
        const lintelY = DOOR_HEIGHT + lintelH / 2;
        addSegment(wallSide, opCenterOffset, lintelY, opWidth, lintelH, thickness);
      } else if (op.kind === 'window') {
        const apronH = WINDOW_SILL_HEIGHT;
        const apronY = apronH / 2;
        addSegment(wallSide, opCenterOffset, apronY, opWidth, apronH, thickness);

        const lintelH = wallHeight - WINDOW_TOP_HEIGHT;
        const lintelY = WINDOW_TOP_HEIGHT + lintelH / 2;
        addSegment(wallSide, opCenterOffset, lintelY, opWidth, lintelH, thickness);

        const glassH = WINDOW_TOP_HEIGHT - WINDOW_SILL_HEIGHT;
        const glassY = WINDOW_SILL_HEIGHT + glassH / 2;
        addSegment(
          wallSide,
          opCenterOffset,
          glassY,
          opWidth,
          glassH,
          Math.max(0.5, thickness * 0.15),
          true,
        );
      }

      currentOffset = opEnd;
    }

    if (currentOffset < wallLength) {
      const segWidth = wallLength - currentOffset;
      const segOffset = currentOffset + segWidth / 2;
      addSegment(wallSide, segOffset, wallHeight / 2, segWidth, wallHeight, thickness);
    }
  };

  generateWall('north', widthIn, WALL_THICKNESS, WALL_HEIGHT);
  generateWall('south', widthIn, WALL_THICKNESS, WALL_HEIGHT);
  generateWall('west', lengthIn, WALL_THICKNESS, WALL_HEIGHT);
  generateWall('east', lengthIn, WALL_THICKNESS, WALL_HEIGHT);

  return segments;
}
