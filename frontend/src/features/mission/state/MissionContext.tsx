import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { useTargets, type Target } from '@/features/targets';
import { initialMissionState, missionReducer } from './missionReducer';
import type { MissionAction, MissionState } from './types';

interface MissionContextValue {
  state: MissionState;
  dispatch: Dispatch<MissionAction>;
  targets: Target[];
  targetById: Map<string, Target>;
  targetsError: Error | null;
}

const MissionContext = createContext<MissionContextValue | null>(null);

/** Estado de la misión + catálogo de objetivos, compartidos por todas las pantallas. */
export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(missionReducer, initialMissionState);
  const { data, error } = useTargets();
  const targets = useMemo(() => data ?? [], [data]);
  const targetById = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);

  // La base parte de la del catálogo; el usuario puede moverla (Change o herramienta "Move base")
  useEffect(() => {
    const base = targets.find((t) => t.is_base);
    if (base) dispatch({ type: 'initBase', point: { lon: base.lon, lat: base.lat } });
  }, [targets]);

  const value = useMemo(
    () => ({ state, dispatch, targets, targetById, targetsError: error }),
    [state, targets, targetById, error],
  );
  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission must be used inside <MissionProvider>');
  return ctx;
}
