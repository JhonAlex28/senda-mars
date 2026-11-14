import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { useMission } from '../state/MissionContext';
import type { MapTool } from '../state/types';

const TOOLS: { tool: MapTool; icon: string; title: string; text: string; tint: string; hover: string }[] = [
  { tool: 'select', icon: 'touch_app', title: 'Pick goals', text: 'Tap a rock to learn about it.', tint: 'bg-primary/20 text-primary', hover: 'hover:border-accent' },
  { tool: 'base', icon: 'home_pin', title: 'Move base', text: 'Tap where our base is.', tint: 'bg-accent/20 text-accent', hover: 'hover:border-accent' },
  { tool: 'hazard', icon: 'warning', title: 'Mark danger', text: 'Tap to block a place. Tap it again to free it.', tint: 'bg-error/20 text-error', hover: 'hover:border-error' },
];

/** Herramientas del mapa: qué hace un toque sobre el terreno. */
export function MapToolsCard() {
  const { state, dispatch } = useMission();

  return (
    <Card title="Map tools" className="flex-1">
      {TOOLS.map(({ tool, icon, title, text, tint, hover }) => {
        const active = state.tool === tool;
        return (
          <button
            key={tool}
            type="button"
            aria-pressed={active}
            onClick={() => dispatch({ type: 'setTool', tool })}
            className={`flex w-full items-center gap-sm rounded-lg bg-surface p-sm text-left transition-colors ${
              active ? 'border-2 border-accent' : `border border-outline ${hover}`
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>
              <Icon name={icon} className="text-[24px]" />
            </div>
            <div>
              <span className="block font-headline text-title-md text-on-surface">{title}</span>
              <span className="font-body text-body-sm text-on-surface-variant">{text}</span>
            </div>
          </button>
        );
      })}

      {state.hazards.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-error/40 bg-error/10 px-sm py-xs font-body text-body-sm">
          <span className="text-on-surface">
            Danger zones: <Live>{state.hazards.length}</Live>
          </span>
          <button type="button" onClick={() => dispatch({ type: 'clearHazards' })} className="font-label text-label-sm uppercase text-error hover:underline">
            Clear all
          </button>
        </div>
      )}

      <div className="mt-auto flex items-center gap-sm rounded-lg border border-outline-variant bg-surface p-sm">
        <Icon name="visibility" className="shrink-0 text-[22px] text-accent" />
        <span className="font-body text-body-sm text-on-surface-variant">
          Rocks smaller than 2 meters are not on the map. Look around with your own eyes.
        </span>
      </div>
    </Card>
  );
}
