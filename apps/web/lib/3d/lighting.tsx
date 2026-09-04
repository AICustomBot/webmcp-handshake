'use client';

import React from 'react';
import { ContactShadows } from '@react-three/drei';
import type { RoomState } from '@handshake/contracts';

interface StudioLightingProps {
  state: RoomState;
}

export function StudioLighting({ state }: StudioLightingProps) {
  const { widthIn, lengthIn } = state;
  const shadowScale = Math.max(widthIn, lengthIn) * 1.6;

  return (
    <group name="studio-lighting">
      {/* 1. Warm Ambient Base Fill */}
      <ambientLight intensity={0.42} color="#f8fafc" />

      {/* 2. Hemisphere Ground/Sky Balance */}
      <hemisphereLight
        color="#ffffff"
        groundColor="#334155"
        intensity={0.35}
        position={[widthIn / 2, 100, lengthIn / 2]}
      />

      {/* 3. Directional Architectural Sunlight */}
      <directionalLight
        position={[widthIn * 0.85, 220, lengthIn * 0.4]}
        intensity={1.65}
        color="#fffbeb"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={600}
        shadow-camera-left={-widthIn}
        shadow-camera-right={widthIn}
        shadow-camera-top={lengthIn}
        shadow-camera-bottom={-lengthIn}
        shadow-bias={-0.0001}
      />

      {/* 4. Secondary Soft Interior Cross-Fill Light */}
      <directionalLight
        position={[-widthIn * 0.5, 120, -lengthIn * 0.5]}
        intensity={0.4}
        color="#e0e7ff"
      />

      {/* 5. Drei High-Definition Floor Contact Shadows */}
      <ContactShadows
        position={[widthIn / 2, 0.05, lengthIn / 2]}
        opacity={0.65}
        scale={shadowScale}
        blur={1.8}
        far={60}
        resolution={1024}
        color="#0f172a"
      />
    </group>
  );
}
