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
  colorType: "teal" | "gold" | "slate" | "stone";
}

/**
 * HeroBackgroundCanvas
 *
 * Restrained, high-performance dot-matrix grid with subtle mouse interaction
 * aligned with the Editorial Enterprise aesthetic.
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
    const BASE_RADIUS = 1.1;
    const HOVER_RADIUS = 140;

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

          let colorType: Dot["colorType"] = "stone";
          const seed = (c * 17 + r * 23) % 100;
          if (seed < 12) colorType = "teal";
          else if (seed < 16) colorType = "gold";
          else if (seed < 30) colorType = "slate";

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
            Math.sin(elapsed * 1.2 + (dot.baseX + dot.baseY) * 0.005) * 1.2;
          ambientPulse = Math.cos(elapsed * 1.5 + dot.baseX * 0.007) * 0.06;
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
            const pushX = (dx / dist) * hoverFactor * -10;
            const pushY = (dy / dist) * hoverFactor * -10;
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
        const currentRadius = BASE_RADIUS + hoverFactor * 1.8;
        const isDark = document.documentElement.classList.contains("dark");
        let fillStyle = isDark ? "rgba(156, 163, 175, 0.12)" : "rgba(89, 103, 117, 0.15)";

        const tealRgb = isDark ? "79, 157, 142" : "20, 125, 120";

        if (hoverFactor > 0.05) {
          const alpha = Math.min(0.9, 0.3 + hoverFactor * 0.6);
          if (dot.colorType === "gold") {
            fillStyle = `rgba(217, 164, 65, ${alpha})`;
          } else {
            fillStyle = `rgba(${tealRgb}, ${alpha})`;
          }
        } else {
          const baseAlpha = Math.max(0.06, 0.12 + ambientPulse);
          if (dot.colorType === "teal") {
            fillStyle = `rgba(${tealRgb}, ${baseAlpha * 1.5})`;
          } else if (dot.colorType === "gold") {
            fillStyle = `rgba(217, 164, 65, ${baseAlpha * 1.4})`;
          } else if (dot.colorType === "slate") {
            fillStyle = isDark
              ? `rgba(156, 163, 175, ${baseAlpha * 1.2})`
              : `rgba(89, 103, 117, ${baseAlpha * 1.2})`;
          } else {
            fillStyle = isDark
              ? `rgba(55, 65, 81, ${baseAlpha * 1.8})`
              : `rgba(218, 223, 217, ${baseAlpha * 1.8})`;
          }
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();

        // Subtle highlight ring on strongly hovered dots
        if (hoverFactor > 0.5) {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, currentRadius * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${tealRgb}, ${hoverFactor * 0.12})`;
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
