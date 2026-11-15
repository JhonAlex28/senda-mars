import { ReadinessBadge, type Readiness } from '@/features/environment';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Meter, toneForRemaining } from '@/shared/ui/Meter';
import { Live } from '@/shared/ui/Text';
import { planReserve } from '../state/selectors';
import { useMission } from '../state/MissionContext';

/**
 * Revisión final: clima real (REMS/RAD) y lo que queda para volver, según el motor.
 * Se puede salir si el clima no es NO GO y todas las rutas vuelven con la reserva de seguridad
 * (`return_ok`: 30 % de batería y factor 1.3 de O₂, en mission_params.json).
 */
export function LaunchCard({ readiness }: { readiness: Readiness | null }) {
  const { state, dispatch } = useMission();
  const reserve = planReserve(state);
  if (!reserve) return null;
  const blocked = readiness?.verdict === 'no_go' || !reserve.returnOk;
  const supplies = [
    { icon: 'battery_charging_full', label: 'Battery', pct: reserve.batteryPct },
    { icon: 'air', label: 'Suit O₂', pct: reserve.minO2Pct },
  ];

  return (
    <div className="sticky bottom-0 flex animate-fade-up flex-col gap-sm bg-surface pb-xs pt-xs">
      <Card tone={blocked ? 'error' : 'success'} className="gap-sm">
        {readiness && <ReadinessBadge readiness={readiness} />}
        {supplies.map(({ icon, label, pct }) => (
          <div key={label} className="flex items-center gap-sm">
            <Icon name={icon} className="shrink-0 text-[18px] text-accent" />
            <span className="w-20 shrink-0 font-body text-body-sm text-on-surface-variant">{label}</span>
            <Meter value={pct} tone={toneForRemaining(pct)} label={label} className="h-1.5 flex-1" />
            <Live className="w-10 shrink-0 text-right font-mono text-mono-sm">{Math.round(pct)}%</Live>
          </div>
        ))}
        {!reserve.returnOk && (
          <p className="flex items-center gap-xs font-body text-body-sm text-error">
            <Icon name="report" className="shrink-0 text-[16px]" />
            No safe return
          </p>
        )}
        <Button size="lg" icon="rocket_launch" className="w-full" disabled={blocked} onClick={() => dispatch({ type: 'setPhase', phase: 'go' })}>
          Start
        </Button>
      </Card>
    </div>
  );
}
