import type { CSSProperties } from 'react';
import appIcon from '@/assets/brand/hirgal-app-icon-512.png';
import fullLogo from '@/assets/brand/hirgal-logo-full.png';
import wordmark from '@/assets/brand/hirgal-logo-wordmark.png';

export type BrandLogoVariant = 'full' | 'icon' | 'compact' | 'wordmark';

interface BrandLogoProps {
  alt?: string;
  className?: string;
  height?: CSSProperties['height'];
  variant?: BrandLogoVariant;
  width?: CSSProperties['width'];
}

const logoSources: Record<BrandLogoVariant, string> = {
  full: fullLogo,
  icon: appIcon,
  compact: appIcon,
  wordmark,
};

const logoDescriptions: Record<BrandLogoVariant, string> = {
  full: 'HIRGAL — Work & Project Management',
  icon: 'HIRGAL app icon',
  compact: 'HIRGAL app icon',
  wordmark: 'HIRGAL — Work & Project Management',
};

export function BrandLogo({
  alt,
  className,
  height,
  variant = 'full',
  width,
}: BrandLogoProps) {
  return (
    <img
      alt={alt ?? logoDescriptions[variant]}
      className={className}
      src={logoSources[variant]}
      style={{ height, objectFit: 'contain', width }}
    />
  );
}
