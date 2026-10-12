"use client";

import React, { useEffect, useRef } from "react";

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorType: "indigo" | "emerald" | "cyan" | "slate";
}

/**
 * HeroBackgroundCanvas
 *
 * Replaces heavy distorted 3D geometric wireframes clipping behind the hero dashboard
 * with an ambient radial gradient mesh and a high-performance interactive dot-matrix grid.
 *
 * Features:
 * - Fluid interactive dot-matrix with mouse proximity illumination and soft spring physics.
 * - Ambient harmonic wave pulsation even when idle.
 * - Layered ambient radial gradient flares (neon-indigo, cyan, emerald) providing rich depth.
 * - 0% CPU/GPU overhead when scrolled out of view (via IntersectionObserver).
 * - Full respect for prefers-reduced-motion and high-DPI (Retina) screens.
 */
export function Hero3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let dots: Dot[] = [];
    const DOT_SPACING = 30;
    const BASE_RADIUS = 1.25;
    const HOVER_RADIUS = 150;

    let mouseX = -9999;
    let mouseY = -9999;
    let isMouseActive = false;

    function initDots() {
      if (!canvas || !container || !ctx) return;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const cols = Math.ceil(width / DOT_SPACING) + 1;
      const rows = Math.ceil(height / DOT_SPACING) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = c * DOT_SPACING;
          const by = r * DOT_SPACING;

          let colorType: Dot["colorType"] = "slate";
          const seed = (c * 17 + r * 23) % 100;
          if (seed < 14) colorType = "indigo";
          else if (seed < 20) colorType = "emerald";
          else if (seed < 25) colorType = "cyan";

          dots.push({
            baseX: bx,
            baseY: by,
            x: bx,
            y: by,
            vx: 0,
            vy: 0,
            radius: BASE_RADIUS,
            colorType,
          });
        }
      }
    }

    initDots();

    function onMouseMove(e: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseActive = true;
    }

    function onMouseLeave() {
      mouseX = -9999;
      mouseY = -9999;
      isMouseActive = false;
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave, { passive: true });

    let animId = 0;
    const startTime = performance.now();
    let isVisible = true;

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    function render(now: number) {
      animId = requestAnimationFrame(render);
      if (!isVisible || !ctx) return;

      const elapsed = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, width, height);

      const len = dots.length;
      for (let i = 0; i < len; i++) {
        const dot = dots[i];

        // Ambient undulating wave
        let waveOffset = 0;
        let ambientPulse = 0;
        if (!prefersReducedMotion) {
          waveOffset =
            Math.sin(elapsed * 1.4 + (dot.baseX + dot.baseY) * 0.006) * 1.5;
          ambientPulse = Math.cos(elapsed * 1.8 + dot.baseX * 0.008) * 0.08;
        }

        const targetY = dot.baseY + waveOffset;
        const targetX = dot.baseX;

        // Proximity calculation to mouse
        const dx = mouseX - dot.x;
        const dy = mouseY - dot.y;
        const distSq = dx * dx + dy * dy;
        const hoverRadiusSq = HOVER_RADIUS * HOVER_RADIUS;

        let hoverFactor = 0;
        if (isMouseActive && distSq < hoverRadiusSq) {
          const dist = Math.sqrt(distSq);
          hoverFactor = Math.max(0, 1 - dist / HOVER_RADIUS);
          hoverFactor = hoverFactor * hoverFactor; // smooth ease

          if (!prefersReducedMotion && dist > 1) {
            const pushX = (dx / dist) * hoverFactor * -14;
            const pushY = (dy / dist) * hoverFactor * -14;
            dot.vx += (targetX + pushX - dot.x) * 0.15;
            dot.vy += (targetY + pushY - dot.y) * 0.15;
          }
        } else if (!prefersReducedMotion) {
          dot.vx += (targetX - dot.x) * 0.1;
          dot.vy += (targetY - dot.y) * 0.1;
        }

        if (!prefersReducedMotion) {
          dot.vx *= 0.82;
          dot.vy *= 0.82;
          dot.x += dot.vx;
          dot.y += dot.vy;
        } else {
          dot.x = targetX;
          dot.y = targetY;
        }

        // Draw dot
        const currentRadius = BASE_RADIUS + hoverFactor * 2.2;
        let fillStyle = "rgba(148, 163, 184, 0.14)";

        if (hoverFactor > 0.05) {
          const alpha = Math.min(1, 0.35 + hoverFactor * 0.65);
          if (dot.colorType === "emerald") {
            fillStyle = `rgba(52, 211, 153, ${alpha})`;
          } else if (dot.colorType === "cyan") {
            fillStyle = `rgba(6, 182, 212, ${alpha})`;
          } else {
            fillStyle = `rgba(129, 140, 248, ${alpha})`;
          }
        } else {
          const baseAlpha = Math.max(0.08, 0.15 + ambientPulse);
          if (dot.colorType === "indigo") {
            fillStyle = `rgba(99, 102, 241, ${baseAlpha * 1.6})`;
          } else if (dot.colorType === "emerald") {
            fillStyle = `rgba(16, 185, 129, ${baseAlpha * 1.4})`;
          } else if (dot.colorType === "cyan") {
            fillStyle = `rgba(6, 182, 212, ${baseAlpha * 1.4})`;
          } else {
            fillStyle = `rgba(148, 163, 184, ${baseAlpha})`;
          }
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();

        // Extra glow halo around strongly hovered dots
        if (hoverFactor > 0.45) {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, currentRadius * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${hoverFactor * 0.22})`;
          ctx.fill();
        }
      }
    }

    if (!prefersReducedMotion) {
      animId = requestAnimationFrame(render);
    } else {
      render(0);
    }

    function onResize() {
      initDots();
      if (prefersReducedMotion) render(0);
    }

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Ambient Radial Gradient Mesh Backlight */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Top-center indigo-violet ambient flare */}
        <div className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[760px] h-[500px] rounded-full bg-gradient-to-b from-indigo-500/22 via-purple-600/12 to-transparent blur-[110px] opacity-85" />

        {/* Left emerald accent flare */}
        <div className="absolute top-[26%] left-[8%] w-[440px] h-[400px] rounded-full bg-gradient-to-tr from-emerald-500/16 via-teal-500/10 to-transparent blur-[95px] opacity-75" />

        {/* Right cyan-indigo accent flare */}
        <div className="absolute top-[30%] right-[10%] w-[480px] h-[420px] rounded-full bg-gradient-to-tl from-indigo-500/20 via-cyan-500/14 to-transparent blur-[100px] opacity-80" />
      </div>

      {/* Interactive Dot-Matrix Grid Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}

// Re-export aliases for clean naming
export { Hero3DCanvas as DotMatrixGridCanvas };
export { Hero3DCanvas as HeroBackgroundCanvas };
