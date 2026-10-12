"use client";

interface HaikeiBackgroundProps {
  variant?: "dots" | "grid" | "waves" | "blobs";
  className?: string;
}

export function HaikeiBackground({
  variant = "dots",
  className = "",
}: HaikeiBackgroundProps) {
  if (variant === "waves") {
    return (
      <div
        className={`absolute inset-0 -z-10 overflow-hidden pointer-events-none select-none opacity-25 dark:opacity-10 ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full h-full object-cover"
        >
          <path
            d="M0,320 C320,400 420,240 720,280 C1020,320 1120,420 1440,360 L1440,600 L0,600 Z"
            fill="#6366f1"
            fillOpacity="0.25"
          />
          <path
            d="M0,380 C360,280 500,440 840,360 C1180,280 1280,380 1440,340 L1440,600 L0,600 Z"
            fill="#8b5cf6"
            fillOpacity="0.45"
          />
          <path
            d="M0,450 C380,380 540,490 900,420 C1260,350 1340,440 1440,410 L1440,600 L0,600 Z"
            fill="#6366f1"
            fillOpacity="0.75"
          />
        </svg>
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div
        className={`absolute inset-0 -z-10 haikei-grid pointer-events-none select-none ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Default: subtle dot matrix texture
  return (
    <div
      className={`absolute inset-0 -z-10 haikei-dots pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
}
