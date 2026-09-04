'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { CanvasSkeleton } from './canvas-skeleton';

/**
 * Dynamic SSR-Safe 3D Spatial Visualizer Loader.
 * Guarantees zero SSR window/document/WebGL hydration errors by restricting
 * Three.js and R3F context compilation exclusively to client execution.
 */
export const DynamicCanvas3D = dynamic(
  () => import('./canvas-3d').then((mod) => mod.Canvas3DScene),
  {
    ssr: false,
    loading: () => <CanvasSkeleton message="Initializing 3D Spatial Studio..." />,
  },
);

export function Canvas3DWrapper() {
  return <DynamicCanvas3D />;
}

export default Canvas3DWrapper;
