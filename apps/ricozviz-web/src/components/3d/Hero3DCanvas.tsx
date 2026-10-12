"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function isWebGLAvailable() {
  if (typeof window === "undefined") return true;
  try {
    const testCanvas = document.createElement("canvas");
    return !!(
      testCanvas.getContext("webgl") ||
      testCanvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export function Hero3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported] = useState(isWebGLAvailable);

  useEffect(() => {
    if (!webglSupported) return;
    const container = containerRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0f172a, 0.025);

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 16);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const blueLight = new THREE.PointLight(0x4f46e5, 3, 20);
    blueLight.position.set(-6, 4, 4);
    scene.add(blueLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 2.5, 20);
    cyanLight.position.set(6, -2, 3);
    scene.add(cyanLight);

    const violetLight = new THREE.DirectionalLight(0x8b5cf6, 1.2);
    violetLight.position.set(0, 8, 5);
    scene.add(violetLight);

    // 4. Floating 3D Objects Group
    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    // Object A: 3D Layered Database Cylinder (Left)
    const dbGroup = new THREE.Group();
    const diskGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.28, 24);
    const dbMat = new THREE.MeshStandardMaterial({
      color: 0x312e81,
      metalness: 0.6,
      roughness: 0.2,
      emissive: 0x1e1b4b,
    });
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    for (let i = 0; i < 3; i++) {
      const disk = new THREE.Mesh(diskGeo, dbMat);
      disk.position.y = (i - 1) * 0.42;
      dbGroup.add(disk);

      const glowRing = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.18, 0.05, 24),
        glowRingMat
      );
      glowRing.position.y = (i - 1) * 0.42;
      dbGroup.add(glowRing);
    }
    dbGroup.position.set(-7.5, 2.2, -1);
    dbGroup.rotation.x = 0.4;
    dbGroup.rotation.z = -0.2;
    objectsGroup.add(dbGroup);

    // Object B: Translucent Glass Analytics Cube (Right)
    const glassCubeGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85,
      reflectivity: 0.9,
    });
    const cube = new THREE.Mesh(glassCubeGeo, glassMat);
    cube.position.set(7.5, 1.5, -0.5);
    cube.rotation.x = 0.5;
    cube.rotation.y = 0.6;
    objectsGroup.add(cube);

    // Inner glowing core of the cube
    const coreGeo = new THREE.OctahedronGeometry(0.65, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(cube.position);
    objectsGroup.add(coreMesh);

    // Object C: 3D Pillar Chart Blocks (Bottom Right)
    const chartPillarsGroup = new THREE.Group();
    const heights = [0.8, 1.5, 2.2, 1.7];
    heights.forEach((h, idx) => {
      const barGeo = new THREE.BoxGeometry(0.35, h, 0.35);
      const barMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0x4f46e5 : 0x10b981,
        metalness: 0.4,
        roughness: 0.3,
        emissive: idx % 2 === 0 ? 0x1e1b4b : 0x064e3b,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set((idx - 1.5) * 0.5, h / 2, 0);
      chartPillarsGroup.add(bar);
    });
    chartPillarsGroup.position.set(6.8, -3.2, 1);
    chartPillarsGroup.rotation.y = -0.5;
    chartPillarsGroup.rotation.x = 0.2;
    objectsGroup.add(chartPillarsGroup);

    // Object D: Floating 3D Geometric Ring (Top Right)
    const ringGeo = new THREE.TorusGeometry(1.2, 0.08, 12, 36);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x4c1d95,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(-6.5, -2.8, 1);
    ringMesh.rotation.x = 1.1;
    objectsGroup.add(ringMesh);

    // 5. Flowing Connected Data Spline Path
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.5, 2.2, -1),
      new THREE.Vector3(-4, 3.5, 2),
      new THREE.Vector3(0, 1.5, 3),
      new THREE.Vector3(4, 3.2, 1),
      new THREE.Vector3(7.5, 1.5, -0.5),
    ]);

    const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.035, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.4,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // 6. Glowing Particle Cloud along Data Paths
    const particleCount = 60;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const pt = curve.getPoint(t);
      particlePositions[i * 3] = pt.x + (Math.random() - 0.5) * 0.4;
      particlePositions[i * 3 + 1] = pt.y + (Math.random() - 0.5) * 0.4;
      particlePositions[i * 3 + 2] = pt.z + (Math.random() - 0.5) * 0.4;
      particleSpeeds[i] = 0.002 + Math.random() * 0.003;
    }
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. Mouse Parallax Tracker
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    function handleMouseMove(e: MouseEvent) {
      const rect = container?.getBoundingClientRect();
      if (!rect) return;
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    if (!prefersReducedMotion) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
    }

    // 8. Animation Loop with Visibility Caching
    let animId = 0;
    const clock = new THREE.Clock();
    let isVisible = true;

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    function animate() {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Smooth camera parallax
        targetX = mouseX * 0.8;
        targetY = mouseY * 0.5;
        camera.position.x += (targetX - camera.position.x) * 0.03;
        camera.position.y += (targetY + 2 - camera.position.y) * 0.03;
        camera.lookAt(0, 0.5, 0);

        // Subtle object floating
        dbGroup.position.y = 2.2 + Math.sin(elapsed * 1.2) * 0.15;
        dbGroup.rotation.y = elapsed * 0.25;

        cube.position.y = 1.5 + Math.cos(elapsed * 1.1) * 0.18;
        cube.rotation.x = elapsed * 0.35;
        cube.rotation.y = elapsed * 0.45;
        coreMesh.position.copy(cube.position);
        coreMesh.rotation.x = -elapsed * 0.5;
        coreMesh.rotation.y = -elapsed * 0.6;

        ringMesh.rotation.z = elapsed * 0.3;
        ringMesh.position.y = -2.8 + Math.sin(elapsed * 1.4) * 0.12;

        chartPillarsGroup.position.y = -3.2 + Math.cos(elapsed * 1.3) * 0.1;
      }

      // Move particles along spline
      const posAttr = particleGeo.attributes["position"] as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const t = (elapsed * particleSpeeds[i] * 1.5 + i / particleCount) % 1;
        const pt = curve.getPoint(t);
        array[i * 3] = pt.x + Math.sin(elapsed * 2 + i) * 0.1;
        array[i * 3 + 1] = pt.y + Math.cos(elapsed * 2 + i) * 0.1;
        array[i * 3 + 2] = pt.z;
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    }

    animate();

    // 9. Resize Handling
    function handleResize() {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    }
    window.addEventListener("resize", handleResize, { passive: true });

    // 10. Memory Clean-Up
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Three.js resources
      diskGeo.dispose();
      dbMat.dispose();
      glowRingMat.dispose();
      glassCubeGeo.dispose();
      glassMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [webglSupported]);

  if (!webglSupported) {
    // Graceful fallback for non-WebGL devices
    return (
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <div className="h-96 w-96 rounded-full bg-gradient-to-tr from-indigo-500/20 via-purple-500/10 to-cyan-500/20 blur-3xl" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
