import { useEffect, useState } from 'react';
import { useMission } from '@/features/mission';
import type { EvaPlan } from '@/features/mission';
import { assistantApi } from '../api/assistantApi';
import type { ChatMessage, ChatReply, Outing, ViewChange } from '../types';

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
  const [enabled, setEnabled] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    assistantApi
      .status()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
  }, []);

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
        goals: state.goals,
        hazards: state.hazards,
        has_plan: !!state.traverse,
      });
      apply(reply.outing, reply.view);
      setHistory((h) => [...h, { order: text, reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant did not answer.');
    } finally {
      setBusy(false);
    }
  };

  return { enabled, history, busy, error, send, clear: () => setHistory([]), dismissError: () => setError(null) };
}
