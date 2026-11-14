import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import { textKey } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'warning';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-accent',
  secondary: 'bg-surface-container-high border border-accent text-accent hover:bg-accent/10',
  ghost: 'bg-surface border border-outline text-on-surface hover:border-accent hover:text-accent',
  warning: 'bg-surface border border-outline text-warning hover:border-warning',
};

const SIZES: Record<Size, string> = {
  sm: 'px-sm py-xs text-label-sm',
  md: 'px-md py-sm text-title-md',
  lg: 'px-md py-sm text-headline-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-xs rounded-lg text-center font-headline uppercase leading-tight transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" className="shrink-0 animate-spin text-[18px]" />
      ) : (
        icon && <Icon name={icon} className="shrink-0 text-[18px]" />
      )}
      {/* key: si la etiqueta cambia, el traductor recibe un nodo nuevo y lo vuelve a traducir */}
      <span key={textKey(children)} className="min-w-0 break-words">
        {children}
      </span>
    </button>
  );
}
