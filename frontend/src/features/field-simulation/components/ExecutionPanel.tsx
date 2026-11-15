import { useState } from 'react';
import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Meter, toneForRemaining } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import type { EngineAlert } from '@/features/safety';
import type { Simulation } from '../hooks/useSimulation';
import { legRemaining, type Leg, type LegStop } from '../lib/itinerary';
import { MODE_ICON, stopLabel } from '../lib/labels';
import { ContingencyDialog } from './ContingencyDialog';

const SPEEDS = [1, 4, 15];

/** Botón principal al detenerse en una parada: dice qué pasa al pulsarlo (a dónde se va), no solo "continuar". */
function arrivalAction(stop: LegStop, nextLeg: Leg | undefined): { label: string; icon: string } {
  if (stop.kind === 'base' || !nextLeg) return { label: 'Finish', icon: 'flag' };
  if (nextLeg.mode === 'eva') return { label: `Start EVA · ${stop.refId}`, icon: 'directions_walk' };
  if (nextLeg.parkingId) return { label: `Drive to ${nextLeg.parkingId}`, icon: 'airport_shuttle' };
  if (nextLeg.waypointId) return { label: `Drive to ${nextLeg.waypointId}`, icon: 'airport_shuttle' };
  return { label: 'Drive to base', icon: 'home' };
}

interface ExecutionPanelProps {
  sim: Simulation;
  targetName: (id: string) => string | undefined;
}

/** Panel derecho del modo Go: dónde voy, cuánto falta, recursos y acciones. */
export function ExecutionPanel({ sim, targetName }: ExecutionPanelProps) {
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
          <span className="flex items-center gap-xs">
            <Icon name="timer" className="text-[16px]" />
            <Live className="font-mono text-mono-sm text-on-surface">{formatMinutes(state.clock)}</Live>
          </span>
          {state.conditions.speed_factor < 1 && <span className="text-warning">Dust storm</span>}
          {state.conditions.o2_multiplier > 1 && <span className="text-warning">Suit leak</span>}
        </p>
      </Card>

      {sim.engineAlert && <SafetyAlert alert={sim.engineAlert} onClose={sim.clearEngineAlert} />}

      <Card title="Supplies" className="gap-xs">
        {[
          { label: 'Battery', pct: battery },
          ...(walking ? [{ label: 'Suit O₂', pct: suit }] : []),
        ].map(({ label, pct }) => (
          <div key={label} className="flex flex-col gap-xs">
            <div className="flex justify-between gap-sm font-body text-body-sm">
              <span className="text-on-surface-variant">{label}</span>
              <Live className="font-mono text-mono-sm">{Math.round(pct)}%</Live>
            </div>
            <Meter value={pct} tone={toneForRemaining(pct)} label={label} className="h-2" />
          </div>
        ))}
        {sim.liveSafety && (
          <div className="flex items-center justify-between gap-sm rounded-md bg-surface px-sm py-xs">
            <span className="flex items-center gap-xs font-body text-body-sm text-on-surface-variant">
              <Icon name="u_turn_left" className="text-[16px] text-accent" />
              Return reserve
            </span>
            <Live className={`font-mono text-mono-sm font-bold ${sim.liveSafety.reserveL < 0 ? 'text-error' : 'text-on-surface'}`}>
              {sim.liveSafety.reserveL.toFixed(0)} L
            </Live>
          </div>
        )}
        {sim.liveSafety?.alert && (
          <p className={`flex items-center gap-xs font-body text-body-sm ${sim.liveSafety.alert.level === 'rtb' ? 'text-error' : 'text-warning'}`}>
            <Icon name="warning" className="text-[16px]" />
            <Phrase>{sim.liveSafety.alert.msg}</Phrase>
          </p>
        )}
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
        <div className="flex items-stretch gap-xs">
        {walking && (
          <ActionTile icon="airport_shuttle" label="To vehicle" disabled={taskRunning || !!busy} loading={busy === 'rover'} onClick={sim.returnToRover} />
        )}
        <ActionTile icon="warning" label="Contingency" tone="warning" disabled={taskRunning || !!busy} loading={['blocked', 'dust', 'leak', 'injury', 'sep'].includes(busy ?? '')} onClick={() => setContingencyOpen(true)} />
        <ActionTile icon="home" label="To base" disabled={taskRunning || !!busy || state.arrived?.kind === 'base'} loading={busy === 'base'} onClick={sim.returnToBase} />
        </div>
      </div>

      <EventLog events={state.events} />

      {contingencyOpen && (
        <ContingencyDialog
          options={sim.contingencyOptions}
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

/** Alerta del motor de seguridad tras una contingencia (código + mensaje, color por nivel). */
function SafetyAlert({ alert, onClose }: { alert: EngineAlert; onClose: () => void }) {
  const rtb = alert.level === 'rtb';
  return (
    <div role="alert" className={`flex items-start gap-sm rounded-lg border-2 p-sm ${rtb ? 'border-error bg-error/10' : 'border-warning bg-warning/10'}`}>
      <Icon name={rtb ? 'u_turn_left' : 'warning'} className={`text-[22px] ${rtb ? 'text-error' : 'text-warning'}`} />
      <div className="min-w-0 flex-1">
        <p className={`font-headline text-title-md uppercase ${rtb ? 'text-error' : 'text-warning'}`}>{rtb ? 'Return now' : 'Caution'}</p>
        <Phrase className="font-body text-body-sm text-on-surface">{alert.msg}</Phrase>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="flex h-11 w-11 items-center justify-center text-on-surface-variant hover:text-on-surface">
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
