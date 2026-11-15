import { useState } from 'react';

interface GaleConceptModalProps {
  open: boolean;
  onClose: () => void;
}

type RoiFilter = 'all' | '25km' | '100km' | 'isru';

const GALE_ROIS: { id: string; kind: string; zone: '25km' | '100km'; category: 'science' | 'isru'; note: string }[] = [
  { id: 'W4', kind: 'Water ROI (ISRU)', zone: '25km', category: 'isru', note: 'Hydrated clay/sulfate target adjacent to LZ' },
  { id: 'IC1', kind: 'Inverted Channel', zone: '25km', category: 'science', note: 'Fluvial ridge deposit north of Aeolis Mons' },
  { id: 'IC2', kind: 'Inverted Channel', zone: '25km', category: 'science', note: 'Eastern deltaic inverted channel complex' },
  { id: 'C1', kind: 'Channel', zone: '25km', category: 'science', note: 'Peace Vallis / alluvial feeder channel' },
  { id: 'C5', kind: 'Channel', zone: '25km', category: 'science', note: 'Lower Mount Sharp canyon incision (~15 km)' },
  { id: 'F1', kind: 'Fan', zone: '25km', category: 'science', note: 'Alluvial fan apron in northern Gale basin' },
  { id: 'Ig1', kind: 'Igneous', zone: '25km', category: 'science', note: 'Basaltic/alkaline bedrock exposure near LZ' },
  { id: 'W1', kind: 'Water ROI (ISRU)', zone: '100km', category: 'isru', note: 'Southwestern hydrated basin deposit' },
  { id: 'W2', kind: 'Water ROI (ISRU)', zone: '100km', category: 'isru', note: 'Eastern Mount Sharp sulfate apron (~62 km)' },
  { id: 'W3', kind: 'Water ROI (ISRU)', zone: '100km', category: 'isru', note: 'Southeastern crater floor hydrated zone' },
  { id: 'C2 / C3 / C4 / C6', kind: 'Channels', zone: '100km', category: 'science', note: 'Regional valley networks (46–101 km traverses)' },
  { id: 'F2 / F3 / F4', kind: 'Fans', zone: '100km', category: 'science', note: 'Rim alluvial fans up to 157 km network' },
  { id: 'Ig2 – Ig6', kind: 'Igneous', zone: '100km', category: 'science', note: 'Crater rim & central peak igneous units (88–150 km)' },
];

/** On-demand modal presenting NASA's Gale Crater Exploration Zone (25/100 km ROIs, LZ coords) & SEV 2-phase architecture. */
export function GaleConceptModal({ open, onClose }: GaleConceptModalProps) {
  const [filter, setFilter] = useState<RoiFilter>('all');

  if (!open) return null;

  const visibleRois = GALE_ROIS.filter((r) => {
    if (filter === '25km') return r.zone === '25km';
    if (filter === '100km') return r.zone === '100km';
    if (filter === 'isru') return r.category === 'isru';
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-md backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Gale Crater Exploration Zone and SEV Concept"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-outline bg-surface-container p-lg shadow-2xl">
        <div className="mb-md flex items-start justify-between gap-md border-b border-outline-variant pb-sm">
          <div>
            <div className="font-mono text-mono-sm uppercase tracking-wider text-accent">
              NASA Human Mars Architecture · Gale Crater Exploration Zone
            </div>
            <h2 className="font-headline text-headline-md text-on-surface">
              Gale Crater Exploration Zone (25 km / 100 km) &amp; SEV Concept
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface hover:border-accent hover:text-accent"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Exact NASA Landing Zone (LZ) Coordinates Strip */}
        <div className="mb-md grid gap-xs rounded-md border border-accent/40 bg-surface p-sm font-mono text-[11px] sm:grid-cols-5">
          <div>
            <span className="block text-[10px] text-on-surface-variant">LZ LONGITUDE (E)</span>
            <strong className="text-accent">137.42009295°</strong>
          </div>
          <div>
            <span className="block text-[10px] text-on-surface-variant">LZ LATITUDE (S)</span>
            <strong className="text-accent">−4.59310427°</strong>
          </div>
          <div>
            <span className="block text-[10px] text-on-surface-variant">ELEVATION (MOLA)</span>
            <strong className="text-success">−4497.77 m</strong>
          </div>
          <div>
            <span className="block text-[10px] text-on-surface-variant">EASTING / NORTHING</span>
            <strong className="text-on-surface">8145534 / −272255 m</strong>
          </div>
          <div>
            <span className="block text-[10px] text-on-surface-variant">GEOLOGICAL UNITS</span>
            <strong className="text-on-surface">HNt · eHt · mNh · AHi</strong>
          </div>
        </div>

        <div className="grid gap-md md:grid-cols-2">
          <div className="rounded-md border border-outline bg-surface p-sm">
            <div className="mb-xs font-mono text-mono-sm font-bold uppercase text-accent">
              Official NASA Gale Crater EZ Map (25 km &amp; 100 km)
            </div>
            <img
              src="/assets/gale_ez_map.jpg"
              alt="Gale Crater Exploration Zone Map"
              className="mb-xs h-56 w-full rounded border border-outline-variant object-cover"
            />
            <p className="text-body-sm leading-snug text-on-surface-variant">
              <strong className="text-on-surface">Yellow (25 km EZ) &amp; Orange (100 km EZ)</strong> centered at the
              Landing Site Star. Black traverse network links <strong className="text-on-surface">Science ROIs</strong>{' '}
              (C, F, Ig, IC) and <strong className="text-success">ISRU Water ROIs (W1–W4)</strong>.
            </p>
          </div>

          <div className="rounded-md border border-outline bg-surface p-sm">
            <div className="mb-xs font-mono text-mono-sm font-bold uppercase text-success">
              Space Exploration Vehicle (Pressurized SEV)
            </div>
            <img
              src="/assets/media_1794680949467_33ae9a83.jpg"
              alt="Space Exploration Vehicle SEV"
              className="mb-xs h-56 w-full rounded border border-outline-variant bg-white object-contain"
            />
            <p className="text-body-sm leading-snug text-on-surface-variant">
              <strong className="text-on-surface">Pressurized Cabin (57 kPa):</strong> Supports 100 km EZ sorties with 0%
              PLSS O₂ draw in transit, deploying Foot EVA via rear suit-ports at steep Mount Sharp outcrops.
            </p>
          </div>
        </div>

        {/* Interactive ROI Explorer */}
        <div className="mt-md rounded-md border border-outline bg-surface p-sm">
          <div className="mb-xs flex flex-wrap items-center justify-between gap-xs">
            <span className="font-mono text-mono-sm font-bold uppercase text-on-surface">
              Gale EZ Science &amp; ISRU Regions of Interest ({visibleRois.length})
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
              {(
                [
                  ['all', 'All ROIs'],
                  ['25km', '25 km EZ (Inner)'],
                  ['100km', '100 km EZ (SEV)'],
                  ['isru', 'ISRU Water (W1–W4)'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded border px-sm py-0.5 ${
                    filter === id ? 'border-accent bg-primary text-on-primary font-bold' : 'border-outline text-on-surface-variant'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid max-h-44 gap-xs overflow-y-auto pr-xs sm:grid-cols-2 lg:grid-cols-3">
            {visibleRois.map((r) => (
              <div key={r.id} className="rounded border border-outline-variant bg-surface-container px-sm py-xs text-[11px]">
                <div className="flex items-center justify-between font-mono">
                  <strong className={r.category === 'isru' ? 'text-success' : 'text-accent'}>{r.id}</strong>
                  <span className="text-[10px] text-on-surface-variant">{r.zone}</span>
                </div>
                <div className="font-semibold text-on-surface">{r.kind}</div>
                <div className="text-[10px] text-on-surface-variant">{r.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
