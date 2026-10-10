import Image from "next/image";

export interface BrandLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

export function BrandLogo({
  size = 32,
  className = "",
  priority = false,
  alt = "RicozViz Logo",
}: BrandLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={`rounded-lg object-contain shrink-0 shadow-2xs select-none transition-transform duration-200 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
