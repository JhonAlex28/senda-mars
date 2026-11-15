import { Icon } from '@/shared/ui/Icon';

interface LegendItem {
  label: string;
  swatch: string; // clase Tailwind
}

/** Brújula (arriba a la derecha) y leyenda de rutas (abajo, sobre la escala) para no tapar la guía. */
export function MapLegend({ items }: { items: LegendItem[] }) {
  return (
    <>
      <div
        className="pointer-events-none absolute right-md top-md z-20 flex h-10 w-10 flex-col items-center justify-center rounded-full border border-outline bg-surface-container/95"
        aria-label="North is up"
      >
        <span className="font-label text-label-sm leading-none text-primary">N</span>
        <Icon name="explore" className="text-[15px] text-on-surface" />
      </div>
      {items.length > 0 && (
        <div className="pointer-events-none absolute bottom-[52px] left-md z-20 flex items-center gap-md rounded-md border border-outline bg-surface-container/95 px-md py-xs">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-xs">
              <span className={`h-0.5 w-3 ${item.swatch}`} />
              <span className="font-body text-body-sm text-on-surface">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
