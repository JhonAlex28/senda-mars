import { Card } from '@/shared/ui/Card';
import { useMission } from '../state/MissionContext';

/**
 * Interactive NASA MSL Curiosity REMS & RAD Gale Crater Live Environmental Panel.
 * Allows adjusting dust opacity (tau), Local Mean Solar Time (LMST), and SPE radiation flares
 * to observe real-time impact on surface temperature, SEV range, and EVA thermal/radiation margins.
 */
export function MarsWeatherCard() {
  const { state, dispatch } = useMission();
  const { tau, lmstHour, speActive } = state.env;

  // Diurnal Gale Crater REMS temperature curve (-68C at 06:00, +2C at 14:00) damped by dust opacity
  const diurnalPhase = Math.sin(((lmstHour - 6) / 14) * Math.PI);
  const baseTemp = -68 + 70 * Math.max(0, diurnalPhase);
  const dustDamping = (tau - 0.62) * 8;
  const tempC = Math.round(baseTemp - dustDamping);
  const pressurePa = Math.round(740 + 6 * Math.cos(((lmstHour - 12) / 12) * Math.PI));
  const windMs = Number((4.2 + tau * 4.8).toFixed(1));
  const radMsv = speActive ? 1.85 : Number((0.67 - Math.min(0.08, (tau - 0.62) * 0.03)).toFixed(2));
  const sevRangeKm = Math.round(100 * Math.exp(-0.21 * Math.max(0, tau - 0.62)));

  const dustBadge =
    tau >= 2.0
      ? { label: 'STORM', cls: 'border-rose-500/50 bg-rose-500/15 text-rose-300' }
      : tau >= 1.1
        ? { label: 'HAZY', cls: 'border-amber-500/50 bg-amber-500/15 text-amber-300' }
        : { label: 'CLEAR', cls: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' };

  return (
    <Card
      title="REMS / RAD Live"
      action={
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${dustBadge.cls}`}>
          {dustBadge.label}
        </span>
      }
      className="gap-xs"
    >
      <div className="grid grid-cols-2 gap-xs font-mono text-[10px]">
        <div className="rounded border border-outline-variant bg-surface p-xs">
          <div className="text-on-surface-variant">AIR TEMP</div>
          <div className={`text-sm font-bold ${tempC < -45 ? 'text-amber-300' : 'text-on-surface'}`}>
            {tempC > 0 ? `+${tempC}` : tempC}°C
          </div>
        </div>
        <div className="rounded border border-outline-variant bg-surface p-xs">
          <div className="text-on-surface-variant">PRESSURE</div>
          <div className="text-sm font-bold text-on-surface">{pressurePa} Pa</div>
        </div>
        <div className="rounded border border-outline-variant bg-surface p-xs">
          <div className="text-on-surface-variant">RAD DOSE</div>
          <div className={`text-sm font-bold ${speActive ? 'text-rose-400' : 'text-accent'}`}>
            {radMsv} mSv/sol
          </div>
        </div>
        <div className="rounded border border-outline-variant bg-surface p-xs">
          <div className="text-on-surface-variant">SEV RANGE</div>
          <div className={`text-sm font-bold ${sevRangeKm < 70 ? 'text-amber-300' : 'text-emerald-400'}`}>
            {sevRangeKm} km
          </div>
        </div>
      </div>

      <label className="mt-xxs flex flex-col gap-0.5 font-mono text-[10px]">
        <div className="flex justify-between text-on-surface-variant">
          <span>DUST OPACITY (τ)</span>
          <span className="font-bold text-on-surface">
            τ = {tau.toFixed(2)} · {windMs} m/s
          </span>
        </div>
        <input
          type="range"
          min={0.3}
          max={3.2}
          step={0.05}
          value={tau}
          onChange={(e) => dispatch({ type: 'setEnv', env: { tau: Number(e.target.value) } })}
          className="accent-accent"
        />
      </label>

      <label className="flex flex-col gap-0.5 font-mono text-[10px]">
        <div className="flex justify-between text-on-surface-variant">
          <span>SOLAR TIME (LMST)</span>
          <span className="font-bold text-on-surface">{String(lmstHour).padStart(2, '0')}:00</span>
        </div>
        <input
          type="range"
          min={6}
          max={20}
          step={1}
          value={lmstHour}
          onChange={(e) => dispatch({ type: 'setEnv', env: { lmstHour: Number(e.target.value) } })}
          className="accent-accent"
        />
      </label>

      <button
        type="button"
        onClick={() => dispatch({ type: 'setEnv', env: { speActive: !speActive } })}
        className={`mt-xxs rounded border px-xs py-1 font-mono text-[10px] font-bold transition-colors ${
          speActive
            ? 'border-rose-400 bg-rose-500/20 text-rose-300'
            : 'border-outline bg-surface text-on-surface-variant hover:border-accent hover:text-on-surface'
        }`}
      >
        {speActive ? '⚠ SPE SOLAR FLARE ACTIVE (SEV CABIN)' : '☀ SIMULATE SPE RADIATION FLARE'}
      </button>
    </Card>
  );
}
