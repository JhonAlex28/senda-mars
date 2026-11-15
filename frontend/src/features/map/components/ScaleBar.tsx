import { formatDistance } from '@/shared/lib/format';
import { Live } from '@/shared/ui/Text';

const NICE_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
const TARGET_PX = 90;

/** Barra de escala que se ajusta al zoom con distancias "redondas". */
export function ScaleBar({ unit }: { unit: number }) {
  const meters = NICE_STEPS.find((m) => m / unit >= TARGET_PX) ?? NICE_STEPS[NICE_STEPS.length - 1];
  return (
    <div className="pointer-events-none absolute bottom-md left-md z-20 flex items-center gap-sm rounded-md border border-outline bg-surface-container/90 px-sm py-xs font-mono text-mono-sm text-on-surface-variant">
      <div className="h-1.5 border-x border-b border-on-surface-variant" style={{ width: meters / unit }} />
      <Live>{formatDistance(meters)}</Live>
    </div>
  );
}
