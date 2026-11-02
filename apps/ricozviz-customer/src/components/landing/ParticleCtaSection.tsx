"use client";

import React, { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  shapeType: "circle" | "diamond" | "triangle" | "cross";
  color: string;
}

export default function ParticleCtaSection() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = container.clientWidth);
    let height = (canvas.height = container.clientHeight);

    const handleResize = () => {
      if (!container || !canvas) return;
      width = canvas.width = container.clientWidth;
      height = canvas.height = container.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    // Initialize 60 running dots that make random tiny shapes
    const PARTICLE_COUNT = 55;
    const particles: Particle[] = [];
    const shapeChoices: ("circle" | "diamond" | "triangle" | "cross")[] = [
      "circle",
      "circle",
      "diamond",
      "triangle",
      "cross",
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isCoral = Math.random() < 0.28;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.5 + 1.2,
        baseAlpha: Math.random() * 0.35 + 0.2,
        shapeType: shapeChoices[Math.floor(Math.random() * shapeChoices.length)],
        color: isCoral ? "#ff6b35" : "#b4b4b4",
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Update positions
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Bounce gently off boundaries
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
        } else if (p.x > width) {
          p.x = width;
          p.vx *= -1;
        }

        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
        } else if (p.y > height) {
          p.y = height;
          p.vy *= -1;
        }

        // Slight mouse proximity repulsion/influence
        if (mouseRef.current.active) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0) {
            const force = (120 - dist) / 120;
            p.x += (dx / dist) * force * 1.2;
            p.y += (dy / dist) * force * 1.2;
          }
        }
      }

      // Check proximity and draw random tiny shapes between triplets
      const TRI_DIST = 85;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx12 = p1.x - p2.x;
          const dy12 = p1.y - p2.y;
          const dist12 = Math.sqrt(dx12 * dx12 + dy12 * dy12);

          if (dist12 < TRI_DIST) {
            // Draw connecting hairline
            const lineAlpha = (1 - dist12 / TRI_DIST) * 0.22;
            ctx.strokeStyle = `rgba(255, 107, 53, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Look for a 3rd particle to form a tiny triangle shape
            for (let k = j + 1; k < particles.length; k++) {
              const p3 = particles[k];
              const dx23 = p2.x - p3.x;
              const dy23 = p2.y - p3.y;
              const dist23 = Math.sqrt(dx23 * dx23 + dy23 * dy23);

              if (dist23 < TRI_DIST) {
                const dx13 = p1.x - p3.x;
                const dy13 = p1.y - p3.y;
                const dist13 = Math.sqrt(dx13 * dx13 + dy13 * dy13);

                if (dist13 < TRI_DIST) {
                  // Form random tiny translucent polygon/triangle
                  const avgDist = (dist12 + dist23 + dist13) / 3;
                  const shapeAlpha = (1 - avgDist / TRI_DIST) * 0.08;
                  ctx.fillStyle = `rgba(255, 107, 53, ${shapeAlpha})`;
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.lineTo(p3.x, p3.y);
                  ctx.closePath();
                  ctx.fill();
                  ctx.strokeStyle = `rgba(255, 107, 53, ${shapeAlpha * 1.8})`;
                  ctx.stroke();
                }
              }
            }
          }
        }
      }

      // Draw each dot / tiny particle shape
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let alpha = p.baseAlpha;

        if (mouseRef.current.active) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            alpha = Math.min(0.9, alpha + (1 - dist / 160) * 0.55);
          }
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;

        if (p.shapeType === "circle") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shapeType === "diamond") {
          // Tiny diamond shape
          const s = p.radius * 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x + s, p.y);
          ctx.lineTo(p.x, p.y + s);
          ctx.lineTo(p.x - s, p.y);
          ctx.closePath();
          ctx.stroke();
        } else if (p.shapeType === "triangle") {
          // Tiny equilateral triangle
          const s = p.radius * 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x + s, p.y + s * 0.8);
          ctx.lineTo(p.x - s, p.y + s * 0.8);
          ctx.closePath();
          ctx.stroke();
        } else if (p.shapeType === "cross") {
          // Tiny crosshair shape
          const s = p.radius * 1.3;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <section
      id="particle-cta"
      ref={containerRef}
      className="relative w-full overflow-hidden border-t border-[#2e2e2e] bg-[#121212] py-[84px] md:py-[104px]"
    >
      {/* Background Interactive Moving Dots & Shapes Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

      {/* Subtle Radial Vignette Fade */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, #121212 95%)",
        }}
      />

      {/* Foreground Content */}
      <div className="relative z-10 mx-auto max-w-[1200px] px-[24px]">
        <div className="flex flex-col items-center text-center">
          {/* Top Pill Terminal Badge */}
          <div className="mb-[20px] max-w-full inline-flex items-center gap-[6px] sm:gap-[8px] rounded-full border border-[#2e2e2e] bg-[#171717]/90 px-[10px] sm:px-[14px] py-[5px] backdrop-blur-xs min-w-0">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff6b35] shrink-0" />
            <span className="font-mono-code text-[9.5px] sm:text-[11px] text-[#898989] truncate">
              ENTERPRISE_ANALYTICS // MULTI_SOURCE_AI
            </span>
          </div>

          {/* Main Headline */}
          <h2 className="max-w-[760px] text-[36px] font-normal leading-[1.14] tracking-[-0.02em] text-[#fafafa] sm:text-[46px] md:text-[50px]">
            <span>Build fast. Query in milliseconds.</span>{" "}
            <span className="block text-[#ff6b35]">Govern across every workspace.</span>
          </h2>

          {/* Subtitle */}
          <p className="mt-[16px] max-w-[580px] text-[15px] font-normal leading-[1.55] text-[#898989] sm:text-[16px]">
            Connect PostgreSQL, MySQL, Snowflake, BigQuery, REST APIs, and spreadsheets.
            Synthesize charts with Natural Language AI and embed expiring canvases securely.
          </p>

          {/* Action CTAs */}
          <div className="mt-[32px] flex flex-wrap items-center justify-center gap-[12px]">
            <a
              href="/register"
              className="inline-flex h-[42px] items-center justify-center rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[24px] text-[14px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c] shrink-0 whitespace-nowrap"
            >
              Start free in 60s
            </a>
            <a
              href="/login"
              className="inline-flex h-[42px] items-center justify-center rounded-full border border-[#393939] bg-[#1c1c1c] px-[22px] text-[14px] font-normal text-[#fafafa] transition-colors hover:border-[#4d4d4d] hover:bg-[#242424] cursor-pointer shrink-0 whitespace-nowrap"
            >
              Sign In to Workspace
            </a>
            <a
              href="/dashboards"
              className="inline-flex h-[42px] items-center gap-[8px] rounded-full border border-[#2e2e2e] bg-[#161616] px-[20px] text-[13px] text-[#b4b4b4] transition-colors hover:border-[#393939] hover:text-[#fafafa] cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Explore Demo Dashboards</span>
              <span className="text-[#ff6b35]">→</span>
            </a>
          </div>

          {/* 3 Hairline Proof Metrics */}
          <div className="mt-[48px] grid w-full max-w-[680px] grid-cols-1 gap-[12px] border-t border-[#2e2e2e]/60 pt-[24px] sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <span className="font-mono-code text-[14px] font-medium text-[#fafafa]">
                &lt; 12ms
              </span>
              <span className="text-[12px] text-[#898989]">
                SQL Query Pushdown
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-mono-code text-[14px] font-medium text-[#fafafa]">
                9 Connectors
              </span>
              <span className="text-[12px] text-[#898989]">
                Zero-ETL Pipelines
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-mono-code text-[14px] font-medium text-[#fafafa]">
                HMAC SHA-256
              </span>
              <span className="text-[12px] text-[#898989]">
                Signed Expiring Embeds
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
