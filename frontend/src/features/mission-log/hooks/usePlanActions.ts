import { useEffect, useState } from 'react';
import { planPayload, planSummaryOf, useMission, type SavedPlanPayload } from '@/features/mission';
import { missionLogApi, type PlanDay, type SavedPlan, type SavedPlanSummary } from '@/shared/api/missionLog';

export interface SaveOptions {
  day: PlanDay;
  title: string;
  asNew?: boolean; // guardar como plan nuevo aunque haya uno abierto
  payload?: SavedPlanPayload; // por defecto, lo que hay en pantalla
  summary?: Partial<SavedPlanSummary>;
}

/** Sol actual del servidor ("hoy"); "mañana" es el siguiente. */
export function useTodaySol(): number | null {
  const [sol, setSol] = useState<number | null>(null);
  useEffect(() => {
    missionLogApi
      .plans()
      .then((r) => setSol(r.today_sol))
      .catch(() => setSol(null));
  }, []);
  return sol;
}

export function dayLabel(sol: number, today: number | null): string {
  if (today === null) return `Sol ${sol}`;
  if (sol === today) return `Today · Sol ${sol}`;
  if (sol === today + 1) return `Tomorrow · Sol ${sol}`;
  return sol < today ? `Sol ${sol} (past)` : `Sol ${sol}`;
}

/** Guardar y abrir planes del calendario. Lo usan la tarjeta del calendario y el copiloto. */
export function usePlanActions() {
  const { state, dispatch } = useMission();

  const save = async ({ day, title, asNew, payload, summary }: SaveOptions): Promise<SavedPlan> => {
    const input = {
      title,
      day,
      site_id: state.missionId,
      created_by: state.profileId,
      summary: summary ?? planSummaryOf(state),
      payload: payload ?? planPayload(state),
    };
    const active = state.activePlan;
    const saved = active && !asNew ? await missionLogApi.update(active.id, input) : await missionLogApi.create(input);
    dispatch({ type: 'activePlanSet', active: { id: saved.id, title: saved.title, sol: saved.sol } });
    return saved;
  };

  const open = async (id: string): Promise<SavedPlan<SavedPlanPayload>> => {
    const plan = await missionLogApi.plan<SavedPlanPayload>(id);
    if (!plan.payload) throw new Error('This plan has no content to open.');
    dispatch({ type: 'planOpened', plan: plan.payload, active: { id: plan.id, title: plan.title, sol: plan.sol } });
    return plan;
  };

  return { save, open };
}

/** Título sugerido a partir de los objetivos del plan. */
export function suggestTitle(goals: string[], names: Map<string, { name: string }>): string {
  if (goals.length === 0) return 'New outing';
  const first = names.get(goals[0])?.name.split(' (')[0] ?? goals[0];
  return goals.length === 1 ? `EVA to ${first}` : `${first} + ${goals.length - 1} more`;
}

/** El nombre lo puso la app (no el usuario): al cambiar los objetivos conviene recalcularlo. */
export function isSuggestedTitle(title: string): boolean {
  return title === 'New outing' || /^EVA to .+/.test(title) || / \+ \d+ more$/.test(title);
}
