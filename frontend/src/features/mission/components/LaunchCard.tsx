import { ReadinessBadge, type Readiness } from '@/features/environment';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Meter, toneForRemaining } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import { planReserve } from '../state/selectors';
import { useMission } from '../state/MissionContext';

/** Revisión final en una sola tarjeta: clima, lo que queda para volver y el botón de salida. */
export function LaunchCard({ readiness }: { readiness: Readiness | null }) {
  const { state, dispatch } = useMission();
  const reserve = planReserve(state);
  if (!reserve) return null;
  const dustPenaltyPct = Math.max(0, (state.env.tau - 0.62) * 14);
  const adjustedBatteryPct = Math.max(0, reserve.batteryPct - dustPenaltyPct);
  const blocked = readiness?.verdict === 'no_go' || !reserve.returnOk || adjustedBatteryPct < 15 || state.env.speActive;
  const supplies = [
    { icon: 'battery_charging_full', label: 'Rover battery', hint: 'Left when the rover is back at the base (adjusted for dust τ)', pct: adjustedBatteryPct },
    { icon: 'air', label: 'Suit oxygen', hint: 'Left after the longest spacewalk', pct: reserve.minO2Pct },
  ];

  return (
    <div className="sticky bottom-0 flex animate-fade-up flex-col gap-sm bg-surface pb-xs pt-xs">
      <Card tone={blocked ? 'error' : 'success'} className="gap-sm">
        {readiness && <ReadinessBadge readiness={readiness} />}
        {supplies.map(({ icon, label, hint, pct }) => (
          <div key={label} className="flex items-center gap-sm" title={hint}>
            <Icon name={icon} className="shrink-0 text-[18px] text-accent" />
            <span className="w-28 shrink-0 font-body text-body-sm text-on-surface-variant">{label}</span>
            <Meter value={pct} tone={toneForRemaining(pct)} label={label} className="h-1.5 flex-1" />
            <Live className="w-10 shrink-0 text-right font-mono text-mono-sm">{Math.round(pct)}%</Live>
          </div>
        ))}
        {!reserve.returnOk && (
          <p className="flex items-center gap-xs font-body text-body-sm text-error">
            <Icon name="report" className="shrink-0 text-[16px]" />
            <Phrase>Not enough to come back. Pick easier routes or fewer goals.</Phrase>
          </p>
        )}
        <div className="grid grid-cols-2 gap-xs rounded border border-outline-variant bg-surface p-xs font-mono text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">CREW/SUITS</span>
            <span className="font-bold text-emerald-400">GO ({state.crew.members[0].suitId})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">SEV BATTERY</span>
            <span className={`font-bold ${adjustedBatteryPct >= 20 ? 'text-emerald-400' : 'text-error'}`}>
              {adjustedBatteryPct >= 20 ? 'GO' : 'NO-GO'} ({Math.round(adjustedBatteryPct)}%)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">PLSS O₂</span>
            <span className={`font-bold ${reserve.minO2Pct >= 20 ? 'text-emerald-400' : 'text-error'}`}>
              {reserve.minO2Pct >= 20 ? 'GO' : 'NO-GO'} ({Math.round(reserve.minO2Pct)}%)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">RAD / COMMS</span>
            <span className={`font-bold ${state.env.speActive ? 'text-error' : 'text-emerald-400'}`}>
              {state.env.speActive ? 'NO-GO (SPE)' : 'GO (94% LOS)'}
            </span>
          </div>
        </div>
        <Button size="lg" icon="rocket_launch" className="w-full" disabled={blocked} onClick={() => dispatch({ type: 'setPhase', phase: 'go' })}>
          Start mission
        </Button>
      </Card>
    </div>
  );
}
