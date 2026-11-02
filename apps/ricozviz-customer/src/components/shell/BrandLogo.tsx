import React from "react";
import Image from "next/image";
import { BrandLogo as RepoBrandLogo } from "@repo/components";

export interface BrandLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
  useSvg?: boolean;
}

export function BrandLogo({
  size = 32,
  className = "",
  priority = false,
  alt = "RicozViz Logo",
  useSvg = false,
}: BrandLogoProps) {
  if (useSvg) {
    return <RepoBrandLogo size={size} className={className} alt={alt} />;
  }

  return (
    <Image
      src="/icon.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={`rounded-lg object-contain shrink-0 shadow-2xs select-none transition-transform duration-200 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

export { RepoBrandLogo };
