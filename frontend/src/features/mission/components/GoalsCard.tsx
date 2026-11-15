import { runBrowserQaoaSolver } from '@/features/route-planning';
import { GoalList, type Target } from '@/features/targets';
import { SITES } from '@/features/globe/sites';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';

/** "My goals": objetivos elegidos, ordenados por prioridad. */
export function GoalsCard() {
  const { state, dispatch, targets, targetById, procedureHistory, procedureHistoryError } = useMission();
  const goals = state.goals.map((id) => targetById.get(id)).filter((t): t is Target => !!t);
  const historyByMission = new Map<string, typeof procedureHistory>();
  for (const record of [...procedureHistory].reverse()) {
    const records = historyByMission.get(record.missionId) ?? [];
    records.push(record);
    historyByMission.set(record.missionId, records);
  }

  const totalScience = goals.reduce((acc, g) => acc + g.rubric.total, 0);
  const avgScience = goals.length > 0 ? (totalScience / goals.length).toFixed(1) : '0.0';
  const sumNovelty = goals.reduce((acc, g) => acc + g.rubric.novelty, 0);
  const sumHabit = goals.reduce((acc, g) => acc + g.rubric.habitability, 0);
  const sumHuman = goals.reduce((acc, g) => acc + g.rubric.human_only, 0);

  return (
    <Card title="My goals" action={<span title="Drag to set priority"><Icon name="drag_indicator" className="text-[18px] text-accent" /></span>}>
      <GoalList
        goals={goals}
        focusedId={state.focusedTargetId}
        onMove={(from, to) => dispatch({ type: 'moveGoal', from, to })}
        onRemove={(id) => dispatch({ type: 'toggleGoal', id })}
        onFocus={(id) => dispatch({ type: 'focusTarget', id })}
      />
      {goals.length > 0 && (
        <div className="mt-xs rounded-md border border-outline-variant bg-surface px-sm py-xs font-mono text-[10px]">
          <div className="flex items-center justify-between text-on-surface">
            <span className="text-on-surface-variant">NASA SCIENCE RUBRIC</span>
            <strong className="text-emerald-400">{totalScience} pts (Avg {avgScience}/15)</strong>
          </div>
          <div className="mt-0.5 flex justify-between text-on-surface-variant">
            <span>Novelty: {sumNovelty}</span>
            <span>Habit: {sumHabit}</span>
            <span>Human-Only: {sumHuman}</span>
          </div>
          {goals.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                const res = runBrowserQaoaSolver({
                  base: state.base ?? { lon: 137.42009295, lat: -4.59310427 },
                  targets,
                  selectedGoalIds: state.goals,
                  speedKmh: state.vehicleSpeedKmh,
                  layers: 2,
                  shots: 1024,
                });
                if (res.recommendedTargetIds.length > 0) {
                  const deltaKm = Number((res.quantumMetrics.distanceKm - res.classicalBaseline.distanceKm).toFixed(2));
                  const deltaKwh = Number((res.quantumMetrics.energyKwh - res.classicalBaseline.energyKwh).toFixed(2));
                  dispatch({
                    type: 'applyQuantumGoals',
                    goals: res.recommendedTargetIds,
                    summary: {
                      backendName: res.backendName,
                      jobId: res.jobId,
                      nQubits: res.nQubits,
                      layers: res.layers,
                      shots: res.shots,
                      bestBitstring: res.bestBitstring,
                      expectationValue: res.expectationValue,
                      recommendedTargetIds: res.recommendedTargetIds,
                      deltaKm,
                      deltaKwh,
                    },
                  });
                }
              }}
              className="mt-xs w-full rounded border border-[#A371F7]/50 bg-[#1A132B] px-xs py-1 font-mono text-[10px] font-bold text-[#D2B4FF] hover:bg-[#271C40]"
              title="Optional QAOA waypoint optimizer (runs locally without Qiskit)"
            >
              ⚛ Optional: Quantum Optimize Order
            </button>
          )}
          {state.quantumSummary && (
            <div className="mt-xs flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/10 px-xs py-0.5 font-mono text-[9px] text-emerald-300">
              <span>QAOA {state.quantumSummary.bestBitstring}</span>
              <span>
                {(state.quantumSummary.deltaKm ?? 0) <= 0
                  ? `${state.quantumSummary.deltaKm?.toFixed(1)} km`
                  : `+${state.quantumSummary.deltaKm?.toFixed(1)} km`}{' '}
                ·{' '}
                {(state.quantumSummary.deltaKwh ?? 0) <= 0
                  ? `${state.quantumSummary.deltaKwh?.toFixed(1)} kWh`
                  : `+${state.quantumSummary.deltaKwh?.toFixed(1)} kWh`}
              </span>
            </div>
          )}
        </div>
      )}
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
