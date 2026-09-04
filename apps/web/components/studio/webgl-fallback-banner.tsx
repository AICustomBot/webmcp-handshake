'use client';

import React from 'react';
import { AlertTriangle, Compass, RotateCcw, X } from 'lucide-react';
import { useStudioStore } from '@/lib/store/studio-store';

export function WebGLFallbackBanner() {
  const { webglStatus, webglError, setWebGLStatus, setViewportMode } = useStudioStore();

  if (webglStatus !== 'unsupported' && webglStatus !== 'context_lost') {
    return null;
  }

  const isContextLost = webglStatus === 'context_lost';

  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-950/40 px-4 sm:px-6 py-2.5 text-xs text-amber-200 backdrop-blur-md"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
        <div>
          <span className="font-semibold">
            {isContextLost ? 'WebGL Graphics Context Lost' : 'WebGL 3D Acceleration Unavailable'}
          </span>
          <span className="text-amber-300/80 ml-1.5 hidden sm:inline">
            {isContextLost
              ? 'Mobile GPU memory reclaimed context. Automatically reverted to 2D Architectural Canvas.'
              : webglError ||
                'Host browser or WebView restricted WebGL context creation. 2D Architectural Canvas is active with 100% co-design capabilities.'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => {
            setWebGLStatus('ready');
            setViewportMode('3d');
          }}
          className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
          title="Attempt to re-initialize 3D graphics context"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Retry 3D</span>
        </button>

        <button
          type="button"
          onClick={() => setViewportMode('2d')}
          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          title="Stay in 2D Floorplan"
        >
          <Compass className="h-3 w-3 text-blue-400" />
          <span>2D Plan</span>
        </button>

        <button
          type="button"
          onClick={() => setWebGLStatus('ready')}
          className="rounded p-1 text-amber-400/70 hover:text-amber-200 transition-colors"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
