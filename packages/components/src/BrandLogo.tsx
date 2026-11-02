import React from 'react';

export interface BrandLogoProps {
  size?: number;
  className?: string;
  alt?: string;
  showText?: boolean;
}

export function BrandLogo({
  size = 32,
  className = '',
  alt = 'RicozViz Logo',
  showText = false,
}: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} aria-label={alt}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200"
      >
        <rect width="32" height="32" rx="8" fill="#181818" stroke="#262626" strokeWidth="1" />
        <path
          d="M8 22L14 10L18 17L21 12L24 22H8Z"
          fill="url(#rv-coral-gradient)"
          stroke="#ff6b35"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="10" r="1.75" fill="#fafafa" />
        <circle cx="21" cy="12" r="1.75" fill="#fafafa" />
        <defs>
          <linearGradient id="rv-coral-gradient" x1="8" y1="10" x2="24" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff6b35" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ff6b35" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className="text-sm font-semibold tracking-tight text-[#fafafa] font-mono-code">
          ricoz<span className="text-[#ff6b35]">viz</span>
        </span>
      )}
    </div>
  );
}
