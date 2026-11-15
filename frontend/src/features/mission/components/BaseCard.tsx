import { formatLat, formatLon } from '@/shared/lib/geo';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';

/** Base de la misión (fija, ya establecida en la LZ de Gale): nombre y coordenadas. */
export function BaseCard() {
  const { state, targets } = useMission();
  if (!state.base) return null;
  const name = targets.find((t) => t.is_base)?.name ?? 'Base';

  return (
    <div className="flex items-center gap-sm rounded-lg border border-outline bg-surface-container px-sm py-xs">
      <Icon name="home_pin" filled className="text-[22px] text-primary" />
      <div className="min-w-0">
        <p className="truncate font-headline text-title-md">{name}</p>
        <p translate="no" className="font-mono text-mono-sm text-on-surface-variant">
          {formatLat(state.base.lat)} · {formatLon(state.base.lon)}
        </p>
      </div>
    </div>
  );
}
