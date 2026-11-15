import { useState } from 'react';
import { useMission } from '@/features/mission';
import { ErrorNote } from '@/features/mission';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { suggestTitle, usePlanActions } from '../hooks/usePlanActions';

/** Guardar el plan en pantalla para hoy o mañana (o actualizar el que está abierto). */
export function SavePlanDialog({ today, onClose }: { today: number | null; onClose: () => void }) {
  const { state, targetById } = useMission();
  const { save } = usePlanActions();
  const active = state.activePlan;
  const [title, setTitle] = useState(active?.title ?? suggestTitle(state.goals, targetById));
  const initialDay = active && today !== null && active.sol === today + 1 ? 'tomorrow' : 'today';
  const [day, setDay] = useState<'today' | 'tomorrow'>(initialDay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (asNew: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await save({ day, title: title.trim(), asNew });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plan could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const days: { id: 'today' | 'tomorrow'; label: string; hint: string }[] = [
    { id: 'today', label: 'Today', hint: today !== null ? `Sol ${today}` : 'Current sol' },
    { id: 'tomorrow', label: 'Tomorrow', hint: today !== null ? `Sol ${today + 1}` : 'Next sol' },
  ];

  return (
    <Dialog title={active ? 'Save plan' : 'Save plan for a day'} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-label text-label-sm uppercase text-on-surface-variant">Name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="rounded-md border border-outline bg-surface px-sm py-xs font-body text-body-md text-on-surface focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-xs">
          <span className="font-label text-label-sm uppercase text-on-surface-variant">Day</span>
          <div className="grid grid-cols-2 gap-xs" role="radiogroup" aria-label="Day">
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={day === d.id}
                onClick={() => setDay(d.id)}
                className={`rounded-md border px-sm py-xs text-left transition-colors duration-fast ${
                  day === d.id ? 'border-accent bg-accent/10' : 'border-outline bg-surface hover:border-accent'
                }`}
              >
                <span className="block font-body text-body-md font-semibold text-on-surface">{d.label}</span>
                <span className="font-mono text-mono-sm text-on-surface-variant">{d.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="font-body text-body-sm text-on-surface-variant">
          Saved by {state.crew.members.find((m) => m.id === state.profileId)?.name ?? state.profileId}. Everyone on the
          team sees it in My plans.
        </p>
        {error && <ErrorNote message={error} onClose={() => setError(null)} />}
        <div className="flex flex-wrap justify-end gap-xs">
          {active && (
            <Button variant="ghost" size="sm" icon="add" loading={busy} disabled={!title.trim()} onClick={() => void submit(true)}>
              Save as new
            </Button>
          )}
          <Button size="sm" icon="save" loading={busy} disabled={!title.trim()} onClick={() => void submit(false)}>
            {active ? 'Update plan' : 'Save'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
