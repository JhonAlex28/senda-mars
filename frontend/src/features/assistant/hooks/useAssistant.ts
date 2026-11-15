import { useEffect, useState } from 'react';
import { useMission } from '@/features/mission';
import type { EvaPlan } from '@/features/mission';
import { ApiError } from '@/shared/api/httpClient';
import { assistantApi } from '../api/assistantApi';
import type { Availability, ChatMessage, ChatReply, Outing, ViewChange } from '../types';

const HISTORY_LIMIT = 20;

export interface Exchange {
  order: string;
  reply: ChatReply;
}

/**
 * Envía órdenes al asistente y aplica en pantalla lo que devuelve.
 * El plan llega ya calculado por el backend: aquí solo se despacha al estado de la misión,
 * con las mismas acciones que usaría la interfaz. Nada se recalcula ni se inventa.
 */
export function useAssistant() {
  const { state, dispatch } = useMission();
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
      });
      apply(reply.outing, reply.view);
      setHistory((h) => [...h, { order: text, reply }]);
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
