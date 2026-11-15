import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { LAYERS, type LayerId } from '../catalog';

export interface LayerView {
  visible: boolean;
  opacity: number;
}

type LayersState = Record<LayerId, LayerView>;
type LayersAction = { type: 'toggle'; id: LayerId } | { type: 'opacity'; id: LayerId; opacity: number };

const initial = Object.fromEntries(
  LAYERS.map((l) => [l.id, { visible: l.available && (l.defaultVisible ?? true), opacity: l.defaultOpacity }]),
) as LayersState;

function reducer(state: LayersState, action: LayersAction): LayersState {
  const current = state[action.id];
  if (action.type === 'toggle') return { ...state, [action.id]: { ...current, visible: !current.visible } };
  return { ...state, [action.id]: { ...current, opacity: action.opacity } };
}

interface LayersValue {
  layers: LayersState;
  /** Visible y con datos. */
  shown: (id: LayerId) => boolean;
  toggle: (id: LayerId) => void;
  setOpacity: (id: LayerId, opacity: number) => void;
}

const LayersContext = createContext<LayersValue | null>(null);

/** Qué capas se ven y con qué opacidad. Lo comparten el panel y los mapas (Plan y Simulation). */
export function LayersProvider({ children }: { children: ReactNode }) {
  const [layers, dispatch] = useReducer(reducer, initial);
  const value = useMemo<LayersValue>(
    () => ({
      layers,
      // Una subcapa solo se ve si también se ve su capa padre
      shown: (id) => {
        const def = LAYERS.find((l) => l.id === id);
        return !!def?.available && layers[id].visible && (!def.parent || layers[def.parent].visible);
      },
      toggle: (id) => dispatch({ type: 'toggle', id }),
      setOpacity: (id, opacity) => dispatch({ type: 'opacity', id, opacity }),
    }),
    [layers],
  );
  return <LayersContext.Provider value={value}>{children}</LayersContext.Provider>;
}

export function useLayers(): LayersValue {
  const ctx = useContext(LayersContext);
  if (!ctx) throw new Error('useLayers must be used inside <LayersProvider>');
  return ctx;
}
