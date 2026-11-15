import { useState } from 'react';
import { HelmetStatusCard } from '@/features/mission/components/HelmetStatusCard';
import type { CrewConfig } from '@/features/mission/state/types';
import { ROVER_VEHICLES, type RoverVehicleId } from '@/features/mission/state/vehicles';
import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Meter, toneForRemaining } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import type { Simulation } from '../hooks/useSimulation';
import { legRemaining, type Leg, type LegStop } from '../lib/itinerary';
import { MODE_ICON, stopLabel } from '../lib/labels';
import { ContingencyDialog } from './ContingencyDialog';

const SPEEDS = [1, 4, 15];

/** Botón principal al detenerse en una parada: dice qué pasa al pulsarlo (a dónde se va), no solo "continuar". */
function arrivalAction(stop: LegStop, nextLeg: Leg | undefined): { label: string; icon: string } {
  if (stop.kind === 'base' || !nextLeg) return { label: 'Finish the mission', icon: 'flag' };
  if (nextLeg.mode === 'eva') return { label: `Start spacewalk at ${stop.refId}`, icon: 'directions_walk' };
  if (nextLeg.parkingId) return { label: `Drive to stop ${nextLeg.parkingId}`, icon: 'airport_shuttle' };
  return { label: 'Drive back to base', icon: 'home' };
}

interface ExecutionPanelProps {
  sim: Simulation;
  targetName: (id: string) => string | undefined;
  vehicleId?: RoverVehicleId;
  vehicleSpeedKmh?: number;
  crew?: CrewConfig;
}

/** Panel derecho del modo Go: dónde voy, cuánto falta, recursos y acciones. */
export function ExecutionPanel({ sim, targetName, vehicleId = 'SEV_PRESSURIZED', vehicleSpeedKmh = 8.0, crew }: ExecutionPanelProps) {
  const veh = ROVER_VEHICLES[vehicleId];
  const { state, leg, dispatch, busy, error, clearError } = sim;
  const [contingencyOpen, setContingencyOpen] = useState(false);
  const walking = leg.mode === 'eva';
  const next = leg.stops[state.nextStop];
  const remaining = legRemaining(leg, state.t, state.nextStop);
  const nextLeg = state.legs[state.legIndex + 1];
  const taskRunning = !!state.task && state.task.doneMin < state.task.durationMin;

  const roverCapacity = state.legs.find((l) => l.mode === 'rover')?.capacity ?? 1;
  const battery = 100 * (1 - state.battery / roverCapacity);
  const suit = 100 * (1 - state.suitO2 / leg.capacity);
  const action = state.arrived && state.arrived.kind !== 'target' ? arrivalAction(state.arrived, nextLeg) : null;

  return (
    <>
      <Card tone="accent" className="gap-xs">
        <div className="flex items-start justify-between gap-sm">
          <p className="flex min-w-0 items-center gap-xs font-headline text-headline-sm">
            <Icon name={MODE_ICON[leg.mode]} className="shrink-0 text-[22px] text-accent" />
            <Phrase>{leg.title}</Phrase>
          </p>
          <Live className="shrink-0 font-mono text-mono-sm text-on-surface-variant">
            {state.legIndex + 1}/{state.legs.length}
          </Live>
        </div>
        <dl className="grid grid-cols-3 gap-xs text-center">
          <div className="min-w-0 rounded-md border border-outline-variant bg-surface p-xs">
            <dt className="font-label text-label-sm uppercase text-on-surface-variant">Next stop</dt>
            <dd className="break-words font-body text-body-sm text-on-surface" title={next ? stopLabel(next, targetName) : undefined}>
              {next ? <Phrase>{stopLabel(next, targetName)}</Phrase> : '—'}
            </dd>
          </div>
          <div className="min-w-0 rounded-md border border-outline-variant bg-surface p-xs">
            <dt className="font-label text-label-sm uppercase text-on-surface-variant">Distance</dt>
            <dd className="font-mono text-mono-md text-on-surface">
              <Live>{formatDistance(remaining.distance)}</Live>
            </dd>
          </div>
          <div className="min-w-0 rounded-md border border-outline-variant bg-surface p-xs">
            <dt className="font-label text-label-sm uppercase text-on-surface-variant">Time</dt>
            <dd className="font-mono text-mono-md text-on-surface">
              <Live>{formatMinutes(remaining.minutes)}</Live>
            </dd>
          </div>
        </dl>
        <p className="flex flex-wrap items-center gap-x-sm font-body text-body-sm text-on-surface-variant">
          <span>
            Trip time: <Live className="font-mono text-mono-sm text-on-surface">{formatMinutes(state.clock)}</Live>
          </span>
          {state.conditions.speed_factor < 1 && <span className="text-warning">🌪 Dust storm</span>}
          {state.conditions.o2_multiplier > 1 && <span className="text-warning">⚠ Suit leak</span>}
        </p>
      </Card>

      <Card title="Supplies" className="gap-xs">
        {[
          { label: '🔋 Rover battery', pct: battery },
          ...(walking ? [{ label: '🫁 PLSS Oxygen (Suit)', pct: suit }] : []),
        ].map(({ label, pct }) => (
          <div key={label} className="flex flex-col gap-xs">
            <div className="flex justify-between gap-sm font-body text-body-sm">
              <span className="text-on-surface-variant">{label}</span>
              <Live className="font-mono text-mono-sm">{Math.round(pct)}%</Live>
            </div>
            <Meter value={pct} tone={toneForRemaining(pct)} label={label} className="h-2" />
          </div>
        ))}
      </Card>

      <Card title={`Crew & Suit Telemetry · ${crew?.teamName ?? 'SENDA-ARES CREW'}`} className="gap-xs">
        {(() => {
          const effort = walking ? 1.35 : 0.72;
          const leakMult = state.conditions.o2_multiplier;
          const baseO2Rate = walking ? 0.14 : veh.transitO2Pct === 0 ? 0.02 : 0.11;
          const m1 = crew?.members[0] ?? { id: 'EVA-1', name: 'WATNEY', role: 'CDR', suitId: 'xEMU-01', restingBpm: 68, massKg: 78 };
          const m2 = crew?.members[1] ?? { id: 'EVA-2', name: 'LEWIS', role: 'GEO', suitId: 'xEMU-02', restingBpm: 64, massKg: 68 };
          const eva1Bpm = Math.round(m1.restingBpm + (walking ? 42 : 8) + Math.sin(state.clock * 0.4) * 4);
          const eva2Bpm = Math.round(m2.restingBpm + (walking ? 38 : 7) + Math.cos(state.clock * 0.35) * 3);
          const eva1O2 = Math.max(0, Math.round(suit - (walking ? 0 : 2)));
          const eva2O2 = Math.max(0, Math.round(suit * 0.98));
          const buddyDistM = walking ? Math.round(14 + Math.abs(Math.sin(state.clock * 0.3)) * 18) : 2;
          const lcvgTemp = Number((16.6 + (walking ? 1.1 : 0.0) + Math.sin(state.clock * 0.2) * 0.3).toFixed(1));
          const co2Pct = Number((0.49 * effort * (leakMult > 1 ? 1.15 : 1)).toFixed(2));
          return (
            <div className="flex flex-col gap-xs">
              <HelmetStatusCard
                astronautName={m1.name}
                suitId={m1.suitId}
                tempC={lcvgTemp}
                o2Pct={eva1O2}
                co2Pct={co2Pct}
                pressureKpa={walking ? 29.6 : 57.0}
                heartRateBpm={eva1Bpm}
                valPct={Math.round(35 * effort)}
              />
              <div className="grid grid-cols-2 gap-xs font-mono text-[10px]">
                <div className="col-span-2 flex items-center justify-between rounded border border-outline-variant bg-surface px-xs py-1 text-on-surface-variant">
                  <span>Vehicle: <strong className="text-accent">{veh.shortName}</strong></span>
                  <span>Cruise: <strong className="text-on-surface">{vehicleSpeedKmh.toFixed(1)} km/h</strong></span>
                </div>
                <div className="rounded border border-outline-variant bg-surface p-xs">
                  <div className="flex items-center justify-between font-semibold text-accent">
                    <span>{m1.name} ({m1.role})</span>
                    <span>{eva1Bpm} bpm</span>
                  </div>
                  <div className="mt-0.5 text-on-surface-variant">PLSS O₂: {eva1O2}% · {(baseO2Rate * effort * leakMult).toFixed(2)} kg/h</div>
                  <div className="text-on-surface-variant">Metab: {Math.round(850 * effort)} BTU/h</div>
                </div>
                <div className="rounded border border-outline-variant bg-surface p-xs">
                  <div className="flex items-center justify-between font-semibold text-primary">
                    <span>{m2.name} ({m2.role})</span>
                    <span>{eva2Bpm} bpm</span>
                  </div>
                  <div className="mt-0.5 text-on-surface-variant">PLSS O₂: {eva2O2}% · {(baseO2Rate * 0.94 * effort * leakMult).toFixed(2)} kg/h</div>
                  <div className="text-on-surface-variant">Metab: {Math.round(810 * effort)} BTU/h</div>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded border border-outline-variant bg-surface px-xs py-1 text-on-surface-variant">
                  <span>Buddy separation: <strong className="text-on-surface">{buddyDistM} m</strong></span>
                  <span className="text-success">CO₂ Scrubber OK · &lt;50 m</span>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {action && (
        <Button size="lg" icon={action.icon} className="w-full animate-fade-up" onClick={() => dispatch({ type: 'continue' })}>
          {action.label}
        </Button>
      )}

      {!state.arrived && (
        <div className="flex items-center gap-xs">
          <Button
            variant="ghost"
            icon={state.running ? 'pause' : 'play_arrow'}
            className="flex-1"
            onClick={() => dispatch({ type: 'setRunning', running: !state.running })}
          >
            {state.running ? 'Pause' : 'Resume'}
          </Button>
          <div className="flex overflow-hidden rounded-lg border border-outline" role="radiogroup" aria-label="Simulation speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={state.speed === s}
                title={`1 second = ${s} minutes`}
                onClick={() => dispatch({ type: 'setSpeed', speed: s })}
                className={`px-sm py-sm font-mono text-mono-sm ${state.speed === s ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant hover:text-on-surface'}`}
              >
                <Live>×{s}</Live>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-xs rounded-md border border-error/50 bg-error/10 p-sm font-body text-body-sm">
          <Icon name="error" className="text-[16px] text-error" />
          <Phrase className="flex-1">{error}</Phrase>
          <button type="button" onClick={clearError} aria-label="Dismiss">
            <Icon name="close" className="text-[16px]" />
          </button>
        </p>
      )}

      <div className="mt-auto flex flex-col gap-xs">
        <div className="flex items-center justify-between gap-xs rounded border border-outline-variant bg-surface px-xs py-1 font-mono text-[10px]">
          <span className="text-on-surface-variant">LIVE HAZARD SIM:</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={taskRunning || !!busy}
              onClick={() => sim.triggerContingency('dust')}
              className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-warning hover:bg-warning/20 disabled:opacity-40"
              title="Simulate Mars Dust Storm (τ > 2.5)"
            >
              Dust
            </button>
            <button
              type="button"
              disabled={taskRunning || !!busy}
              onClick={() => sim.triggerContingency('blocked')}
              className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-warning hover:bg-warning/20 disabled:opacity-40"
              title="Simulate Solar Proton Event / Blocked Terrain"
            >
              SPE / Block
            </button>
            <button
              type="button"
              disabled={taskRunning || !!busy}
              onClick={() => sim.triggerContingency('leak')}
              className="rounded border border-error/40 bg-error/10 px-1.5 py-0.5 text-error hover:bg-error/20 disabled:opacity-40"
              title="Simulate xEMU Suit Pressure Drop"
            >
              Suit Leak
            </button>
          </div>
        </div>
        <div className="flex items-stretch gap-xs">
        {walking && (
          <ActionTile icon="airport_shuttle" label="Return to rover" disabled={taskRunning || !!busy} loading={busy === 'rover'} onClick={sim.returnToRover} />
        )}
        <ActionTile icon="warning" label="Contingency" tone="warning" disabled={taskRunning || !!busy} loading={['blocked', 'dust', 'leak'].includes(busy ?? '')} onClick={() => setContingencyOpen(true)} />
        <ActionTile icon="home" label="Return to base" disabled={taskRunning || !!busy || state.arrived?.kind === 'base'} loading={busy === 'base'} onClick={sim.returnToBase} />
        </div>
      </div>

      <div className="rounded border border-outline-variant bg-surface px-xs py-1 font-mono text-[10px]">
        <div className="flex items-center justify-between">
          <span className="font-bold text-success">MSR SAMPLE CACHE</span>
          <span className="text-on-surface-variant">
            {state.completed.length} tube{state.completed.length === 1 ? '' : 's'} · {(state.completed.length * 0.25).toFixed(2)} kg
          </span>
        </div>
        {state.completed.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {state.completed.map((id, idx) => (
              <span key={id} className="rounded border border-success/40 bg-success/10 px-1.5 py-0.5 text-[9px] text-success">
                MSR-Ti-0{idx + 1}: {targetName(id) ?? id}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-0.5 text-[9px] text-on-surface-variant">En route — 0 titanium tubes sealed yet.</div>
        )}
      </div>

      <EventLog events={state.events} />

      {contingencyOpen && (
        <ContingencyDialog
          mode={leg.mode}
          onClose={() => setContingencyOpen(false)}
          onPick={(kind) => {
            setContingencyOpen(false);
            sim.triggerContingency(kind);
          }}
        />
      )}
    </>
  );
}

interface ActionTileProps {
  icon: string;
  label: string;
  tone?: 'default' | 'warning';
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

function ActionTile({ icon, label, tone = 'default', disabled, loading, onClick }: ActionTileProps) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-xs rounded-lg border border-outline bg-surface-container p-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'warning' ? 'text-warning enabled:hover:border-warning' : 'text-on-surface enabled:hover:border-accent'
      }`}
    >
      <Icon name={loading ? 'progress_activity' : icon} className={`text-[20px] ${loading ? 'animate-spin' : ''}`} />
      <span className="text-center font-label text-[10px] uppercase leading-tight">{label}</span>
    </button>
  );
}

/** Últimos eventos del viaje. Cada evento es un nodo propio (key estable), así se traduce una sola vez. */
function EventLog({ events }: { events: Simulation['state']['events'] }) {
  return (
    <ol className="flex flex-col gap-xs border-t border-outline-variant pt-sm" aria-label="Trip log">
      {events.slice(-4).reverse().map((e, i) => (
        <li
          key={`${e.clock}-${e.text}`}
          className={`flex items-start gap-xs font-body text-body-sm ${i === 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}
        >
          <Icon name={e.icon} className="mt-px shrink-0 text-[14px] text-accent" />
          <Live className="shrink-0 font-mono text-mono-sm">{formatMinutes(e.clock)}</Live>
          <span className="min-w-0 break-words">{e.text}</span>
        </li>
      ))}
    </ol>
  );
}
