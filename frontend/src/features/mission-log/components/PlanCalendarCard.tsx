import { useState } from 'react';
import { hasUnsavedChanges, useMission } from '@/features/mission';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { toast } from '@/shared/ui/Toast';
import { dayLabel, isSuggestedTitle, suggestTitle, usePlanActions, useTodaySol } from '../hooks/usePlanActions';
import { PlansDialog } from './PlansDialog';
import { SavePlanDialog } from './SavePlanDialog';

/**
 * Calendario de la misión: qué plan está abierto y para qué día, guardarlo y ver los demás.
 * Así se puede ejecutar el plan de hoy y dejar listo el de mañana sin perder ninguno.
 *
 * Estados: vacío → sin guardar → guardado → con cambios. El botón principal cambia con el estado
 * (Save plan / New plan / Update plan) para que siempre quede claro qué toca hacer.
 */
type Status = 'empty' | 'unsaved' | 'saved' | 'changed';

const BADGE: Record<Exclude<Status, 'empty'>, { label: string; icon: string; cls: string }> = {
  unsaved: { label: 'Not saved', icon: 'radio_button_unchecked', cls: 'border-warning/50 bg-warning/10 text-warning' },
  saved: { label: 'Saved', icon: 'check_circle', cls: 'border-success/50 bg-success/10 text-success' },
  changed: { label: 'Unsaved changes', icon: 'edit', cls: 'border-warning/50 bg-warning/10 text-warning' },
};

export function PlanCalendarCard() {
  const { state, dispatch, targetById } = useMission();
  const today = useTodaySol();
  const { save } = usePlanActions();
  const [dialog, setDialog] = useState<'save' | 'saveAsNew' | 'plans' | null>(null);
  const [updating, setUpdating] = useState(false);
  const active = state.activePlan;
  const hasContent = state.goals.length > 0;
  const status: Status = active ? (hasUnsavedChanges(state) ? 'changed' : 'saved') : hasContent ? 'unsaved' : 'empty';

  // Actualizar es un clic: mismo día; el nombre se mantiene salvo que lo haya puesto la app
  const update = async () => {
    if (!active) return;
    setUpdating(true);
    try {
      const title = isSuggestedTitle(active.title) ? suggestTitle(state.goals, targetById) : active.title;
      const saved = await save({ day: active.sol, title });
      toast({
        title: 'Plan updated',
        description: `“${saved.title}” · ${dayLabel(saved.sol, today)}. Your latest changes are saved.`,
      });
    } catch (e) {
      toast({ tone: 'error', title: 'Could not update the plan', description: e instanceof Error ? e.message : 'Try again in a moment.' });
    } finally {
      setUpdating(false);
    }
  };

  // Plan nuevo: limpia la pantalla; el guardado sigue en My plans
  const startNew = () => {
    const previous = active;
    dispatch({ type: 'resetMission' });
    dispatch({ type: 'dismissNotice' });
    toast({
      tone: 'info',
      icon: 'add_circle',
      title: 'Ready for a new plan',
      description: previous
        ? `“${previous.title}” is safe in My plans. Pick targets on the map to start the next one.`
        : 'Pick targets on the map to start.',
    });
  };

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
      {status === 'empty' && (
        <p className="font-body text-body-sm text-on-surface-variant">Pick targets and plan an outing, then save it for a day.</p>
      )}

      {status === 'unsaved' && (
        <div className="flex flex-col gap-xs">
          <StatusBadge status="unsaved" />
          <p className="font-body text-body-sm text-on-surface-variant">Save it for today or tomorrow so the crew can find it in My plans.</p>
        </div>
      )}

      {active && (status === 'saved' || status === 'changed') && (
        <div
          className={`flex flex-col gap-xs rounded-md border px-sm py-xs ${
            status === 'saved' ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'
          }`}
        >
          <StatusBadge status={status} />
          <p className="min-w-0 font-body text-body-md font-semibold text-on-surface">{active.title}</p>
          <p className="font-label text-label-sm text-accent">{dayLabel(active.sol, today)}</p>
          {status === 'changed' && (
            <p className="font-body text-body-sm text-on-surface-variant">You changed this plan. Update it to keep the changes.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-xs">
        {status === 'saved' ? (
          <Button size="sm" variant="secondary" icon="add" onClick={startNew}>
            New plan
          </Button>
        ) : status === 'changed' ? (
          <Button size="sm" icon="sync" loading={updating} onClick={() => void update()}>
            Update plan
          </Button>
        ) : (
          <Button size="sm" icon="save" disabled={status === 'empty'} onClick={() => setDialog('save')}>
            Save plan
          </Button>
        )}
        <Button size="sm" variant="ghost" icon="event_note" onClick={() => setDialog('plans')}>
          My plans
        </Button>
      </div>
      {status === 'changed' && (
        <button
          type="button"
          onClick={() => setDialog('saveAsNew')}
          className="self-center font-label text-label-sm text-on-surface-variant underline-offset-2 transition-colors duration-fast hover:text-accent hover:underline"
        >
          or save as a new plan
        </button>
      )}

      {(dialog === 'save' || dialog === 'saveAsNew') && (
        <SavePlanDialog today={today} asNew={dialog === 'saveAsNew'} onClose={() => setDialog(null)} />
      )}
      {dialog === 'plans' && <PlansDialog today={today} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function StatusBadge({ status }: { status: Exclude<Status, 'empty'> }) {
  const b = BADGE[status];
  return (
    <span
      className={`inline-flex w-max shrink-0 items-center gap-[3px] rounded-full border px-sm py-[2px] font-label text-label-sm uppercase ${b.cls}`}
    >
      <Icon name={b.icon} filled={status === 'saved'} className="text-[14px]" />
      {b.label}
    </span>
  );
}
