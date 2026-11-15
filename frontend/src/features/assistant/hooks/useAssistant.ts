import { useEffect, useState } from 'react';
import { selectedEva, selectedTraverse, useMission } from '@/features/mission';
import { usePlanActions } from '@/features/mission-log';
import type { EvaPlan, MissionState } from '@/features/mission';
import type { RoutePlan } from '@/features/route-planning';
import { ApiError } from '@/shared/api/httpClient';
import { assistantApi } from '../api/assistantApi';
import type { Availability, ChatMessage, ChatReply, LegSummary, Outing, PlanSummary, ViewChange } from '../types';

const HISTORY_LIMIT = 20;

/** Resultado de las acciones del calendario que el copiloto pidió (guardar / abrir). */
export interface CalendarResult {
  ok: boolean;
  text: string;
}

export interface Exchange {
  order: string;
  reply: ChatReply;
  calendar?: CalendarResult;
}

/**
 * Envía órdenes al asistente y aplica en pantalla lo que devuelve.
 * El plan llega ya calculado por el backend: aquí solo se despacha al estado de la misión,
 * con las mismas acciones que usaría la interfaz. Nada se recalcula ni se inventa.
 */
export function useAssistant() {
  const { state, dispatch, targetById } = useMission();
  const plans = usePlanActions();
  const [availability, setAvailability] = useState<Availability>('checking');
  const [model, setModel] = useState<string | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // disabled: el servidor no tiene el asistente activado (p. ej. el despliegue en la nube);
  // offline: activado, pero el modelo local (Ollama) no responde; no-backend: sin servidor
  const checkStatus = () => {
    setAvailability('checking');
    assistantApi
      .status()
      .then((s) => {
        setModel(s.model);
        setAvailability(!s.enabled ? 'disabled' : s.reachable ? 'ready' : 'offline');
      })
      .catch((e) => setAvailability(e instanceof ApiError && e.status === 404 ? 'disabled' : 'no-backend'));
  };
  useEffect(checkStatus, []);

  const apply = (outing: Outing | null, view: ViewChange | null) => {
    if (outing?.planned && outing.traverse) {
      const evaPlans: Record<string, EvaPlan> = Object.fromEntries(
        Object.entries(outing.evas).map(([id, routes]) => [id, { routes, profile: outing.eva_profiles[id] ?? 'safe' }]),
      );
      dispatch({
        type: 'planLoaded',
        goals: outing.target_ids,
        hazards: outing.hazards,
        traverse: outing.traverse,
        traverseProfile: outing.traverse_profile ?? 'safe',
        evaPlans,
      });
    }
    if (view) dispatch({ type: 'viewChanged', profile: view.profile ?? undefined, phase: view.screen ?? undefined });
  };

  // Guardar / abrir: el copiloto lo pide y la pantalla lo hace con el plan completo que dibuja
  const runCalendar = async (reply: ChatReply): Promise<CalendarResult | undefined> => {
    try {
      if (reply.open_plan_id) {
        const plan = await plans.open(reply.open_plan_id);
        return { ok: true, text: `Opened “${plan.title}” (Sol ${plan.sol})` };
      }
      if (reply.save) {
        const outing = reply.outing?.planned ? reply.outing : null;
        const goals = outing?.target_ids ?? state.goals;
        const title = reply.save.title ?? defaultTitle(goals, targetById);
        // Un plan para otro día no pisa el que está abierto: se guarda como nuevo
        const asNew = !!outing || !state.activePlan || state.activePlan.sol !== reply.save.sol;
        const saved = await plans.save({
          day: reply.save.sol,
          title,
          asNew,
          ...(outing ? { payload: outingPayload(outing), summary: { targets: outing.target_ids, total_duration_min: outing.total_duration_min } } : {}),
        });
        return { ok: true, text: `Saved “${saved.title}” for Sol ${saved.sol}` };
      }
    } catch (e) {
      return { ok: false, text: e instanceof Error ? e.message : 'The calendar action failed.' };
    }
    return undefined;
  };

  // Si el copiloto trae un plan nuevo y el de pantalla tiene rutas pero no se guardó, se guarda
  // para hoy antes de reemplazarlo: así el plan de hoy no se pierde al preparar el de mañana
  const keepUnsavedPlan = async (reply: ChatReply): Promise<CalendarResult | undefined> => {
    const replaces = !!reply.outing?.planned || !!reply.open_plan_id;
    if (!replaces || !state.traverse || state.activePlan) return undefined;
    try {
      const saved = await plans.save({ day: 'today', title: defaultTitle(state.goals, targetById), asNew: true });
      return { ok: true, text: `Kept your previous plan as “${saved.title}” (Sol ${saved.sol})` };
    } catch {
      return { ok: false, text: 'Your previous plan could not be kept in the calendar.' };
    }
  };

  const outingPayload = (o: Outing) => ({
    base: state.base,
    goals: o.target_ids,
    hazards: o.hazards,
    traverse: o.traverse,
    traverseProfile: o.traverse_profile ?? 'safe',
    evaPlans: Object.fromEntries(
      Object.entries(o.evas).map(([id, routes]) => [id, { routes, profile: o.eva_profiles[id] ?? 'safe' }]),
    ),
    vehicleId: state.vehicleId,
  });

  const send = async (order: string) => {
    const text = order.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const messages: ChatMessage[] = [
      ...history.flatMap((x): ChatMessage[] => [
        { role: 'user', content: x.order },
        { role: 'assistant', content: x.reply.reply || '(done)' },
      ]),
      { role: 'user' as const, content: text },
    ].slice(-HISTORY_LIMIT);
    try {
      const reply = await assistantApi.chat(messages, {
        base: state.base,
        goals: state.goals.filter((g) => !state.waypoints.some((w) => w.id === g)),
        hazards: state.hazards,
        has_plan: !!state.traverse,
        screen: state.phase,
        plan: planSummary(state),
      });
      const kept = await keepUnsavedPlan(reply);
      apply(reply.outing, reply.view);
      const done = await runCalendar(reply);
      const calendar: CalendarResult | undefined =
        kept && done ? { ok: kept.ok && done.ok, text: `${kept.text}. ${done.text}` } : (done ?? kept);
      setHistory((h) => [...h, { order: text, reply, calendar }]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        // El modelo dejó de responder: se muestra el aviso en lugar de un error técnico
        setAvailability(e.message.includes('not configured') ? 'disabled' : 'offline');
      } else {
        setError(e instanceof Error ? e.message : 'The assistant did not answer.');
      }
    } finally {
      setBusy(false);
    }
  };

  return {
    availability,
    model,
    retry: checkStatus,
    history,
    busy,
    error,
    send,
    clear: () => setHistory([]),
    dismissError: () => setError(null),
  };
}

function leg(r: RoutePlan): LegSummary {
  return {
    profile: r.profile,
    duration_min: r.duration_min,
    distance_m: r.distance_m,
    safety_pct: r.safety_pct,
    resource_left_pct: r.resource.remaining_pct,
    return_ok: r.return_ok,
  };
}

/** Lo que hay en pantalla, con las cifras que ya calculó el planificador (nada se recalcula). */
function planSummary(state: MissionState): PlanSummary | null {
  if (!state.traverse) return null;
  const rover = selectedTraverse(state);
  return {
    rover: rover ? leg(rover) : null,
    spacewalks: state.traverse.parkings.flatMap((p) => {
      const walk = selectedEva(state, p.id);
      return walk ? [{ ...leg(walk), parking: p.id, targets: p.target_ids }] : [];
    }),
    parkings_without_spacewalk: state.traverse.parkings.filter((p) => !state.evaPlans[p.id]).map((p) => p.id),
  };
}

function defaultTitle(goals: string[], names: Map<string, { name: string }>): string {
  if (goals.length === 0) return 'Outing';
  const first = names.get(goals[0])?.name.split(' (')[0] ?? goals[0];
  return goals.length === 1 ? `EVA to ${first}` : `${first} + ${goals.length - 1} more`;
}
