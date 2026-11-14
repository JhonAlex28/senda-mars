import { ReadinessCard, type Readiness } from '@/features/environment';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Meter, toneForRemaining } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import { planReserve } from '../state/selectors';
import { useMission } from '../state/MissionContext';

/** Última revisión antes de salir: clima, recursos y condición de retorno. */
export function LaunchCard({ readiness }: { readiness: Readiness | null }) {
  const { state, dispatch } = useMission();
  const reserve = planReserve(state);
  if (!reserve) return null;
  const blocked = readiness?.verdict === 'no_go' || !reserve.returnOk;

  return (
    <div className="flex animate-fade-up flex-col gap-sm">
      {readiness && <ReadinessCard readiness={readiness} />}

      <Card title="Enough to come back?" tone={reserve.returnOk ? 'default' : 'error'} className="gap-xs">
        {[
          { label: '🔋 Rover battery at the end', pct: reserve.batteryPct },
          { label: 'Oxygen left after the longest walk', pct: reserve.minO2Pct },
        ].map(({ label, pct }) => (
          <div key={label} className="flex flex-col gap-xs">
            <div className="flex justify-between gap-sm font-body text-body-sm">
              <span className="min-w-0 text-on-surface-variant">{label}</span>
              <Live className="shrink-0 font-mono text-mono-sm">{Math.round(pct)}%</Live>
            </div>
            <Meter value={pct} tone={toneForRemaining(pct)} label={label} />
          </div>
        ))}
        <p className={`flex items-start gap-xs font-body text-body-sm ${reserve.returnOk ? 'text-success' : 'text-error'}`}>
          <Icon name={reserve.returnOk ? 'verified' : 'report'} className="mt-px shrink-0 text-[16px]" />
          <Phrase>
            {reserve.returnOk
              ? 'There is enough extra to come back to the base safely.'
              : 'There is not enough extra. Choose easier paths or fewer goals.'}
          </Phrase>
        </p>
      </Card>

      {/* Siempre visible al pie del panel, aunque haya que desplazarse */}
      <div className="sticky bottom-0 bg-surface pb-xs pt-xs">
        <Button size="lg" icon="rocket_launch" className="w-full" disabled={blocked} onClick={() => dispatch({ type: 'setPhase', phase: 'go' })}>
          Start trip
        </Button>
      </div>
    </div>
  );
}
