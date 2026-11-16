import { useCallback, useEffect, useState } from 'react';
import { ErrorNote, useMission } from '@/features/mission';
import { missionLogApi, type SavedPlan } from '@/shared/api/missionLog';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { dayLabel, usePlanActions } from '../hooks/usePlanActions';

type Tab = 'today' | 'tomorrow' | 'all';

/** Planes guardados por día: abrir, marcar como hecho o borrar. */
export function PlansDialog({ today, onClose }: { today: number | null; onClose: () => void }) {
  const { state, dispatch, targetById } = useMission();
  const { open } = usePlanActions();
  const [tab, setTab] = useState<Tab>('today');
  const [plans, setPlans] = useState<SavedPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    setPlans(null);
    missionLogApi
      .plans(tab)
      .then((r) => setPlans(r.plans))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Plans could not be loaded.'));
  }, [tab]);
  useEffect(load, [load]);

  const crewName = (id: string | null) => state.crew.members.find((m) => m.id === id)?.name ?? id ?? 'Unknown';
  const run = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: today !== null ? `Today · Sol ${today}` : 'Today' },
    { id: 'tomorrow', label: today !== null ? `Tomorrow · Sol ${today + 1}` : 'Tomorrow' },
    { id: 'all', label: 'All' },
  ];

  return (
    <Dialog title="My plans" size="lg" onClose={onClose}>
      <div className="flex flex-col gap-md">
        <div className="flex gap-xs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-md py-xs font-label text-label-lg transition-colors duration-fast ${
                tab === t.id ? 'bg-primary text-on-primary' : 'border border-outline text-on-surface-variant hover:border-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <ErrorNote message={error} onClose={() => setError(null)} />}
        {plans === null && !error && (
          <p className="flex items-center gap-xs font-body text-body-sm text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin text-[16px] text-accent" /> Loading plans…
          </p>
        )}
        {plans?.length === 0 && (
          <div className="rounded-lg border border-dashed border-outline p-md text-center">
            <p className="font-body text-body-md text-on-surface">No plans saved {tab === 'all' ? 'yet' : `for ${tab}`}.</p>
            <p className="mt-xs font-body text-body-sm text-on-surface-variant">
              Plan an outing and press Save, or ask the copilot: “Prepara la salida de mañana”.
            </p>
          </div>
        )}

        <ul className="scroll-thin flex max-h-[55vh] flex-col gap-xs overflow-y-auto pr-xs">
          {plans?.map((p) => {
            const isOpen = state.activePlan?.id === p.id;
            const targets = (p.summary.targets ?? []).map((id) => targetById.get(id)?.name.split(' (')[0] ?? id);
            return (
              <li key={p.id} className={`rounded-lg border p-sm ${isOpen ? 'border-accent bg-accent/5' : 'border-outline bg-surface'}`}>
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="flex items-center gap-xs font-body text-body-md font-semibold text-on-surface">
                      {p.title}
                      {isOpen && <span className="rounded-full bg-accent/20 px-xs font-label text-label-sm text-accent">open</span>}
                      {p.status === 'done' && <span className="rounded-full bg-success/20 px-xs font-label text-label-sm text-success">done</span>}
                    </p>
                    <p className="font-label text-label-sm text-on-surface-variant">
                      {dayLabel(p.sol, today)} · by {crewName(p.created_by)}
                    </p>
                    {targets.length > 0 && <p className="mt-[2px] truncate font-body text-body-sm text-on-surface-variant">{targets.join(', ')}</p>}
                  </div>
                  {p.summary.total_duration_min !== undefined && (
                    <Live className="shrink-0 font-mono text-mono-sm text-on-surface">{Math.round(p.summary.total_duration_min)} min</Live>
                  )}
                </div>
                <div className="mt-xs flex flex-wrap gap-xs">
                  <Button size="sm" icon="open_in_new" onClick={() =>
                      void run(async () => {
                        await open(p.id);
                        onClose();
                        toast({ tone: 'info', icon: 'folder_open', title: 'Plan opened', description: `“${p.title}” · ${dayLabel(p.sol, today)} is now on the map.` });
                      })
                    }>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={p.status === 'done' ? 'undo' : 'task_alt'}
                    onClick={() => void run(async () => { await missionLogApi.setStatus(p.id, p.status === 'done' ? 'planned' : 'done'); load(); })}
                  >
                    {p.status === 'done' ? 'Mark planned' : 'Mark done'}
                  </Button>
                  {confirmDelete === p.id ? (
                    <Button
                      size="sm"
                      variant="warning"
                      icon="delete"
                      onClick={() =>
                        void run(async () => {
                          await missionLogApi.remove(p.id);
                          if (isOpen) dispatch({ type: 'activePlanSet', active: null });
                          setConfirmDelete(null);
                          load();
                          toast({ tone: 'warning', icon: 'delete', title: 'Plan deleted', description: `“${p.title}” was removed from the calendar.` });
                        })
                      }
                    >
                      Confirm delete
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon="delete" onClick={() => setConfirmDelete(p.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-between gap-xs border-t border-outline-variant pt-sm">
          <p className="font-body text-body-sm text-on-surface-variant">Plans are shared with the whole team.</p>
          <Button
            size="sm"
            variant="secondary"
            icon="add"
            onClick={() => {
              dispatch({ type: 'resetMission' });
              onClose();
            }}
          >
            Start a new plan
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
