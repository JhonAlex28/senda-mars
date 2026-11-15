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

/** Panel de capas: encender/apagar, opacidad y, al pasar el cursor, de dónde viene cada dato. */
export function LayersPanel() {
  const ready = LAYERS.filter((l) => l.available);
  const soon = LAYERS.filter((l) => !l.available);

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

function LayerRow({ layer }: { layer: LayerDef }) {
  const { layers, toggle, setOpacity } = useLayers();
  const view = layers[layer.id];
  const on = layer.available && view.visible;
  const prov = PROVENANCE[layer.provenance];

  return (
    <div className={`flex flex-col gap-xs rounded-md px-xs py-xs ${on ? 'bg-surface' : ''} ${layer.available ? '' : 'opacity-50'}`}>
      {/* El tooltip abarca toda la fila: aparece a la derecha del panel, sin tapar los interruptores */}
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
        <span tabIndex={0} className="flex min-w-0 flex-1 items-center gap-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Icon name={layer.icon} className={`shrink-0 text-[18px] ${on ? 'text-accent' : 'text-on-surface-variant'}`} />
          <span className={`truncate font-body text-body-sm ${on ? 'text-on-surface' : 'text-on-surface-variant'}`}>{layer.name}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${prov.dot}`} aria-label={prov.label} />
        </span>
        {layer.available ? (
          <Switch checked={view.visible} onChange={() => toggle(layer.id)} label={layer.name} />
        ) : (
          <Icon name="lock" className="text-[16px] text-on-surface-variant" />
        )}
      </Tooltip>

      {on && (layer.raster || layer.legend) && (
        <div className="flex items-center gap-sm pl-[26px]">
          {layer.legend?.map((item) => (
            <span key={item.label} className="flex items-center gap-xs font-mono text-mono-sm text-on-surface-variant" translate="no">
              <span className={`h-2 w-3 rounded-sm ${item.swatch}`} />
              {item.label}
            </span>
          ))}
          {layer.raster && (
            <>
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
              <Live className="w-9 text-right font-mono text-mono-sm text-on-surface-variant">{Math.round(view.opacity * 100)}%</Live>
            </>
          )}
        </div>
      )}
    </div>
  );
}
