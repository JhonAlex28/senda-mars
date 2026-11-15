import { useState } from 'react';
import { useMission } from '@/features/mission';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { dayLabel, useTodaySol } from '../hooks/usePlanActions';
import { PlansDialog } from './PlansDialog';
import { SavePlanDialog } from './SavePlanDialog';

/**
 * Calendario de la misión: qué plan está abierto y para qué día, guardarlo y ver los demás.
 * Así se puede ejecutar el plan de hoy y dejar listo el de mañana sin perder ninguno.
 */
export function PlanCalendarCard() {
  const { state } = useMission();
  const today = useTodaySol();
  const [dialog, setDialog] = useState<'save' | 'plans' | null>(null);
  const active = state.activePlan;
  const hasContent = state.goals.length > 0;

  return (
    <Card
      title={
        <span className="flex items-center gap-xs">
          <Icon name="calendar_month" className="text-[20px] text-accent" />
          Mission calendar
        </span>
      }
      className="gap-sm"
    >
      {active ? (
        <div className="rounded-md border border-accent/40 bg-accent/5 px-sm py-xs">
          <p className="font-body text-body-md font-semibold text-on-surface">{active.title}</p>
          <p className="font-label text-label-sm text-accent">{dayLabel(active.sol, today)}</p>
        </div>
      ) : (
        <p className="font-body text-body-sm text-on-surface-variant">
          {hasContent ? 'This plan is not saved yet. Save it for today or tomorrow.' : 'Plan an outing, then save it for a day.'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-xs">
        <Button size="sm" icon="save" disabled={!hasContent} onClick={() => setDialog('save')}>
          {active ? 'Save' : 'Save plan'}
        </Button>
        <Button size="sm" variant="ghost" icon="event_note" onClick={() => setDialog('plans')}>
          My plans
        </Button>
      </div>
      {dialog === 'save' && <SavePlanDialog today={today} onClose={() => setDialog(null)} />}
      {dialog === 'plans' && <PlansDialog today={today} onClose={() => setDialog(null)} />}
    </Card>
  );
}
