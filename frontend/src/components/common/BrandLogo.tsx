import appIcon from '@/assets/brand/hirgal-app-icon.png';
import sidebarLogo from '@/assets/brand/hirgal-sidebar-logo.png';

interface BrandLogoProps {
  className?: string;
  variant?: 'icon' | 'wordmark';
}

export function BrandLogo({ className, variant = 'wordmark' }: BrandLogoProps) {
  return (
    <img
      alt={variant === 'wordmark' ? 'Hirgal' : ''}
      className={className}
      src={variant === 'icon' ? appIcon : sidebarLogo}
    />
  );
}
