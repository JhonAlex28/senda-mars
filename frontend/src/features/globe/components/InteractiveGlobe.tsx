import { lazy, Suspense } from 'react';
import type { Site } from '../sites';
import { MarsGlobe } from './MarsGlobe';

// three.js pesa: se descarga solo cuando se muestra el globo, no en las pantallas de la misión
const MarsGlobe3D = lazy(() => import('./MarsGlobe3D').then((m) => ({ default: m.MarsGlobe3D })));

interface InteractiveGlobeProps {
  sites: Site[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Globo 3D giratorio; mientras carga (o si no hay WebGL) se ve el globo dibujado en SVG. */
export function InteractiveGlobe(props: InteractiveGlobeProps) {
  return (
    <Suspense fallback={<MarsGlobe />}>
      <MarsGlobe3D {...props} />
    </Suspense>
  );
}
