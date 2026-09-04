'use client';

import React from 'react';
import { Box, Loader2 } from 'lucide-react';

export interface CanvasSkeletonProps {
  message?: string;
  submessage?: string;
}

export function CanvasSkeleton({
  message = 'Initializing 3D Spatial Studio...',
  submessage = 'Compiling WebGL shaders & procedural parametric assets',
}: CanvasSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading 3D visualizer"
      className="relative flex h-full w-full min-h-[560px] md:min-h-[640px] flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#0a0e17] text-slate-200"
    >
      {/* Background Animated Perspective Grid */}
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <svg
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <defs>
            <pattern id="skeleton-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(99, 102, 241, 0.3)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="skeleton-vignette" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="#0a0e17" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#skeleton-grid)" />
          <rect width="100%" height="100%" fill="url(#skeleton-vignette)" />
        </svg>
      </div>

      {/* Center Holographic Spinner Card */}
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-indigo-500/20 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shadow-inner">
          <Box className="h-8 w-8 animate-pulse text-indigo-400" />
          <div className="absolute -inset-1 rounded-2xl border border-indigo-400/20 animate-ping opacity-30" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-100">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span>{message}</span>
          </div>
          <p className="text-xs text-slate-400">{submessage}</p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] font-mono text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Three.js v0.185 &bull; R3F v9.7</span>
        </div>
      </div>
    </div>
  );
}
