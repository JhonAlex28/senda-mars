import { useState } from 'react';
import { CHECK_ICON, VERDICT_META, plainWord, type Readiness } from '@/features/environment';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { TEXT_TONE } from '@/shared/ui/Meter';
import { Live } from '@/shared/ui/Text';
import { initialMissionState } from '../state/missionReducer';
import { useMission } from '../state/MissionContext';

const DEFAULT_ENV = initialMissionState.env;

/**
 * Clima en dos partes que no se mezclan:
 *  1. "Right now": las mediciones reales del backend (REMS/RAD) y su veredicto. Deciden si se puede salir.
 *  2. "Try a scenario": un simulador "¿y si…?" (polvo, hora, destello solar). Sus cifras son
 *     estimaciones con fórmulas; solo cambian el chequeo de salida, no las rutas calculadas.
 */
export function MarsWeatherCard({ readiness }: { readiness: Readiness | null }) {
  const verdict = readiness ? VERDICT_META[readiness.verdict] : null;

  return (
    <Card
      title="Weather"
      action={
        verdict && (
          <span className={`rounded-full border px-sm py-[1px] font-label text-label-sm ${TEXT_TONE[verdict.tone]} border-current`}>
            {verdict.label}
          </span>
        )
      }
      className="gap-sm"
    >
      <div className="flex flex-col gap-xs">
        <p className="font-label text-label-sm text-on-surface-variant">
          Right now
          {readiness && (
            <Live className="font-mono">
              {' '}
              · sol {readiness.sol}, {readiness.local_solar_time}
            </Live>
          )}
        </p>
        {readiness
          ? readiness.checks.map((check) => (
              <div key={check.key} className="flex items-center gap-sm" title={`${check.label} · measured by ${check.source}`}>
                <Icon name={CHECK_ICON[check.key]} className="shrink-0 text-[20px] text-accent" />
                <div className="min-w-0 flex-1">
                  <span className="block font-body text-body-sm leading-tight text-on-surface">{plainWord(check)}</span>
                  <Live className="font-mono text-mono-sm text-on-surface-variant">
                    {check.value} {check.unit}
                  </Live>
                </div>
                <Icon name={VERDICT_META[check.verdict].face} className={`shrink-0 text-[20px] ${TEXT_TONE[VERDICT_META[check.verdict].tone]}`} />
              </div>
            ))
          : Array.from({ length: 4 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded bg-surface" />)}
        <p className="font-body text-[11px] text-on-surface-variant">Measured by Curiosity's REMS and RAD instruments.</p>
      </div>

      <Scenario />
    </Card>
  );
}

/** Simulador "¿y si…?": plegado por defecto para no confundirlo con los datos reales. */
function Scenario() {
  const { state, dispatch } = useMission();
  const [open, setOpen] = useState(false);
  const { tau, lmstHour, speActive } = state.env;
  const changed = tau !== DEFAULT_ENV.tau || lmstHour !== DEFAULT_ENV.lmstHour || speActive !== DEFAULT_ENV.speActive;

  // Estimaciones (no mediciones), acotadas a los rangos publicados de REMS y RAD en Gale:
  // curva diaria de temperatura (-84 °C antes del amanecer a +4 °C por la tarde) amortiguada por
  // el polvo; dosis GCR de 0.64-0.67 mSv/sol modulada por la columna de CO2 (presión diaria
  // ~845 Pa); un destello solar la sube; la autonomía del rover baja con el polvo
  const phase = Math.sin(((lmstHour - 6) / 14) * Math.PI);
  const tempC = Math.round(-84 + 88 * Math.max(0, phase) - (tau - 0.62) * 8);
  const pressurePa = 845 + 18 * Math.cos(((lmstHour - 12) / 12) * Math.PI);
  const radBaseline = 0.67 - ((pressurePa - 820) / 100) * 0.02;
  const radMsv = speActive ? 1.85 : Number(Math.max(0.64, radBaseline - Math.min(0.03, (tau - 0.62) * 0.015)).toFixed(2));
  const rangeKm = Math.round(100 * Math.exp(-0.21 * Math.max(0, tau - 0.62)));
  const dustWord = tau >= 2 ? 'Dust storm' : tau >= 1.1 ? 'Hazy' : 'Clear';

  return (
    <div className="flex flex-col gap-xs border-t border-outline-variant pt-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between gap-xs font-label text-label-lg text-on-surface hover:text-accent"
      >
        <span className="flex items-center gap-xs">
          <Icon name="science" className="text-[18px] text-accent" />
          Try a scenario
          {changed && <span className="rounded-full bg-warning/20 px-xs font-label text-label-sm text-warning">on</span>}
        </span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[20px]" />
      </button>
      {!open && <p className="font-body text-[11px] text-on-surface-variant">What if a dust storm or a solar flare hits?</p>}

      {open && (
        <>
          <p className="rounded border border-warning/40 bg-warning/10 p-xs font-body text-[11px] text-on-surface">
            Practice only. These numbers are estimates, not measurements. They change the final launch check, not the routes.
            <span className="mt-[2px] block text-on-surface-variant">Bounded by published ranges: REMS −90…+6 °C, RAD 0.64–0.67 mSv/sol.</span>
          </p>

          <Slider label="Dust in the air" value={`${dustWord} · τ ${tau.toFixed(2)}`} min={0.3} max={3.2} step={0.05} current={tau}
            onChange={(v) => dispatch({ type: 'setEnv', env: { tau: v } })} />
          <Slider label="Time of day" value={`${String(lmstHour).padStart(2, '0')}:00`} min={6} max={20} step={1} current={lmstHour}
            onChange={(v) => dispatch({ type: 'setEnv', env: { lmstHour: v } })} />

          <label className="flex cursor-pointer items-center justify-between gap-sm font-body text-body-sm text-on-surface">
            <span className="flex items-center gap-xs">
              <Icon name="flare" className={`text-[18px] ${speActive ? 'text-error' : 'text-accent'}`} />
              Solar flare (radiation storm)
            </span>
            <input type="checkbox" checked={speActive} onChange={(e) => dispatch({ type: 'setEnv', env: { speActive: e.target.checked } })} className="accent-accent" />
          </label>

          <div className="grid grid-cols-3 gap-xs">
            <Estimate label="Air temp" value={`${tempC > 0 ? '+' : ''}${tempC} °C`} warn={tempC < -45} />
            <Estimate label="Radiation" value={`${radMsv} mSv`} warn={speActive} />
            <Estimate label="Rover range" value={`${rangeKm} km`} warn={rangeKm < 70} />
          </div>
          {speActive && <p className="font-body text-[11px] text-error">With a solar flare the launch check says NO GO: the crew stays inside.</p>}

          {changed && (
            <button type="button" onClick={() => dispatch({ type: 'setEnv', env: DEFAULT_ENV })} className="self-start font-label text-label-sm text-accent hover:underline">
              Back to normal
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step, current, onChange }: {
  label: string; value: string; min: number; max: number; step: number; current: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-[2px]">
      <span className="flex justify-between gap-xs font-body text-body-sm text-on-surface">
        {label}
        <Live className="font-mono text-mono-sm text-on-surface-variant">{value}</Live>
      </span>
      <input type="range" min={min} max={max} step={step} value={current} onChange={(e) => onChange(Number(e.target.value))} className="accent-accent" />
    </label>
  );
}

function Estimate({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className="rounded border border-outline-variant bg-surface p-xs text-center">
      <div className="font-label text-[10px] text-on-surface-variant">{label}</div>
      <Live className={`font-mono text-mono-sm ${warn ? 'text-warning' : 'text-on-surface'}`}>{value}</Live>
    </div>
  );
}
