import type { Target } from '../types';

/** Tipo de valor científico de un objetivo, para elegir su icono en el mapa. */
export type ScienceType = 'water' | 'mineral' | 'drill' | 'geology';

export const SCIENCE_TYPES: Record<ScienceType, { label: string; icon: string; color: string }> = {
  water: { label: 'Water', icon: 'water_drop', color: '#38BDF8' },
  mineral: { label: 'Minerals', icon: 'diamond', color: '#A78BFA' },
  drill: { label: 'Drill sample', icon: 'colorize', color: '#F59E0B' },
  geology: { label: 'Geology', icon: 'landscape', color: '#F97316' },
};

const RULES: [ScienceType, RegExp][] = [
  ['drill', /drill/i],
  ['water', /lake|stream|water|isru|habitab/i],
  ['mineral', /sulfat|sulfur|hematite|clay|potassium|vein|mineral/i],
];

/** Clasifica por palabras clave del tipo (`category`, el type_en del catálogo). */
export function scienceType(target: Pick<Target, 'category'>): ScienceType {
  return RULES.find(([, re]) => re.test(target.category))?.[0] ?? 'geology';
}
