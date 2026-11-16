
import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Switch } from '@/shared/ui/Switch';
import { Live } from '@/shared/ui/Text';
import { Tooltip } from '@/shared/ui/Tooltip';
import { LAYERS, type LayerDef, type Provenance } from '../catalog';
import { useLayers } from '../state/LayersContext';

const PROVENANCE: Record<Provenance, { label: string; dot: string }> = {
  measured: { label: 'Measured', dot: 'bg-success' },
  modeled: { label: 'Modeled', dot: 'bg-route-fast' },
  assumed: { label: 'Assumed', dot: 'bg-on-surface-variant' },
};

/**
 * Panel de capas: encender/apagar, opacidad y procedencia (tooltip). Las subcapas (p. ej. tipos de
 * objetivo y nombres) van plegadas dentro de su capa padre y solo se abren si se necesitan.
 */
export function LayersPanel() {
  const top = LAYERS.filter((l) => !l.parent);
  const ready = top.filter((l) => l.available);
  const soon = top.filter((l) => !l.available);

  return (
    <Card title="Layers" action={<Icon name="layers" className="text-[18px] text-accent" />} className="gap-xs">
      {ready.map((layer) => (
        <LayerRow key={layer.id} layer={layer} />
      ))}
      <p className="mt-sm font-label text-label-sm uppercase text-on-surface-variant">Coming soon</p>
      {soon.map((layer) => (
        <LayerRow key={layer.id} layer={layer} />
      ))}
    </Card>
  );
}

function LayerRow({ layer, sub = false, parentOn = true }: { layer: LayerDef; sub?: boolean; parentOn?: boolean }) {
  const { layers, toggle, setOpacity } = useLayers();
  const view = layers[layer.id];
  const enabled = layer.available && parentOn;
  const on = enabled && view.visible;
  const prov = PROVENANCE[layer.provenance];
  const children = LAYERS.filter((l) => l.parent === layer.id);
  const [open, setOpen] = useState(false); // subcapas plegadas por defecto

  return (
    <div className={`flex flex-col gap-xs rounded-md px-xs py-xs ${on && !sub ? 'bg-surface' : ''} ${enabled ? '' : 'opacity-50'}`}>
      <Tooltip
        title={layer.source}
        text={
          <>
            {layer.resolution}
            <span className="mt-xs flex items-center gap-xs">
              <span className={`h-2 w-2 rounded-full ${prov.dot}`} /> {prov.label}
            </span>
          </>
        }
        className="items-center gap-sm"
      >
        <span tabIndex={0} className="flex min-h-[36px] min-w-0 flex-1 items-center gap-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <span
            className={`material-symbols-outlined notranslate shrink-0 ${sub ? 'text-[16px]' : 'text-[18px]'} ${layer.color ? '' : on ? 'text-accent' : 'text-on-surface-variant'}`}
            style={layer.color ? { color: layer.color } : undefined}
            translate="no"
            aria-hidden="true"
          >
            {layer.icon}
          </span>
          <span className={`truncate font-body text-body-sm ${on ? 'text-on-surface' : 'text-on-surface-variant'}`}>{layer.name}</span>
          {!sub && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${prov.dot}`} aria-label={prov.label} />}
        </span>
        {children.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${layer.name} options`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-on-surface-variant hover:text-on-surface"
          >
            <Icon name="expand_more" className={`text-[20px] transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        {layer.available ? (
          <Switch checked={view.visible} onChange={() => toggle(layer.id)} label={layer.name} disabled={!parentOn} />
        ) : (
          <Icon name="lock" className="text-[16px] text-on-surface-variant" />
        )}
      </Tooltip>

      {on && (layer.raster || layer.legend) && (
        <div
          className={`gap-sm ${
            layer.id === 'relief'
              ? 'flex flex-col items-center px-4'
              : 'flex flex-wrap items-center pl-[26px]'
          }`}
        >
          {layer.id === 'relief' ? (
            <div className="w-[90%] max-w-[210px]">
              <div
                className="h-2 w-full rounded-sm"
                style={{
                  background:
                    'linear-gradient(to right, #46261f, #704032, #965743, #ba795a, #d69e72, #e7bf98, #f2ddbb)',
                }}
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-on-surface-variant">
                <span>-4700 m</span>
                <span>-3000 m</span>
              </div>
            </div>
          ) : (
            layer.legend?.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-xs font-mono text-mono-sm text-on-surface-variant"
                translate="no"
              >
                <span className={`h-2 w-3 rounded-sm ${item.swatch}`} />
                {item.label}
              </span>
            ))
          )}

          {layer.raster && (
            <div
              className={`flex items-center gap-sm ${
                layer.id === 'relief'
                  ? 'w-[90%] max-w-[210px]'
                  : 'min-w-0 flex-1'
              }`}
            >
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={view.opacity}
                onChange={(e) => setOpacity(layer.id, Number(e.target.value))}
                aria-label={`${layer.name} opacity`}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
              />
              <Live className="w-9 shrink-0 text-right font-mono text-mono-sm text-on-surface-variant">
                {Math.round(view.opacity * 100)}%
              </Live>
            </div>
          )}
        </div>
      )}

      {children.length > 0 && open && (
        <div className="flex flex-col pl-[26px]">
          {children.map((c) => (
            <LayerRow key={c.id} layer={c} sub parentOn={on} />
          ))}
        </div>
      )}
    </div>
  );
}
