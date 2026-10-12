import * as React from 'react';

interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface TouchRippleProps {
  color?: string;
  className?: string;
}

export function TouchRipple({ color = 'rgba(255, 255, 255, 0.35)', className = '' }: TouchRippleProps) {
  const [ripples, setRipples] = React.useState<RippleItem[]>([]);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const newRipple: RippleItem = {
      id: Date.now() + Math.random(),
      x,
      y,
      size
    };

    setRipples((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  return (
    <span
      onPointerDown={onPointerDown}
      className={`absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-auto cursor-pointer ${className}`}
      aria-hidden="true"
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-mui-ripple"
          style={{
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
            width: `${ripple.size}px`,
            height: `${ripple.size}px`,
            backgroundColor: color
          }}
        />
      ))}
    </span>
  );
}
