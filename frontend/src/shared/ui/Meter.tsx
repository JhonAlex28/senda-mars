import { clamp } from '@/shared/lib/format';

export type Tone = 'success' | 'warning' | 'error' | 'accent' | 'primary';

const BAR: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  accent: 'bg-accent',
  primary: 'bg-primary',
};

export const TEXT_TONE: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  accent: 'text-accent',
  primary: 'text-primary',
};

interface MeterProps {
  value: number; // 0..100
  tone: Tone;
  label: string;
  className?: string;
}

export function Meter({ value, tone, label, className = 'h-1.5' }: MeterProps) {
  const pct = clamp(value, 0, 100);
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-surface-container-high ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-standard ${BAR[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Verde con margen amplio, ámbar por debajo de 50 %, rojo por debajo de 20 %. */
export function toneForRemaining(pct: number): Tone {
  if (pct < 20) return 'error';
  return pct < 50 ? 'warning' : 'success';
}
