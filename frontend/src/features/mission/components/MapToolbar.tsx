import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useMission } from '../state/MissionContext';
import type { MapTool } from '../state/types';

const TOOLS: { tool: MapTool; icon: string; title: string; text: string; active: string }[] = [
  { tool: 'select', icon: 'touch_app', title: 'Select', text: 'Tap a rock to see it.', active: 'bg-primary text-on-primary' },
  { tool: 'base', icon: 'home_pin', title: 'Move base', text: 'Tap the map to place it.', active: 'bg-accent text-on-primary' },
  { tool: 'hazard', icon: 'warning', title: 'Mark danger zone', text: 'Tap to add. Tap again to remove.', active: 'bg-error text-on-error' },
];

/** Barra flotante de herramientas del mapa: solo iconos, la descripción aparece al pasar el cursor. */
export function MapToolbar() {
  const { state, dispatch } = useMission();
  const hazards = state.hazards.length;

  return (
    <div
      role="toolbar"
      aria-label="Map tools"
      aria-orientation="vertical"
      className="absolute left-md top-1/2 z-20 flex -translate-y-1/2 flex-col gap-xs rounded-lg border border-outline bg-surface-container/95 p-xs shadow-xl backdrop-blur"
    >
      {TOOLS.map(({ tool, icon, title, text, active }) => {
        const on = state.tool === tool;
        return (
          <Tooltip key={tool} title={title} text={text}>
            <button
              type="button"
              aria-label={title}
              aria-pressed={on}
              onClick={() => dispatch({ type: 'setTool', tool })}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-fast ${
                on ? active : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <Icon name={icon} className="text-[20px]" />
              {tool === 'hazard' && hazards > 0 && (
                <Live className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-[3px] font-mono text-[10px] leading-none text-on-error">
                  {hazards}
                </Live>
              )}
            </button>
          </Tooltip>
        );
      })}

      {hazards > 0 && (
        <Tooltip title="Clear danger zones" text="Remove every danger zone from the map.">
          <button
            type="button"
            aria-label="Clear danger zones"
            onClick={() => dispatch({ type: 'clearHazards' })}
            className="flex h-9 w-9 items-center justify-center rounded-md text-error transition-colors duration-fast hover:bg-error/15"
          >
            <Icon name="delete_sweep" className="text-[20px]" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
