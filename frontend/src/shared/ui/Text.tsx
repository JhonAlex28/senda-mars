import type { ReactNode } from 'react';

/*
 * Ayudas para convivir con el traductor del navegador.
 *
 * - <Live>: números y datos que cambian en vivo (reloj, distancias, %). Se marcan
 *   translate="no": el traductor no los toca y React los puede seguir actualizando.
 * - <Phrase>: frase traducible que cambia según el estado ("Pause" ↔ "Resume").
 *   La `key` hace que React cree un nodo nuevo al cambiar, y el traductor lo vuelve
 *   a traducir (si solo cambiara el texto, se quedaría la traducción vieja).
 */

export function Live({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span translate="no" className={className}>
      {children}
    </span>
  );
}

export function Phrase({ children, className }: { children: string; className?: string }) {
  return (
    <span key={children} className={className}>
      {children}
    </span>
  );
}

/** Clave estable a partir de un contenido de texto simple (o undefined si no lo es). */
export function textKey(node: ReactNode): string | undefined {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node) && node.every((n) => typeof n === 'string' || typeof n === 'number')) return node.join('');
  return undefined;
}
