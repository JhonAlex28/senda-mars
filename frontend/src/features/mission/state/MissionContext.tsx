import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { useTargets, type Target } from '@/features/targets';
import { missionLogApi, type CrewDto, type ProcedureDto } from '@/shared/api/missionLog';
import { initialMissionState, missionReducer } from './missionReducer';
import type { CrewConfig, CrewMember, MissionAction, MissionState } from './types';

export interface ProcedureRecord {
  missionId: string;
  targetId: string;
  completedAt: string;
  crewMember: string | null;
}

/** Tripulante que planifica en este equipo: preferencia local (no es un dato compartido). */
const PROFILE_KEY = 'senda-profile';

function readProfile(): string {
  try {
    return window.localStorage.getItem(PROFILE_KEY) ?? initialMissionState.profileId;
  } catch {
    return initialMissionState.profileId;
  }
}

function toRecord(p: ProcedureDto): ProcedureRecord {
  return { missionId: p.site_id, targetId: p.target_id, completedAt: p.completed_at, crewMember: p.crew_member };
}

/** La interfaz de tripulación usa dos tripulantes; la base de datos admite más. */
function toCrewConfig(dto: CrewDto, fallback: CrewConfig): CrewConfig {
  const members = dto.members.slice(0, 2).map(
    (m, i): CrewMember => ({
      id: (m.id === 'EVA-2' || i === 1 ? 'EVA-2' : 'EVA-1') as CrewMember['id'],
      name: m.name,
      role: m.role,
      suitId: m.suit_id,
      restingBpm: m.resting_bpm,
      massKg: m.mass_kg,
    }),
  );
  return {
    teamName: dto.team_name,
    members: [members[0] ?? fallback.members[0], members[1] ?? fallback.members[1]],
  };
}

export function toCrewDto(crew: CrewConfig): CrewDto {
  return {
    team_name: crew.teamName,
    members: crew.members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      suit_id: m.suitId,
      resting_bpm: m.restingBpm,
      mass_kg: m.massKg,
    })),
  };
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
  const [state, dispatch] = useReducer(missionReducer, initialMissionState, (s) => ({ ...s, profileId: readProfile() }));
  const [history, setHistory] = useState<ProcedureRecord[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const { data, error } = useTargets();
  const targets = useMemo(() => data ?? [], [data]);
  const targetById = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);

  // Registro de la misión desde la base de datos: procedimientos y tripulación
  useEffect(() => {
    missionLogApi
      .procedures()
      .then((rows) => setHistory(rows.map(toRecord)))
      .catch((e: unknown) => setHistoryError(`Procedure history could not be loaded: ${e instanceof Error ? e.message : 'server unavailable.'}`));
    missionLogApi
      .crew()
      .then((crew) => dispatch({ type: 'setCrew', crew: toCrewConfig(crew, initialMissionState.crew) }))
      .catch(() => undefined); // sin servidor se queda la tripulación por defecto
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_KEY, state.profileId);
    } catch {
      // almacenamiento no disponible: solo se pierde la preferencia
    }
  }, [state.profileId]);

  const addProcedureRecord = useCallback(
    (targetId: string) => {
      missionLogApi
        .recordProcedure({ site_id: state.missionId, target_id: targetId, crew_member: state.profileId, plan_id: state.activePlan?.id ?? null })
        .then((row) => {
          setHistory((current) => [...current, toRecord(row)]);
          setHistoryError(null);
        })
        .catch((e: unknown) => setHistoryError(`Procedure could not be saved: ${e instanceof Error ? e.message : 'server unavailable.'}`));
    },
    [state.missionId, state.profileId, state.activePlan],
  );

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
      procedureHistory: history,
      procedureHistoryError: historyError,
      addProcedureRecord,
    }),
    [state, targets, targetById, error, history, historyError, addProcedureRecord],
  );
  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission must be used inside <MissionProvider>');
  return ctx;
}
