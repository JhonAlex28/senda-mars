import { useEffect, useState } from 'react';
import { formatLat, formatLon } from '@/shared/lib/geo';
import type { BBox } from '@/shared/types/geo';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';

function inside(site: BBox, lon: number, lat: number): boolean {
  return lon >= site.min_lon && lon <= site.max_lon && lat >= site.min_lat && lat <= site.max_lat;
}

interface CoordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

function CoordInput({ label, value, onChange, onCommit }: CoordInputProps) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label text-label-sm uppercase text-on-surface-variant">{label}</span>
      <input
        type="number"
        step="0.0001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === 'Enter' && onCommit()}
        className="rounded-md border border-outline bg-surface px-sm py-xs font-mono text-mono-md text-on-surface focus:border-accent focus:outline-none"
      />
    </label>
  );
}

/** Paso 1: confirmar la posición inicial (no hay GPS en Marte: se marca o se escribe). */
export function BaseCard({ site }: { site: BBox | null }) {
  const { state, dispatch } = useMission();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  useEffect(() => {
    if (state.base) {
      setLat(state.base.lat.toFixed(5));
      setLon(state.base.lon.toFixed(5));
    }
  }, [state.base]);

  const latNum = Number(lat);
  const lonNum = Number(lon);
  const valid = lat !== '' && lon !== '' && Number.isFinite(latNum) && Number.isFinite(lonNum);
  const outside = valid && site !== null && !inside(site, lonNum, latNum);

  const apply = () => {
    if (valid && !outside) dispatch({ type: 'moveBase', point: { lon: lonNum, lat: latNum } });
  };

  if (state.baseConfirmed && state.base) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-sm">
          <div className="flex items-center gap-sm">
            <Icon name="home_pin" filled className="text-[22px] text-primary" />
            <div>
              <p className="font-headline text-title-md">Base Alpha</p>
              <p translate="no" className="font-mono text-mono-sm text-on-surface-variant">
                {formatLat(state.base.lat)} · {formatLon(state.base.lon)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="edit" onClick={() => dispatch({ type: 'editBase' })}>
            Change
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Where is our base?" tone="accent" className="animate-fade-up">
      <p className="font-body text-body-sm text-on-surface-variant">
        We have no GPS on Mars. Tap the map where the base is, or type its coordinates.
      </p>
      <div className="grid grid-cols-2 gap-sm">
        <CoordInput label="Latitude (°N)" value={lat} onChange={setLat} onCommit={apply} />
        <CoordInput label="Longitude (°E)" value={lon} onChange={setLon} onCommit={apply} />
      </div>
      {outside && <p className="font-body text-body-sm text-error">That place is outside the mission area.</p>}
      <Button size="lg" icon="check" disabled={!state.base || outside} onClick={() => dispatch({ type: 'confirmBase' })}>
        Confirm base
      </Button>
    </Card>
  );
}
