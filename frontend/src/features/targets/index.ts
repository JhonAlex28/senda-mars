// API pública de la feature: otras partes de la app solo importan desde aquí
export { GoalList } from './components/GoalList';
export { TargetCard } from './components/TargetCard';
export { useTargets } from './hooks/useTargets';
export { SCIENCE_TYPES, scienceType, type ScienceType } from './lib/scienceType';
export { stars } from './lib/stars';
export type { Rubric, ScienceTask, Target } from './types';
