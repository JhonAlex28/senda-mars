import type { Rubric } from '../types';

/** Valor científico (rúbrica sobre 15) en 1–3 estrellas, fácil de leer de un vistazo. */
export function starCount(rubric: Rubric): 1 | 2 | 3 {
  if (rubric.total >= 13) return 3;
  return rubric.total >= 11 ? 2 : 1;
}

export function stars(rubric: Rubric): string {
  return '★'.repeat(starCount(rubric));
}
