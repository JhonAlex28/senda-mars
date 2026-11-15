import { GoalList, type Target } from '@/features/targets';
import { SITES } from '@/features/globe/sites';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';

/** "My goals": objetivos elegidos, ordenados por prioridad. */
export function GoalsCard() {
  const { state, dispatch, targetById, procedureHistory, procedureHistoryError } = useMission();
  const goals = state.goals.map((id) => targetById.get(id)).filter((t): t is Target => !!t);
  const historyByMission = new Map<string, typeof procedureHistory>();
  for (const record of [...procedureHistory].reverse()) {
    const records = historyByMission.get(record.missionId) ?? [];
    records.push(record);
    historyByMission.set(record.missionId, records);
  }

  return (
    <Card title="My goals" action={<span title="Drag to set priority"><Icon name="drag_indicator" className="text-[18px] text-accent" /></span>}>
      <GoalList
        goals={goals}
        focusedId={state.focusedTargetId}
        onMove={(from, to) => dispatch({ type: 'moveGoal', from, to })}
        onRemove={(id) => dispatch({ type: 'toggleGoal', id })}
        onFocus={(id) => dispatch({ type: 'focusTarget', id })}
      />
      <div className="border-t border-outline-variant pt-sm">
        <h3 className="mb-xs flex items-center gap-xs font-label text-label-sm uppercase text-on-surface-variant">
          <Icon name="history" className="text-[16px] text-accent" /> Procedure history
        </h3>
        {procedureHistoryError && <p role="alert" className="mb-xs text-body-sm text-error">{procedureHistoryError}</p>}
        {historyByMission.size === 0 ? (
          <p className="text-body-sm text-on-surface-variant">Completed science procedures will appear here.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {[...historyByMission].map(([missionId, records]) => {
              const site = SITES.find((item) => item.id === missionId);
              return (
                <section key={missionId} aria-label={`${site?.name ?? missionId} procedure history`}>
                  <p className="mb-1 font-label text-label-sm text-on-surface">
                    {site ? `${site.name} · ${site.mission}` : missionId}
                    <span className="ml-xs text-on-surface-variant">
                      · {records.length} {records.length === 1 ? 'procedure' : 'procedures'}
                    </span>
                  </p>
                  <ol className="flex flex-col gap-1">
                    {records.map((record, index) => {
                      const target = targetById.get(record.targetId);
                      return (
                        <li key={`${record.completedAt}-${record.targetId}-${index}`} className="flex justify-between gap-xs text-body-sm">
                          <span className="min-w-0 truncate text-route-safe">{target?.name ?? record.targetId}</span>
                          <time className="shrink-0 text-on-surface-variant" dateTime={record.completedAt}>
                            {new Date(record.completedAt).toLocaleString()}
                          </time>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
