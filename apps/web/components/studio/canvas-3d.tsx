'use client';

import React, { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Operation, Product, RoomItem, RoomState } from '@handshake/contracts';
import { useStudioStore } from '@/lib/store/studio-store';
import { checkWebGLCapability } from '@/lib/3d/webgl-detector';
import { StudioLighting } from '@/lib/3d/lighting';
import { CameraRig } from '@/lib/3d/camera-rig';
import { RoomEnvelope } from '@/lib/3d/room-envelope';
import { ParametricFixture3D } from '@/lib/3d/parametric-models';
import { PBR_MATERIALS } from '@/lib/3d/materials';
import { resolveCatalogProduct, FALLBACK_CATALOG } from './canvas-2d-utils';

/**
 * Context loss listener inside the Canvas Three.js rendering context.
 * Intercepts GPU eviction and triggers automated fallback to 2D.
 */
function WebGLContextLossWatcher() {
  const { gl } = useThree();
  const setWebGLStatus = useStudioStore((s) => s.setWebGLStatus);

  useEffect(() => {
    const dom = gl.domElement;

    const handleContextLost = (event: Event) => {
      event.preventDefault(); // Prevents browser crash
      console.warn('[Handshake 3D] WebGL context lost. Executing automatic fallback to 2D.');
      setWebGLStatus('context_lost', 'GPU memory reclaimed WebGL context');
    };

    dom.addEventListener('webglcontextlost', handleContextLost, false);
    return () => {
      dom.removeEventListener('webglcontextlost', handleContextLost);
    };
  }, [gl, setWebGLStatus]);

  return null;
}

/**
 * Renders pending proposal operations as holographic amber ghost meshes.
 * Zero-Mutation Guarantee: Committed room items remain 100% untouched.
 */
function ProposalGhostLayer({
  state,
  catalog,
  operations,
}: {
  state: RoomState;
  catalog: Product[];
  operations: Operation[];
}) {
  const ghostItems = useMemo(() => {
    const items: Array<{
      key: string;
      item: RoomItem;
      product: Product;
      type: 'place' | 'move' | 'swap' | 'remove';
      originalItem?: RoomItem;
    }> = [];

    for (let idx = 0; idx < operations.length; idx++) {
      const op = operations[idx];

      if (op.type === 'place') {
        const prod = resolveCatalogProduct(op.productId, catalog);
        const synthItem: RoomItem = {
          id: `ghost-place-${idx}`,
          productId: op.productId,
          x: op.x,
          y: op.y,
          rotation: op.rotation,
        };
        items.push({ key: `ghost-place-${idx}`, item: synthItem, product: prod, type: 'place' });
      } else if (op.type === 'move') {
        const orig = state.items.find((i) => i.id === op.itemId);
        if (orig) {
          const prod = resolveCatalogProduct(orig.productId, catalog);
          const synthItem: RoomItem = {
            id: `ghost-move-${idx}`,
            productId: orig.productId,
            x: op.x,
            y: op.y,
            rotation: op.rotation,
          };
          items.push({
            key: `ghost-move-${idx}`,
            item: synthItem,
            product: prod,
            type: 'move',
            originalItem: orig,
          });
        }
      } else if (op.type === 'swap') {
        const orig = state.items.find((i) => i.id === op.itemId);
        if (orig) {
          const prod = resolveCatalogProduct(op.replacementProductId, catalog);
          const synthItem: RoomItem = {
            id: `ghost-swap-${idx}`,
            productId: op.replacementProductId,
            x: orig.x,
            y: orig.y,
            rotation: orig.rotation,
          };
          items.push({ key: `ghost-swap-${idx}`, item: synthItem, product: prod, type: 'swap' });
        }
      } else if (op.type === 'remove') {
        const orig = state.items.find((i) => i.id === op.itemId);
        if (orig) {
          const prod = resolveCatalogProduct(orig.productId, catalog);
          items.push({
            key: `ghost-remove-${idx}`,
            item: orig,
            product: prod,
            type: 'remove',
            originalItem: orig,
          });
        }
      }
    }

    return items;
  }, [operations, state.items, catalog]);

  return (
    <group name="proposal-ghost-layer">
      {ghostItems.map((g) => {
        const heightIn = g.product.heightIn ?? 34;

        if (g.type === 'remove') {
          // Staged for removal: pulsed red wireframe box around committed item
          return (
            <group
              key={g.key}
              position={[
                g.item.x + g.product.widthIn / 2,
                heightIn / 2,
                g.item.y + g.product.depthIn / 2,
              ]}
            >
              <mesh>
                <boxGeometry args={[g.product.widthIn + 2, heightIn + 2, g.product.depthIn + 2]} />
                <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.8} />
              </mesh>
            </group>
          );
        }

        // Motion arc geometry for move operations
        let motionArcGeometry: THREE.BufferGeometry | null = null;
        if (g.type === 'move' && g.originalItem) {
          const origX = g.originalItem.x + g.product.widthIn / 2;
          const origZ = g.originalItem.y + g.product.depthIn / 2;
          const destX = g.item.x + g.product.widthIn / 2;
          const destZ = g.item.y + g.product.depthIn / 2;
          const midX = (origX + destX) / 2;
          const midZ = (origZ + destZ) / 2;
          const pts = [
            new THREE.Vector3(origX, 2, origZ),
            new THREE.Vector3(midX, 14, midZ),
            new THREE.Vector3(destX, 2, destZ),
          ];
          motionArcGeometry = new THREE.BufferGeometry().setFromPoints(pts);
        }

        return (
          <group key={g.key}>
            <ParametricFixture3D item={g.item} product={g.product} isGhost={true} />

            {/* Motion connection line for move operations */}
            {motionArcGeometry && (
              <primitive
                object={
                  new THREE.Line(
                    motionArcGeometry,
                    new THREE.LineBasicMaterial({ color: '#f59e0b' }),
                  )
                }
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Inner Scene Component rendering the entire 3D architectural co-design space.
 */
export function StudioScene() {
  const { roomState, catalog, activeProposal, cameraMode, selectedItemId, selectItem } =
    useStudioStore();

  const effectiveState: RoomState = useMemo(() => {
    if (roomState) return roomState;
    return {
      sessionId: 'empty-3d-scene',
      version: 0,
      widthIn: 144,
      lengthIn: 180,
      budgetCents: 2000000,
      roomType: 'kitchen',
      items: [],
      openings: [],
      serviceAnchors: [],
    };
  }, [roomState]);

  const effectiveCatalog = catalog.length > 0 ? catalog : (FALLBACK_CATALOG as Product[]);

  return (
    <>
      <WebGLContextLossWatcher />

      {/* Studio Lighting with Sun, Fill, and Contact Shadows */}
      <StudioLighting state={effectiveState} />

      {/* Multi-Camera Controller (Orbit / Walkthrough 60" / Ortho) */}
      <CameraRig state={effectiveState} cameraMode={cameraMode} />

      {/* Procedural 96" Walls with Openings and Floor Slab */}
      <RoomEnvelope state={effectiveState} showCeiling={cameraMode === 'first-person'} />

      {/* Committed Placed 3D Parametric Fixtures */}
      <group name="committed-fixtures-layer">
        {effectiveState.items.map((item) => {
          const product = resolveCatalogProduct(item.productId, effectiveCatalog);
          const isSelected = selectedItemId === item.id;
          return (
            <ParametricFixture3D
              key={item.id}
              item={item}
              product={product}
              isSelected={isSelected}
              onSelect={selectItem}
            />
          );
        })}
      </group>

      {/* Non-Mutating Holographic Proposal Ghost Overlay */}
      {activeProposal && activeProposal.operations.length > 0 && (
        <ProposalGhostLayer
          state={effectiveState}
          catalog={effectiveCatalog}
          operations={activeProposal.operations}
        />
      )}
    </>
  );
}

/**
 * Authoritative 3D Canvas Scene Component.
 * Encapsulates the WebGL Canvas, capability check, and fallback dispatch.
 */
export function Canvas3DScene() {
  const setWebGLStatus = useStudioStore((s) => s.setWebGLStatus);

  useEffect(() => {
    const capability = checkWebGLCapability();
    if (!capability.supported) {
      console.warn('[Handshake 3D] WebGL capability check failed:', capability.error);
      setWebGLStatus('unsupported', capability.error);
    }
  }, [setWebGLStatus]);

  return (
    <div
      className="relative flex h-full w-full min-h-[560px] md:min-h-[640px] flex-1 overflow-hidden rounded-2xl bg-[#090d16] select-none touch-none"
      id="handshake-canvas-3d-container"
    >
      <Canvas
        shadows
        camera={{ fov: 45, near: 1, far: 2000 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
        className="h-full w-full"
      >
        <StudioScene />
      </Canvas>
    </div>
  );
}

export default Canvas3DScene;
