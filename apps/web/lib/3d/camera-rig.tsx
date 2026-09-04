'use client';

import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { RoomState } from '@handshake/contracts';

export type StudioCameraMode = 'orbit' | 'first-person' | 'orthographic';

interface CameraRigProps {
  state: RoomState;
  cameraMode: StudioCameraMode;
}

export function CameraRig({ state, cameraMode }: CameraRigProps) {
  const { widthIn, lengthIn } = state;
  const { camera, gl } = useThree();
  const orbitRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  // First-person state tracking
  const fpState = useRef({
    x: widthIn / 2,
    y: 60, // Human eye-level 60" elevation
    z: lengthIn * 0.75,
    yaw: 0,
    pitch: 0,
    keys: { forward: false, backward: false, left: false, right: false },
    isPointerDown: false,
    prevPointerX: 0,
    prevPointerY: 0,
  });

  const roomCenter = useRef<[number, number, number]>([widthIn / 2, 36, lengthIn / 2]);

  // Update room center when state changes
  useEffect(() => {
    roomCenter.current = [widthIn / 2, 36, lengthIn / 2];
    fpState.current.x = widthIn / 2;
    fpState.current.z = lengthIn * 0.75;
  }, [widthIn, lengthIn]);

  // Switch camera mode setup
  useEffect(() => {
    const center = roomCenter.current;

    if (cameraMode === 'orbit') {
      // Perspective diagonal flight view
      camera.up.set(0, 1, 0);
      camera.position.set(widthIn * 1.35, Math.max(120, lengthIn * 1.1), lengthIn * 1.35);
      camera.lookAt(center[0], center[1], center[2]);
      if (orbitRef.current) {
        orbitRef.current.target.set(center[0], center[1], center[2]);
        orbitRef.current.enabled = true;
        orbitRef.current.enableRotate = true;
        orbitRef.current.maxPolarAngle = Math.PI / 2 - 0.05; // Do not go below floor
        orbitRef.current.update();
      }
    } else if (cameraMode === 'first-person') {
      // Walkthrough eye-level elevation
      if (orbitRef.current) {
        orbitRef.current.enabled = false;
      }
      camera.up.set(0, 1, 0);
      const fp = fpState.current;
      fp.x = Math.max(15, Math.min(widthIn - 15, widthIn / 2));
      fp.z = Math.max(15, Math.min(lengthIn - 15, lengthIn * 0.75));
      fp.y = 60;
      fp.yaw = Math.PI; // Face North initially
      fp.pitch = 0;

      camera.position.set(fp.x, fp.y, fp.z);
      camera.lookAt(fp.x, fp.y, fp.z - 50);
    } else if (cameraMode === 'orthographic') {
      // Top-Down Plan view
      if (orbitRef.current) {
        orbitRef.current.enabled = true;
        orbitRef.current.enableRotate = false; // Pure 2D pan/zoom in top-down mode
        orbitRef.current.target.set(center[0], 0, center[2]);
      }
      // Position high above center, looking straight down
      camera.up.set(0, 0, -1); // North is top of screen
      camera.position.set(center[0], 450, center[2]);
      camera.lookAt(center[0], 0, center[2]);
      if (orbitRef.current) {
        orbitRef.current.update();
      }
    }
  }, [cameraMode, widthIn, lengthIn, camera]);

  // First-person keyboard & pointer event handlers
  useEffect(() => {
    if (cameraMode !== 'first-person') return;

    const domElement = gl.domElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = fpState.current.keys;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = fpState.current.keys;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      fpState.current.isPointerDown = true;
      fpState.current.prevPointerX = e.clientX;
      fpState.current.prevPointerY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!fpState.current.isPointerDown) return;
      const dx = e.clientX - fpState.current.prevPointerX;
      const dy = e.clientY - fpState.current.prevPointerY;
      fpState.current.prevPointerX = e.clientX;
      fpState.current.prevPointerY = e.clientY;

      const fp = fpState.current;
      const sensitivity = 0.005;
      fp.yaw -= dx * sensitivity;
      fp.pitch -= dy * sensitivity;
      // Clamp pitch to prevent somersaults
      fp.pitch = Math.max(-1.1, Math.min(1.1, fp.pitch));
    };

    const handlePointerUp = () => {
      fpState.current.isPointerDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [cameraMode, gl]);

  // Animation frame loop for first-person walking
  useFrame((_, delta) => {
    if (cameraMode !== 'first-person') return;

    const fp = fpState.current;
    const { keys } = fp;
    const speed = 70 * delta; // 70 inches/second walkthrough speed (~4 mph)

    // Compute look forward and strafe right vectors
    const forwardX = -Math.sin(fp.yaw);
    const forwardZ = -Math.cos(fp.yaw);
    const rightX = -Math.sin(fp.yaw - Math.PI / 2);
    const rightZ = -Math.cos(fp.yaw - Math.PI / 2);

    let moveX = 0;
    let moveZ = 0;

    if (keys.forward) {
      moveX += forwardX * speed;
      moveZ += forwardZ * speed;
    }
    if (keys.backward) {
      moveX -= forwardX * speed;
      moveZ -= forwardZ * speed;
    }
    if (keys.left) {
      moveX -= rightX * speed;
      moveZ -= rightZ * speed;
    }
    if (keys.right) {
      moveX += rightX * speed;
      moveZ += rightZ * speed;
    }

    // Apply movement with boundary collision envelope (15" wall standoff)
    fp.x = Math.max(15, Math.min(widthIn - 15, fp.x + moveX));
    fp.z = Math.max(15, Math.min(lengthIn - 15, fp.z + moveZ));

    // Update camera position and look direction
    camera.position.set(fp.x, fp.y, fp.z);

    const lookTarget = new THREE.Vector3(
      fp.x - Math.sin(fp.yaw) * Math.cos(fp.pitch) * 100,
      fp.y + Math.sin(fp.pitch) * 100,
      fp.z - Math.cos(fp.yaw) * Math.cos(fp.pitch) * 100,
    );

    camera.lookAt(lookTarget);
  });

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      target={roomCenter.current}
    />
  );
}
