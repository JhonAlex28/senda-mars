import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useMission } from '../state/MissionContext';
import type { MapTool } from '../state/types';

/** Las bases son fijas: no hay herramienta para moverlas. */
const TOOLS: { tool: MapTool; icon: string; title: string; active: string; planOnly?: boolean }[] = [
  { tool: 'select', icon: 'touch_app', title: 'Select', active: 'bg-primary text-on-primary' },
  { tool: 'hazard', icon: 'warning', title: 'Danger zone', active: 'bg-error text-on-error' },
  { tool: 'waypoint', icon: 'add_location_alt', title: 'Add point', active: 'bg-success text-on-success', planOnly: true },
];

/** Barra flotante del mapa: iconos grandes (tableta) y una etiqueta corta. */
export function MapToolbar() {
  const { state, dispatch } = useMission();
  const hazards = state.hazards.length;
  const walking = state.phase === 'walk';

  return (
    <div
      role="toolbar"
      aria-label="Map tools"
      aria-orientation="vertical"
      className="absolute left-md top-1/2 z-20 flex -translate-y-1/2 flex-col gap-xs rounded-lg border border-outline bg-surface-container/95 p-xs shadow-xl backdrop-blur"
    >
      {TOOLS.filter((t) => !(t.planOnly && walking)).map(({ tool, icon, title, active }) => {
        const on = state.tool === tool;
        const count = tool === 'hazard' ? hazards : tool === 'waypoint' ? state.waypoints.length : 0;
        return (
          <Tooltip key={tool} title={title}>
            <button
              type="button"
              aria-label={title}
              aria-pressed={on}
              onClick={() => dispatch({ type: 'setTool', tool })}
              className={`relative flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-fast ${
                on ? active : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <Icon name={icon} className="text-[22px]" />
              {count > 0 && (
                <Live
                  className={`absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-[3px] font-mono text-[10px] leading-none ${
                    tool === 'hazard' ? 'bg-error text-on-error' : 'bg-success text-on-success'
                  }`}
                >
                  {count}
                </Live>
              )}
            </button>
          </Tooltip>
        );
      })}

      {hazards > 0 && (
        <Tooltip title="Clear zones">
          <button
            type="button"
            aria-label="Clear danger zones"
            onClick={() => dispatch({ type: 'clearHazards' })}
            className="flex h-11 w-11 items-center justify-center rounded-md text-error transition-colors duration-fast hover:bg-error/15"
          >
            <Icon name="delete_sweep" className="text-[22px]" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
