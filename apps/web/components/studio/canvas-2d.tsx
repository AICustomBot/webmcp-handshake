'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  Compass,
  Grid,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  Box,
  Layers,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
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
import { useStudioStore } from '../../lib/store/studio-store';
import {
  WALL_THICKNESS,
  PERIMETER_MARGIN,
  FALLBACK_CATALOG,
  UTILITY_SERVICE_CONFIG,
  getUtilityConfig,
  resolveCatalogProduct,
  calculateViewBox,
  formatDimension,
  snapToGrid,
  clampCoordinate,
  getOrientationVector,
  calculateNKBAWorkTriangle,
  footprintOf,
  centerOf,
  distanceBetween,
  widthOf,
  depthOf,
  stripInFront,
  overlaps,
  fitsInsideRoom,
  pointOnWall,
  type Footprint,
  type Point,
  type Vector,
} from './canvas-2d-utils';

export * from './canvas-2d-utils';

/**
 * 2D Architectural Floorplan Canvas Component
 */
export const Canvas2D: React.FC = () => {
  const {
    roomState,
    catalog,
    activeProposal,
    selectedItemId,
    hoveredItemId,
    zoom,
    pan,
    gridSnap,
    selectItem,
    setHoveredItem,
    setZoom,
    setPan,
    setGridSnap,
    setViewportMode,
    moveItem,
  } = useStudioStore();

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Drag interaction state
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [dragCollision, setDragCollision] = useState<boolean>(false);
  const [hasMoved, setHasMoved] = useState<boolean>(false);

  // Multi-touch pinch & pan tracking
  const activePointers = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialZoomOnPinch = useRef<number>(zoom);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const effectiveState: RoomState = useMemo(() => {
    return (
      roomState || {
        sessionId: 'default-preview',
        version: 0,
        roomType: 'kitchen',
        widthIn: 144,
        lengthIn: 180,
        budgetCents: 2000000,
        items: [],
        openings: [],
        serviceAnchors: [],
      }
    );
  }, [roomState]);

  const viewBox = useMemo(() => calculateViewBox(effectiveState), [effectiveState]);
  const workTriangle = useMemo(
    () => calculateNKBAWorkTriangle(effectiveState.items, catalog),
    [effectiveState.items, catalog],
  );

  // Convert client delta to SVG inches
  const clientToSvgDelta = useCallback(
    (dxPx: number, dyPx: number) => {
      if (!svgRef.current) return { dxIn: dxPx, dyIn: dyPx };
      const rect = svgRef.current.getBoundingClientRect();
      const totalWidthIn = effectiveState.widthIn + 2 * (WALL_THICKNESS + PERIMETER_MARGIN);
      const scale = totalWidthIn / rect.width;
      return {
        dxIn: (dxPx * scale) / zoom,
        dyIn: (dyPx * scale) / zoom,
      };
    },
    [effectiveState.widthIn, zoom],
  );

  // Handle pointer down on a fixture
  const handleItemPointerDown = (e: React.PointerEvent, item: RoomItem) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    selectItem(item.id);
    setDraggingItemId(item.id);
    setDragOffset({ x: e.clientX, y: e.clientY });
    setDragPreview({ x: item.x, y: item.y });
    setDragCollision(false);
    setHasMoved(false);
  };

  // Handle pointer move while dragging fixture
  const handleItemPointerMove = (e: React.PointerEvent, item: RoomItem) => {
    if (draggingItemId !== item.id || !dragOffset) return;
    e.stopPropagation();

    const dxPx = e.clientX - dragOffset.x;
    const dyPx = e.clientY - dragOffset.y;
    const { dxIn, dyIn } = clientToSvgDelta(dxPx, dyPx);

    if (Math.hypot(dxIn, dyIn) > 2) {
      setHasMoved(true);
    }

    const rawX = item.x + dxIn;
    const rawY = item.y + dyIn;
    const snappedX = snapToGrid(rawX, gridSnap);
    const snappedY = snapToGrid(rawY, gridSnap);

    const product = resolveCatalogProduct(item.productId, catalog);
    const box = footprintOf(item, product);
    const w = widthOf(box);
    const d = depthOf(box);

    const clampedX = clampCoordinate(snappedX, w, effectiveState.widthIn);
    const clampedY = clampCoordinate(snappedY, d, effectiveState.lengthIn);

    setDragPreview({ x: clampedX, y: clampedY });

    // Live collision check against other committed items
    const candidateFootprint: Footprint = {
      left: clampedX,
      top: clampedY,
      right: clampedX + w,
      bottom: clampedY + d,
    };

    const isColliding = effectiveState.items.some((other) => {
      if (other.id === item.id) return false;
      const otherProduct = resolveCatalogProduct(other.productId, catalog);
      const otherBox = footprintOf(other, otherProduct);
      return overlaps(candidateFootprint, otherBox);
    });

    setDragCollision(isColliding);
  };

  // Handle pointer release on fixture
  const handleItemPointerUp = (e: React.PointerEvent, item: RoomItem) => {
    if (draggingItemId !== item.id) return;
    e.stopPropagation();
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was lost
    }

    if (hasMoved && dragPreview) {
      moveItem(item.id, dragPreview.x, dragPreview.y, item.rotation);
    }

    setDraggingItemId(null);
    setDragOffset(null);
    setDragPreview(null);
    setDragCollision(false);
    setHasMoved(false);
  };

  // Background Pointer Events for Canvas Pan & Multi-Touch Pinch
  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && (e.target as Element).id !== 'room-floor') return;
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (activePointers.current.size === 1) {
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      selectItem(null);
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (dist >= 15) {
        initialPinchDist.current = dist;
        initialZoomOnPinch.current = zoom;
      }
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (activePointers.current.size === 1 && panStartRef.current && !draggingItemId) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.panX + dx * 0.6,
        y: panStartRef.current.panY + dy * 0.6,
      });
    } else if (activePointers.current.size === 2 && initialPinchDist.current !== null) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (dist >= 15 && initialPinchDist.current >= 15) {
        const factor = dist / initialPinchDist.current;
        const newZoom = Math.min(3.0, Math.max(0.4, initialZoomOnPinch.current * factor));
        setZoom(Number(newZoom.toFixed(2)));
      }
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      initialPinchDist.current = null;
    }
    if (activePointers.current.size === 0) {
      panStartRef.current = null;
    }
  };

  // Zoom control handlers
  const handleZoomIn = () => setZoom(Math.min(3.0, Number((zoom + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom(Math.max(0.4, Number((zoom - 0.15).toFixed(2))));
  const handleResetFit = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Wall segments calculation with clean breaks for openings
  const wallSegments = useMemo(() => {
    const openings = effectiveState.openings || [];
    const getSegmentsForWall = (wall: WallSide, length: number) => {
      const wallOpenings = openings
        .filter((o) => o.wall === wall)
        .sort((a, b) => a.offsetIn - b.offsetIn);

      const segments: { start: number; end: number }[] = [];
      let cursor = 0;
      for (const op of wallOpenings) {
        if (op.offsetIn > cursor) {
          segments.push({ start: cursor, end: Math.min(length, op.offsetIn) });
        }
        cursor = Math.max(cursor, op.offsetIn + op.widthIn);
      }
      if (cursor < length) {
        segments.push({ start: cursor, end: length });
      }
      return segments;
    };

    return {
      north: getSegmentsForWall('north', effectiveState.widthIn),
      south: getSegmentsForWall('south', effectiveState.widthIn),
      west: getSegmentsForWall('west', effectiveState.lengthIn),
      east: getSegmentsForWall('east', effectiveState.lengthIn),
    };
  }, [effectiveState]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#090d16] text-slate-200 select-none">
      {/* 2D Canvas Viewport Header Toolbar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-medium text-sm text-white">
            <Compass className="h-4 w-4 text-blue-400" />
            <span>2D Architectural Floorplan</span>
          </div>
          <span className="hidden text-slate-500 sm:inline">&bull;</span>
          <span className="hidden font-mono text-xs text-slate-400 sm:inline">
            {formatDimension(effectiveState.widthIn)} &times;{' '}
            {formatDimension(effectiveState.lengthIn)}
          </span>
          {workTriangle && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                workTriangle.compliant
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
              title={workTriangle.issues.join('; ') || 'NKBA Work Triangle Guidelines satisfied'}
            >
              {workTriangle.compliant ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              <span>NKBA {formatDimension(Math.round(workTriangle.perimeter))}</span>
            </span>
          )}
        </div>

        {/* Viewport Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* 12" Grid Snap Toggle */}
          <button
            type="button"
            onClick={() => setGridSnap(!gridSnap)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              gridSnap
                ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle 12-inch architectural snap grid"
          >
            <Grid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">12&quot; Snap</span>
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="rounded-lg border border-slate-700 bg-slate-800/60 p-1.5 text-slate-300 transition-colors hover:bg-slate-700"
            title="Zoom Out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          {/* Zoom % label & Reset */}
          <button
            type="button"
            onClick={handleResetFit}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 font-mono text-xs text-slate-300 transition-colors hover:bg-slate-700"
            title="Reset Zoom & Pan (Fit to view)"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="rounded-lg border border-slate-700 bg-slate-800/60 p-1.5 text-slate-300 transition-colors hover:bg-slate-700"
            title="Zoom In"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Switch to 3D Viewport */}
          <button
            type="button"
            onClick={() => setViewportMode('3d')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/25"
            title="Switch to React Three Fiber 3D Spatial Studio"
          >
            <Box className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">3D View</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 cursor-grab active:cursor-grabbing overflow-hidden">
        <svg
          id="handshake-canvas-2d"
          data-testid="handshake-canvas-2d"
          ref={svgRef}
          viewBox={viewBox}
          className="h-full w-full touch-none"
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerUp}
        >
          <defs>
            {/* 3-inch architectural dot pattern */}
            <pattern id="grid-3" width="3" height="3" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.35" fill="#334155" opacity="0.5" />
            </pattern>

            {/* 12-inch major grid line pattern */}
            <pattern id="grid-12" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="url(#grid-3)" />
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>

            {/* Wall framing diagonal cross-hatch fill pattern */}
            <pattern
              id="wall-hatch"
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="1.5" />
            </pattern>

            {/* Amber directed vector arrow marker for proposal moves */}
            <marker
              id="amber-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
            </marker>

            {/* Blue subtle arrow marker */}
            <marker
              id="blue-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Viewport Pan & Zoom Transform Group */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) translate(${effectiveState.widthIn / 2}, ${
              effectiveState.lengthIn / 2
            }) scale(${zoom}) translate(${-effectiveState.widthIn / 2}, ${-effectiveState.lengthIn / 2})`}
          >
            {/* Interior Room Floor with 12" Grid Pattern */}
            <rect
              id="room-floor"
              x={0}
              y={0}
              width={effectiveState.widthIn}
              height={effectiveState.lengthIn}
              fill="url(#grid-12)"
              stroke="#334155"
              strokeWidth="1.5"
            />

            {/* 1. Wall Framing Layer */}
            <g id="wall-framing-layer">
              {/* Corner framing posts */}
              <rect
                x={-WALL_THICKNESS}
                y={-WALL_THICKNESS}
                width={WALL_THICKNESS}
                height={WALL_THICKNESS}
                fill="url(#wall-hatch)"
                stroke="#334155"
                strokeWidth="1"
              />
              <rect
                x={effectiveState.widthIn}
                y={-WALL_THICKNESS}
                width={WALL_THICKNESS}
                height={WALL_THICKNESS}
                fill="url(#wall-hatch)"
                stroke="#334155"
                strokeWidth="1"
              />
              <rect
                x={-WALL_THICKNESS}
                y={effectiveState.lengthIn}
                width={WALL_THICKNESS}
                height={WALL_THICKNESS}
                fill="url(#wall-hatch)"
                stroke="#334155"
                strokeWidth="1"
              />
              <rect
                x={effectiveState.widthIn}
                y={effectiveState.lengthIn}
                width={WALL_THICKNESS}
                height={WALL_THICKNESS}
                fill="url(#wall-hatch)"
                stroke="#334155"
                strokeWidth="1"
              />

              {/* North wall framing segments */}
              {wallSegments.north.map((seg, idx) => (
                <rect
                  key={`wall-n-${idx}`}
                  x={seg.start}
                  y={-WALL_THICKNESS}
                  width={seg.end - seg.start}
                  height={WALL_THICKNESS}
                  fill="url(#wall-hatch)"
                  stroke="#334155"
                  strokeWidth="1"
                />
              ))}

              {/* South wall framing segments */}
              {wallSegments.south.map((seg, idx) => (
                <rect
                  key={`wall-s-${idx}`}
                  x={seg.start}
                  y={effectiveState.lengthIn}
                  width={seg.end - seg.start}
                  height={WALL_THICKNESS}
                  fill="url(#wall-hatch)"
                  stroke="#334155"
                  strokeWidth="1"
                />
              ))}

              {/* West wall framing segments */}
              {wallSegments.west.map((seg, idx) => (
                <rect
                  key={`wall-w-${idx}`}
                  x={-WALL_THICKNESS}
                  y={seg.start}
                  width={WALL_THICKNESS}
                  height={seg.end - seg.start}
                  fill="url(#wall-hatch)"
                  stroke="#334155"
                  strokeWidth="1"
                />
              ))}

              {/* East wall framing segments */}
              {wallSegments.east.map((seg, idx) => (
                <rect
                  key={`wall-e-${idx}`}
                  x={effectiveState.widthIn}
                  y={seg.start}
                  width={WALL_THICKNESS}
                  height={seg.end - seg.start}
                  fill="url(#wall-hatch)"
                  stroke="#334155"
                  strokeWidth="1"
                />
              ))}
            </g>

            {/* 2. Wall Openings Layer (Doors, Windows, Passages) */}
            <g id="openings-layer">
              {(effectiveState.openings || []).map((opening) => {
                const swing = opening.swingIn > 0 ? opening.swingIn : opening.widthIn;
                const { wall, offsetIn, widthIn, kind } = opening;

                if (kind === 'door') {
                  if (wall === 'north') {
                    return (
                      <g key={opening.id} className="door-opening">
                        <line
                          x1={offsetIn}
                          y1={-WALL_THICKNESS}
                          x2={offsetIn}
                          y2={0}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn + widthIn}
                          y1={-WALL_THICKNESS}
                          x2={offsetIn + widthIn}
                          y2={0}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn}
                          y1={0}
                          x2={offsetIn}
                          y2={swing}
                          stroke="#f8fafc"
                          strokeWidth="2.5"
                        />
                        <path
                          d={`M ${offsetIn + widthIn} 0 A ${widthIn} ${widthIn} 0 0 1 ${offsetIn} ${swing}`}
                          fill="rgba(241, 245, 249, 0.08)"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      </g>
                    );
                  }
                  if (wall === 'south') {
                    return (
                      <g key={opening.id} className="door-opening">
                        <line
                          x1={offsetIn}
                          y1={effectiveState.lengthIn}
                          x2={offsetIn}
                          y2={effectiveState.lengthIn + WALL_THICKNESS}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn + widthIn}
                          y1={effectiveState.lengthIn}
                          x2={offsetIn + widthIn}
                          y2={effectiveState.lengthIn + WALL_THICKNESS}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn}
                          y1={effectiveState.lengthIn}
                          x2={offsetIn}
                          y2={effectiveState.lengthIn - swing}
                          stroke="#f8fafc"
                          strokeWidth="2.5"
                        />
                        <path
                          d={`M ${offsetIn + widthIn} ${effectiveState.lengthIn} A ${widthIn} ${widthIn} 0 0 0 ${offsetIn} ${effectiveState.lengthIn - swing}`}
                          fill="rgba(241, 245, 249, 0.08)"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      </g>
                    );
                  }
                  if (wall === 'west') {
                    return (
                      <g key={opening.id} className="door-opening">
                        <line
                          x1={-WALL_THICKNESS}
                          y1={offsetIn}
                          x2={0}
                          y2={offsetIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={-WALL_THICKNESS}
                          y1={offsetIn + widthIn}
                          x2={0}
                          y2={offsetIn + widthIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={0}
                          y1={offsetIn}
                          x2={swing}
                          y2={offsetIn}
                          stroke="#f8fafc"
                          strokeWidth="2.5"
                        />
                        <path
                          d={`M 0 ${offsetIn + widthIn} A ${widthIn} ${widthIn} 0 0 0 ${swing} ${offsetIn}`}
                          fill="rgba(241, 245, 249, 0.08)"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      </g>
                    );
                  }
                  if (wall === 'east') {
                    return (
                      <g key={opening.id} className="door-opening">
                        <line
                          x1={effectiveState.widthIn}
                          y1={offsetIn}
                          x2={effectiveState.widthIn + WALL_THICKNESS}
                          y2={offsetIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={effectiveState.widthIn}
                          y1={offsetIn + widthIn}
                          x2={effectiveState.widthIn + WALL_THICKNESS}
                          y2={offsetIn + widthIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={effectiveState.widthIn}
                          y1={offsetIn}
                          x2={effectiveState.widthIn - swing}
                          y2={offsetIn}
                          stroke="#f8fafc"
                          strokeWidth="2.5"
                        />
                        <path
                          d={`M ${effectiveState.widthIn} ${offsetIn + widthIn} A ${widthIn} ${widthIn} 0 0 1 ${effectiveState.widthIn - swing} ${offsetIn}`}
                          fill="rgba(241, 245, 249, 0.08)"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      </g>
                    );
                  }
                }

                if (kind === 'window') {
                  if (wall === 'north') {
                    return (
                      <g key={opening.id} className="window-opening">
                        <line
                          x1={offsetIn - 1}
                          y1={-WALL_THICKNESS}
                          x2={offsetIn + widthIn + 1}
                          y2={-WALL_THICKNESS}
                          stroke="#64748b"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={offsetIn}
                          y1={-WALL_THICKNESS}
                          x2={offsetIn}
                          y2={0}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn + widthIn}
                          y1={-WALL_THICKNESS}
                          x2={offsetIn + widthIn}
                          y2={0}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn}
                          y1={-3}
                          x2={offsetIn + widthIn}
                          y2={-3}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={offsetIn}
                          y1={-1.5}
                          x2={offsetIn + widthIn}
                          y2={-1.5}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  }
                  if (wall === 'south') {
                    return (
                      <g key={opening.id} className="window-opening">
                        <line
                          x1={offsetIn - 1}
                          y1={effectiveState.lengthIn + WALL_THICKNESS}
                          x2={offsetIn + widthIn + 1}
                          y2={effectiveState.lengthIn + WALL_THICKNESS}
                          stroke="#64748b"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={offsetIn}
                          y1={effectiveState.lengthIn}
                          x2={offsetIn}
                          y2={effectiveState.lengthIn + WALL_THICKNESS}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn + widthIn}
                          y1={effectiveState.lengthIn}
                          x2={offsetIn + widthIn}
                          y2={effectiveState.lengthIn + WALL_THICKNESS}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={offsetIn}
                          y1={effectiveState.lengthIn + 1.5}
                          x2={offsetIn + widthIn}
                          y2={effectiveState.lengthIn + 1.5}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={offsetIn}
                          y1={effectiveState.lengthIn + 3}
                          x2={offsetIn + widthIn}
                          y2={effectiveState.lengthIn + 3}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  }
                  if (wall === 'west') {
                    return (
                      <g key={opening.id} className="window-opening">
                        <line
                          x1={-WALL_THICKNESS}
                          y1={offsetIn - 1}
                          x2={-WALL_THICKNESS}
                          y2={offsetIn + widthIn + 1}
                          stroke="#64748b"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={-WALL_THICKNESS}
                          y1={offsetIn}
                          x2={0}
                          y2={offsetIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={-WALL_THICKNESS}
                          y1={offsetIn + widthIn}
                          x2={0}
                          y2={offsetIn + widthIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={-3}
                          y1={offsetIn}
                          x2={-3}
                          y2={offsetIn + widthIn}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={-1.5}
                          y1={offsetIn}
                          x2={-1.5}
                          y2={offsetIn + widthIn}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  }
                  if (wall === 'east') {
                    return (
                      <g key={opening.id} className="window-opening">
                        <line
                          x1={effectiveState.widthIn + WALL_THICKNESS}
                          y1={offsetIn - 1}
                          x2={effectiveState.widthIn + WALL_THICKNESS}
                          y2={offsetIn + widthIn + 1}
                          stroke="#64748b"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={effectiveState.widthIn}
                          y1={offsetIn}
                          x2={effectiveState.widthIn + WALL_THICKNESS}
                          y2={offsetIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={effectiveState.widthIn}
                          y1={offsetIn + widthIn}
                          x2={effectiveState.widthIn + WALL_THICKNESS}
                          y2={offsetIn + widthIn}
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        <line
                          x1={effectiveState.widthIn + 1.5}
                          y1={offsetIn}
                          x2={effectiveState.widthIn + 1.5}
                          y2={offsetIn + widthIn}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={effectiveState.widthIn + 3}
                          y1={offsetIn}
                          x2={effectiveState.widthIn + 3}
                          y2={offsetIn + widthIn}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  }
                }

                // Cased passage
                if (wall === 'north' || wall === 'south') {
                  const yBase = wall === 'north' ? -WALL_THICKNESS : effectiveState.lengthIn;
                  return (
                    <g key={opening.id} className="passage-opening">
                      <line
                        x1={offsetIn}
                        y1={yBase}
                        x2={offsetIn}
                        y2={yBase + WALL_THICKNESS}
                        stroke="#1e293b"
                        strokeWidth="2"
                      />
                      <line
                        x1={offsetIn + widthIn}
                        y1={yBase}
                        x2={offsetIn + widthIn}
                        y2={yBase + WALL_THICKNESS}
                        stroke="#1e293b"
                        strokeWidth="2"
                      />
                    </g>
                  );
                }
                const xBase = wall === 'west' ? -WALL_THICKNESS : effectiveState.widthIn;
                return (
                  <g key={opening.id} className="passage-opening">
                    <line
                      x1={xBase}
                      y1={offsetIn}
                      x2={xBase + WALL_THICKNESS}
                      y2={offsetIn}
                      stroke="#1e293b"
                      strokeWidth="2"
                    />
                    <line
                      x1={xBase}
                      y1={offsetIn + widthIn}
                      x2={xBase + WALL_THICKNESS}
                      y2={offsetIn + widthIn}
                      stroke="#1e293b"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </g>

            {/* 3. Exterior Architectural Dimension Strings */}
            <g id="dimensions-layer">
              {/* Major North dimension string (Room Width) */}
              <g className="dim-north">
                <line
                  x1={0}
                  y1={-24.5}
                  x2={effectiveState.widthIn}
                  y2={-24.5}
                  stroke="#64748b"
                  strokeWidth="1"
                />
                {/* 45-degree diagonal witness ticks */}
                <line x1={-2} y1={-22.5} x2={2} y2={-26.5} stroke="#94a3b8" strokeWidth="1.5" />
                <line
                  x1={effectiveState.widthIn - 2}
                  y1={-22.5}
                  x2={effectiveState.widthIn + 2}
                  y2={-26.5}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                {/* Extension witness lines */}
                <line
                  x1={0}
                  y1={-6}
                  x2={0}
                  y2={-28}
                  stroke="#475569"
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                />
                <line
                  x1={effectiveState.widthIn}
                  y1={-6}
                  x2={effectiveState.widthIn}
                  y2={-28}
                  stroke="#475569"
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                />
                {/* Centered label */}
                <text
                  x={effectiveState.widthIn / 2}
                  y={-28}
                  fill="#94a3b8"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {formatDimension(effectiveState.widthIn)}
                </text>
              </g>

              {/* Major West dimension string (Room Length) */}
              <g className="dim-west">
                <line
                  x1={-24.5}
                  y1={0}
                  x2={-24.5}
                  y2={effectiveState.lengthIn}
                  stroke="#64748b"
                  strokeWidth="1"
                />
                {/* 45-degree diagonal witness ticks */}
                <line x1={-26.5} y1={-2} x2={-22.5} y2={2} stroke="#94a3b8" strokeWidth="1.5" />
                <line
                  x1={-26.5}
                  y1={effectiveState.lengthIn - 2}
                  x2={-22.5}
                  y2={effectiveState.lengthIn + 2}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                {/* Extension witness lines */}
                <line
                  x1={-6}
                  y1={0}
                  x2={-28}
                  y2={0}
                  stroke="#475569"
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                />
                <line
                  x1={-6}
                  y1={effectiveState.lengthIn}
                  x2={-28}
                  y2={effectiveState.lengthIn}
                  stroke="#475569"
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                />
                {/* Centered label rotated */}
                <text
                  x={-28}
                  y={effectiveState.lengthIn / 2}
                  fill="#94a3b8"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="600"
                  transform={`rotate(-90, -28, ${effectiveState.lengthIn / 2})`}
                >
                  {formatDimension(effectiveState.lengthIn)}
                </text>
              </g>
            </g>

            {/* 4. Utility Service Anchors Layer & Proximity Lines */}
            <g id="utility-anchors-layer">
              {/* Proximity connector lines from placed fixtures to nearest matching anchor */}
              {effectiveState.items.map((item) => {
                const product = resolveCatalogProduct(item.productId, catalog);
                const itemCenter = centerOf(footprintOf(item, product));
                const anchors = effectiveState.serviceAnchors || [];

                const lines: React.ReactNode[] = [];

                // Plumbing proximity
                if (product.requiresPlumbing) {
                  const waterAnchor = anchors.find((a) => a.kind === 'water');
                  if (waterAnchor) {
                    const pt = pointOnWall(effectiveState, waterAnchor.wall, waterAnchor.offsetIn);
                    lines.push(
                      <line
                        key={`line-water-${item.id}`}
                        x1={itemCenter.x}
                        y1={itemCenter.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke="#0284c7"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />,
                    );
                  }
                  const drainAnchor = anchors.find((a) => a.kind === 'drain');
                  if (drainAnchor) {
                    const pt = pointOnWall(effectiveState, drainAnchor.wall, drainAnchor.offsetIn);
                    lines.push(
                      <line
                        key={`line-drain-${item.id}`}
                        x1={itemCenter.x}
                        y1={itemCenter.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke="#2563eb"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />,
                    );
                  }
                }

                // Electrical proximity
                if (product.requiresElectrical) {
                  const is240v = product.category === 'range' || product.category === 'wall_oven';
                  const anchor = anchors.find((a) =>
                    is240v ? a.kind === 'electrical_240v' : a.kind === 'electrical_120v',
                  );
                  if (anchor) {
                    const pt = pointOnWall(effectiveState, anchor.wall, anchor.offsetIn);
                    lines.push(
                      <line
                        key={`line-elec-${item.id}`}
                        x1={itemCenter.x}
                        y1={itemCenter.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke={is240v ? '#7c3aed' : '#06b6d4'}
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />,
                    );
                  }
                }

                // Gas proximity
                if (product.category === 'range' || product.category === 'cooktop') {
                  const gasAnchor = anchors.find((a) => a.kind === 'gas');
                  if (gasAnchor) {
                    const pt = pointOnWall(effectiveState, gasAnchor.wall, gasAnchor.offsetIn);
                    lines.push(
                      <line
                        key={`line-gas-${item.id}`}
                        x1={itemCenter.x}
                        y1={itemCenter.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke="#eab308"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />,
                    );
                  }
                }

                // Vent proximity
                if (product.requiresVenting) {
                  const ventAnchor = anchors.find((a) => a.kind === 'vent');
                  if (ventAnchor) {
                    const pt = pointOnWall(effectiveState, ventAnchor.wall, ventAnchor.offsetIn);
                    lines.push(
                      <line
                        key={`line-vent-${item.id}`}
                        x1={itemCenter.x}
                        y1={itemCenter.y}
                        x2={pt.x}
                        y2={pt.y}
                        stroke="#059669"
                        strokeWidth="1.25"
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />,
                    );
                  }
                }

                return lines;
              })}

              {/* Render each utility anchor glyph on the wall */}
              {(effectiveState.serviceAnchors || []).map((anchor) => {
                const conf = getUtilityConfig(anchor.kind);
                let cx = anchor.offsetIn;
                let cy = 0;
                if (anchor.wall === 'north') {
                  cx = anchor.offsetIn;
                  cy = -WALL_THICKNESS / 2;
                } else if (anchor.wall === 'south') {
                  cx = anchor.offsetIn;
                  cy = effectiveState.lengthIn + WALL_THICKNESS / 2;
                } else if (anchor.wall === 'west') {
                  cx = -WALL_THICKNESS / 2;
                  cy = anchor.offsetIn;
                } else if (anchor.wall === 'east') {
                  cx = effectiveState.widthIn + WALL_THICKNESS / 2;
                  cy = anchor.offsetIn;
                }

                return (
                  <g key={anchor.id} className="service-anchor">
                    <title>{`${conf.name} (${anchor.wall} @ ${anchor.offsetIn}")`}</title>
                    {conf.symbol === 'circle' && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={conf.color}
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                    )}
                    {conf.symbol === 'diamond' && (
                      <rect
                        x={cx - 3.5}
                        y={cy - 3.5}
                        width={7}
                        height={7}
                        fill={conf.color}
                        stroke="#0f172a"
                        strokeWidth="1"
                        transform={`rotate(45, ${cx}, ${cy})`}
                      />
                    )}
                    {conf.symbol === 'rect' && (
                      <rect
                        x={cx - 5}
                        y={cy - 3}
                        width={10}
                        height={6}
                        rx={1.5}
                        fill={conf.color}
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                    )}
                    {conf.symbol === 'hexagon' && (
                      <polygon
                        points={`${cx - 4},${cy - 2} ${cx},${cy - 4} ${cx + 4},${cy - 2} ${cx + 4},${cy + 2} ${cx},${cy + 4} ${cx - 4},${cy + 2}`}
                        fill={conf.color}
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                    )}
                    {conf.symbol === 'square' && (
                      <rect
                        x={cx - 4}
                        y={cy - 4}
                        width={8}
                        height={8}
                        rx={1}
                        fill={conf.color}
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                    )}
                    <text
                      x={cx}
                      y={cy + 1.2}
                      fill="#ffffff"
                      fontSize={
                        anchor.kind.includes('240') || anchor.kind.includes('120') ? '2.5' : '4'
                      }
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      textAnchor="middle"
                    >
                      {conf.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* 5. NKBA Work Triangle Layer */}
            {workTriangle && (
              <g id="nkba-triangle-layer">
                <polygon
                  points={`${workTriangle.sinkCenter.x},${workTriangle.sinkCenter.y} ${workTriangle.cooktopCenter.x},${workTriangle.cooktopCenter.y} ${workTriangle.fridgeCenter.x},${workTriangle.fridgeCenter.y}`}
                  fill={
                    workTriangle.compliant ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'
                  }
                  stroke={workTriangle.compliant ? '#10b981' : '#f59e0b'}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {/* Centroid Badge */}
                <g
                  transform={`translate(${workTriangle.centroid.x - 22}, ${workTriangle.centroid.y - 8})`}
                >
                  <rect
                    width={44}
                    height={16}
                    rx={3}
                    fill="#090d16"
                    stroke={workTriangle.compliant ? '#10b981' : '#f59e0b'}
                    strokeWidth="1"
                    opacity={0.9}
                  />
                  <text
                    x={22}
                    y={5.5}
                    fill="#94a3b8"
                    fontSize="3.2"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    NKBA Work Triangle
                  </text>
                  <text
                    x={22}
                    y={10.5}
                    fill="#f8fafc"
                    fontSize="4"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {Math.round(workTriangle.perimeter)}&quot; (
                    {formatDimension(Math.round(workTriangle.perimeter))})
                  </text>
                  <text
                    x={22}
                    y={14.5}
                    fill={workTriangle.compliant ? '#34d399' : '#fbbf24'}
                    fontSize="3"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {workTriangle.compliant ? '✓ NKBA Compliant' : '⚠ NKBA Warning'}
                  </text>
                </g>
              </g>
            )}

            {/* 6. Fixture Bounding Boxes, Orientation, Clearances & Dragging Layer */}
            <g id="fixtures-layer">
              {effectiveState.items.map((item) => {
                const product = resolveCatalogProduct(item.productId, catalog);
                const isDragging = draggingItemId === item.id;
                const currentPos =
                  isDragging && dragPreview ? dragPreview : { x: item.x, y: item.y };
                const virtualItem = { ...item, x: currentPos.x, y: currentPos.y };
                const box = footprintOf(virtualItem, product);
                const w = widthOf(box);
                const d = depthOf(box);
                const isSelected = selectedItemId === item.id;
                const isHovered = hoveredItemId === item.id;

                // Clearance zone
                let clearanceElement: React.ReactNode = null;
                if (product.clearanceIn > 0) {
                  const cBox = stripInFront(box, item.rotation, product.clearanceIn);
                  const isClearanceObstructed =
                    !fitsInsideRoom(effectiveState, cBox) ||
                    effectiveState.items.some((other) => {
                      if (other.id === item.id) return false;
                      const otherProd = resolveCatalogProduct(other.productId, catalog);
                      return overlaps(cBox, footprintOf(other, otherProd));
                    });

                  clearanceElement = (
                    <rect
                      x={cBox.left}
                      y={cBox.top}
                      width={widthOf(cBox)}
                      height={depthOf(cBox)}
                      fill={
                        isClearanceObstructed
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(56, 189, 248, 0.08)'
                      }
                      stroke={isClearanceObstructed ? '#ef4444' : '#0284c7'}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  );
                }

                // Front chevron direction
                const cx = box.left + w / 2;
                const cy = box.top + d / 2;
                let chevronD = '';
                if (item.rotation === 0) {
                  // South (down)
                  chevronD = `M ${cx - 3.5} ${box.bottom - 4} L ${cx} ${box.bottom - 1} L ${cx + 3.5} ${box.bottom - 4}`;
                } else if (item.rotation === 90) {
                  // West (left)
                  chevronD = `M ${box.left + 4} ${cy - 3.5} L ${box.left + 1} ${cy} L ${box.left + 4} ${cy + 3.5}`;
                } else if (item.rotation === 180) {
                  // North (up)
                  chevronD = `M ${cx - 3.5} ${box.top + 4} L ${cx} ${box.top + 1} L ${cx + 3.5} ${box.top + 4}`;
                } else if (item.rotation === 270) {
                  // East (right)
                  chevronD = `M ${box.right - 4} ${cy - 3.5} L ${box.right - 1} ${cy} L ${box.right - 4} ${cy + 3.5}`;
                }

                return (
                  <g
                    key={item.id}
                    id={`fixture-${item.id}`}
                    className="fixture-item cursor-grab active:cursor-grabbing transition-opacity"
                    onPointerDown={(e) => handleItemPointerDown(e, item)}
                    onPointerMove={(e) => handleItemPointerMove(e, item)}
                    onPointerUp={(e) => handleItemPointerUp(e, item)}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{ opacity: isDragging ? 0.9 : 1 }}
                  >
                    {/* Fixture clearance corridor */}
                    {clearanceElement}

                    {/* Base Footprint Rect */}
                    <rect
                      x={box.left}
                      y={box.top}
                      width={w}
                      height={d}
                      rx={2}
                      fill={isSelected ? '#1e293b' : isHovered ? '#1a2333' : '#0f172a'}
                      stroke={
                        isDragging && dragCollision
                          ? '#ef4444'
                          : isSelected
                            ? '#3b82f6'
                            : isHovered
                              ? '#60a5fa'
                              : '#475569'
                      }
                      strokeWidth={isSelected || (isDragging && dragCollision) ? 2 : 1}
                    />

                    {/* Category-Specific Drafting Details */}
                    {/* Cabinets / Vanity / Island: Quartz border & carcass reveal */}
                    {(product.category === 'base_cabinet' ||
                      product.category === 'vanity' ||
                      product.category === 'island') && (
                      <g className="cabinet-details">
                        <rect
                          x={box.left + 2}
                          y={box.top + 2}
                          width={w - 4}
                          height={d - 4}
                          fill="none"
                          stroke="#334155"
                          strokeWidth="0.75"
                        />
                        {product.category === 'vanity' && (
                          <ellipse
                            cx={cx}
                            cy={cy}
                            rx={Math.min(10, w / 3)}
                            ry={Math.min(7, d / 3)}
                            fill="none"
                            stroke="#0284c7"
                            strokeWidth="1"
                          />
                        )}
                        {product.category === 'island' && (
                          <line
                            x1={box.left + 2}
                            y1={box.bottom - 8}
                            x2={box.right - 2}
                            y2={box.bottom - 8}
                            stroke="#64748b"
                            strokeWidth="0.75"
                            strokeDasharray="2 2"
                          />
                        )}
                      </g>
                    )}

                    {/* Sink: Dual basin rim and drain */}
                    {product.category === 'sink' && (
                      <g className="sink-details">
                        <rect
                          x={box.left + 2.5}
                          y={box.top + 2.5}
                          width={w - 5}
                          height={d - 5}
                          rx={1.5}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="1"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={2}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="1"
                        />
                      </g>
                    )}

                    {/* Range / Cooktop: 4 Burners with cross grates */}
                    {(product.category === 'range' || product.category === 'cooktop') && (
                      <g className="burners-details">
                        {[
                          { bx: box.left + w * 0.3, by: box.top + d * 0.3, r: Math.min(4, w / 7) },
                          {
                            bx: box.left + w * 0.7,
                            by: box.top + d * 0.3,
                            r: Math.min(4.5, w / 6.5),
                          },
                          {
                            bx: box.left + w * 0.3,
                            by: box.top + d * 0.7,
                            r: Math.min(4.5, w / 6.5),
                          },
                          { bx: box.left + w * 0.7, by: box.top + d * 0.7, r: Math.min(4, w / 7) },
                        ].map((b, bIdx) => (
                          <g key={bIdx}>
                            <circle
                              cx={b.bx}
                              cy={b.by}
                              r={b.r}
                              fill="none"
                              stroke="#ca8a04"
                              strokeWidth="1"
                            />
                            <line
                              x1={b.bx - b.r}
                              y1={b.by}
                              x2={b.bx + b.r}
                              y2={b.by}
                              stroke="#ca8a04"
                              strokeWidth="0.75"
                            />
                            <line
                              x1={b.bx}
                              y1={b.by - b.r}
                              x2={b.bx}
                              y2={b.by + b.r}
                              stroke="#ca8a04"
                              strokeWidth="0.75"
                            />
                          </g>
                        ))}
                      </g>
                    )}

                    {/* Toilet: Contoured bowl and rear tank */}
                    {product.category === 'toilet' && (
                      <g className="toilet-details">
                        <rect
                          x={box.left + 2}
                          y={box.top + 1.5}
                          width={w - 4}
                          height={7}
                          rx={1}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1"
                        />
                        <ellipse
                          cx={cx}
                          cy={box.top + 17}
                          rx={w / 2 - 3}
                          ry={8}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1"
                        />
                      </g>
                    )}

                    {/* Refrigerator: French door divide line & handles */}
                    {product.category === 'refrigerator' && (
                      <g className="fridge-details">
                        <line
                          x1={cx}
                          y1={box.top + 2}
                          x2={cx}
                          y2={box.bottom - 2}
                          stroke="#94a3b8"
                          strokeWidth="1"
                        />
                        <line
                          x1={box.left + 2}
                          y1={box.bottom - 4}
                          x2={box.right - 2}
                          y2={box.bottom - 4}
                          stroke="#64748b"
                          strokeWidth="0.75"
                        />
                      </g>
                    )}

                    {/* Shower: Perimeter curb and floor drain */}
                    {product.category === 'shower' && (
                      <g className="shower-details">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={2.5}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1"
                        />
                        <line
                          x1={cx - 2.5}
                          y1={cy}
                          x2={cx + 2.5}
                          y2={cy}
                          stroke="#38bdf8"
                          strokeWidth="0.75"
                        />
                        <line
                          x1={cx}
                          y1={cy - 2.5}
                          x2={cx + 2.5}
                          y2={cy}
                          stroke="#38bdf8"
                          strokeWidth="0.75"
                        />
                      </g>
                    )}

                    {/* Front Orientation Chevron */}
                    {chevronD && (
                      <path
                        d={chevronD}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Fixture Name / SKU Label */}
                    <text
                      x={cx}
                      y={cy - 1}
                      fill="#e2e8f0"
                      fontSize="3.8"
                      fontWeight="600"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      {product.name}
                    </text>
                    <text
                      x={cx}
                      y={cy + 4}
                      fill="#64748b"
                      fontSize="2.8"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {w}&quot; &times; {d}&quot; ({item.rotation}&deg;)
                    </text>

                    {/* Work Center Indicator Badge (S, C, R) */}
                    {product.workCenter && (
                      <g transform={`translate(${box.right - 7}, ${box.top + 2})`}>
                        <circle
                          cx={3}
                          cy={3}
                          r={3.5}
                          fill={
                            product.workCenter === 'sink'
                              ? '#0284c7'
                              : product.workCenter === 'cooktop'
                                ? '#ea580c'
                                : '#10b981'
                          }
                          stroke="#090d16"
                          strokeWidth="1"
                        />
                        <text
                          x={3}
                          y={4.2}
                          fill="#ffffff"
                          fontSize="3.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          {product.workCenter === 'sink'
                            ? 'S'
                            : product.workCenter === 'cooktop'
                              ? 'C'
                              : 'R'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 7. Proposal Preview Overlays Layer (#proposal-layer) */}
            {/* CONSTITUTIONAL INVARIANT: This layer ONLY reads activeProposal and NEVER mutates roomState */}
            {activeProposal && activeProposal.status === 'pending_human' && (
              <g id="proposal-layer">
                {activeProposal.operations.map((op, opIdx) => {
                  if (op.type === 'place') {
                    const product = resolveCatalogProduct(op.productId, catalog);
                    const dummyItem: RoomItem = {
                      id: `preview-${opIdx}`,
                      productId: op.productId,
                      x: op.x,
                      y: op.y,
                      rotation: op.rotation,
                    };
                    const box = footprintOf(dummyItem, product);
                    const w = widthOf(box);
                    const d = depthOf(box);
                    return (
                      <g key={`prop-place-${opIdx}`} className="proposal-place">
                        <rect
                          x={box.left}
                          y={box.top}
                          width={w}
                          height={d}
                          rx={2}
                          fill="rgba(245, 158, 11, 0.18)"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                        />
                        <text
                          x={box.left + w / 2}
                          y={box.top + d / 2}
                          fill="#f59e0b"
                          fontSize="3.8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          + Proposed ({product.name})
                        </text>
                      </g>
                    );
                  }

                  if (op.type === 'move') {
                    const target = effectiveState.items.find((i) => i.id === op.itemId);
                    if (!target) return null;
                    const product = resolveCatalogProduct(target.productId, catalog);
                    const oldBox = footprintOf(target, product);
                    const oldCenter = centerOf(oldBox);

                    const dummyItem: RoomItem = {
                      id: `preview-move-${opIdx}`,
                      productId: target.productId,
                      x: op.x,
                      y: op.y,
                      rotation: op.rotation,
                    };
                    const newBox = footprintOf(dummyItem, product);
                    const newCenter = centerOf(newBox);

                    return (
                      <g key={`prop-move-${opIdx}`} className="proposal-move">
                        <rect
                          x={newBox.left}
                          y={newBox.top}
                          width={widthOf(newBox)}
                          height={depthOf(newBox)}
                          rx={2}
                          fill="rgba(245, 158, 11, 0.18)"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                        />
                        <line
                          x1={oldCenter.x}
                          y1={oldCenter.y}
                          x2={newCenter.x}
                          y2={newCenter.y}
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          markerEnd="url(#amber-arrow)"
                        />
                        <text
                          x={newCenter.x}
                          y={newCenter.y - 2}
                          fill="#f59e0b"
                          fontSize="3.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          Proposed Move
                        </text>
                      </g>
                    );
                  }

                  if (op.type === 'remove') {
                    const target = effectiveState.items.find((i) => i.id === op.itemId);
                    if (!target) return null;
                    const product = resolveCatalogProduct(target.productId, catalog);
                    const box = footprintOf(target, product);
                    return (
                      <g key={`prop-remove-${opIdx}`} className="proposal-remove">
                        <rect
                          x={box.left}
                          y={box.top}
                          width={widthOf(box)}
                          height={depthOf(box)}
                          fill="rgba(239, 68, 68, 0.2)"
                          stroke="#ef4444"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        <line
                          x1={box.left}
                          y1={box.top}
                          x2={box.right}
                          y2={box.bottom}
                          stroke="#ef4444"
                          strokeWidth="2"
                        />
                        <line
                          x1={box.left}
                          y1={box.bottom}
                          x2={box.right}
                          y2={box.top}
                          stroke="#ef4444"
                          strokeWidth="2"
                        />
                        <text
                          x={box.left + widthOf(box) / 2}
                          y={box.top + depthOf(box) / 2 + 1}
                          fill="#ef4444"
                          fontSize="3.6"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ✕ Staged for Removal
                        </text>
                      </g>
                    );
                  }

                  return null;
                })}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Canvas Status & Legend Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/60 px-4 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span>Water (W)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Drain (D)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span>Gas (G)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>120V</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            <span>240V</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Vent (V)</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span>Scale: 1 SVG in = 1 in</span>
          <span>&bull;</span>
          <span>
            Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})
          </span>
          <span>&bull;</span>
          <span>Items: {effectiveState.items.length}</span>
        </div>
      </div>
    </div>
  );
};

export default Canvas2D;
