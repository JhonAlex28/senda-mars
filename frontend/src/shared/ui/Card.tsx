import type { ReactNode } from 'react';

type CardTone = 'default' | 'success' | 'warning' | 'error' | 'accent';

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}

const TONES: Record<CardTone, string> = {
  default: 'border border-outline',
  success: 'border-2 border-success/60',
  warning: 'border-2 border-warning/60',
  error: 'border-2 border-error/60',
  accent: 'border-2 border-accent/60',
};

export function Card({ title, action, tone = 'default', className = '', children }: CardProps) {
  return (
    <section className={`flex flex-col gap-sm rounded-lg bg-surface-container p-md ${TONES[tone]} ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-sm">
          {title && <h2 className="font-headline text-title-md text-on-surface">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
