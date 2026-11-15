export function formatMinutes(min: number): string {
  const total = Math.max(0, Math.round(min));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

/** Diferencia con signo, p. ej. "+3 min" o "−2%". */
export function formatDelta(value: number, unit: string): string {
  const rounded = Math.round(value);
  if (rounded === 0) return `±0${unit}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}${unit}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
