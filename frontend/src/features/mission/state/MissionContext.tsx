import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { useTargets, type Target } from '@/features/targets';
import { initialMissionState, missionReducer } from './missionReducer';
import type { MissionAction, MissionState } from './types';

export interface ProcedureRecord {
  missionId: string;
  targetId: string;
  completedAt: string;
}

interface ProcedureHistory {
  records: ProcedureRecord[];
  error: string | null;
  shouldPersist: boolean;
}

const HISTORY_KEY = 'senda-procedure-history';

// Conectar aquí la API de historial y reemplazar localStorage por lectura y escritura en la base de datos.
function isProcedureRecord(value: unknown): value is ProcedureRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.missionId === 'string' &&
    typeof record.targetId === 'string' &&
    typeof record.completedAt === 'string' &&
    Number.isFinite(Date.parse(record.completedAt))
  );
}

function readProcedureHistory(): ProcedureHistory {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return { records: [], error: null, shouldPersist: true };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isProcedureRecord)) {
      return { records: [], error: 'Saved procedure history has an invalid format.', shouldPersist: false };
    }
    return { records: parsed, error: null, shouldPersist: true };
  } catch (error) {
    return {
      records: [],
      error: `Procedure history could not be loaded: ${error instanceof Error ? error.message : 'storage is unavailable.'}`,
      shouldPersist: false,
    };
  }
}

interface MissionContextValue {
  state: MissionState;
  dispatch: Dispatch<MissionAction>;
  targets: Target[];
  targetById: Map<string, Target>;
  targetsError: Error | null;
  procedureHistory: ProcedureRecord[];
  procedureHistoryError: string | null;
  addProcedureRecord: (targetId: string) => void;
}

const MissionContext = createContext<MissionContextValue | null>(null);

/** Estado de la misión + catálogo de objetivos, compartidos por todas las pantallas. */
export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(missionReducer, initialMissionState);
  const [history, setHistory] = useState(readProcedureHistory);
  const { data, error } = useTargets();
  const targets = useMemo(() => data ?? [], [data]);
  const targetById = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);

  const addProcedureRecord = useCallback((targetId: string) => {
    setHistory((current) => ({
      ...current,
      records: [...current.records, { missionId: state.missionId, targetId, completedAt: new Date().toISOString() }],
      shouldPersist: true,
    }));
  }, [state.missionId]);

  useEffect(() => {
    if (!history.shouldPersist) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.records));
      if (history.error) setHistory((current) => ({ ...current, error: null }));
    } catch (error) {
      setHistory((current) => ({
        ...current,
        error: `Procedure history could not be saved: ${error instanceof Error ? error.message : 'storage is unavailable.'}`,
        shouldPersist: false,
      }));
    }
  }, [history]);

  // La base parte de la del catálogo; el usuario puede moverla (Change o herramienta "Move base")
  useEffect(() => {
    const base = targets.find((t) => t.is_base);
    if (base) dispatch({ type: 'initBase', point: { lon: base.lon, lat: base.lat } });
  }, [targets]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      targets,
      targetById,
      targetsError: error,
      procedureHistory: history.records,
      procedureHistoryError: history.error,
      addProcedureRecord,
    }),
    [state, targets, targetById, error, history, addProcedureRecord],
  );
  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission must be used inside <MissionProvider>');
  return ctx;
}
