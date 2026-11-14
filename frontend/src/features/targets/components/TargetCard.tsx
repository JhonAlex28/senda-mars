import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { stars } from '../lib/stars';
import type { Target } from '../types';

interface TargetCardProps {
  target: Target;
  priority: number | null; // posición en "My goals" (1 = primero) o null si no está elegido
  onToggle: () => void;
  onClose: () => void;
}

/** Ficha de un objetivo: qué es, por qué interesa y qué tarea se hará allí. */
export function TargetCard({ target, priority, onToggle, onClose }: TargetCardProps) {
  const { rubric, task } = target;
  return (
    <article className="flex w-80 animate-fade-up flex-col gap-sm rounded-lg border border-outline bg-surface-container/95 p-md shadow-2xl backdrop-blur">
      <header className="flex items-start justify-between gap-sm">
        <div>
          <p className="font-mono text-mono-sm text-accent">{target.id}</p>
          <h3 className="font-headline text-headline-sm text-on-surface">{target.name}</h3>
          <p className="font-body text-body-sm text-on-surface-variant">{target.category}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close target details"
          className="rounded-full p-xs text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
      </header>

      <p className="font-body text-body-sm text-on-surface">{target.description}</p>

      <dl className="grid grid-cols-3 gap-xs text-center">
        {[
          ['Novelty', rubric.novelty],
          ['Signs of life', rubric.habitability],
          ['Needs a human', rubric.human_only],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-outline-variant bg-surface-container-high/60 p-xs">
            <dt className="break-words font-label text-label-sm uppercase leading-tight text-on-surface-variant">{label}</dt>
            <dd translate="no" className="font-mono text-mono-md text-on-surface">{value}/5</dd>
          </div>
        ))}
      </dl>

      {task && (
        <div className="rounded-md border border-outline-variant bg-surface p-sm">
          <p className="flex items-center gap-xs font-label text-label-sm uppercase text-accent">
            <Icon name="science" className="text-[16px]" /> Planned task · {task.duration_min} min
          </p>
          <p className="mt-xs font-body text-body-sm text-on-surface">{task.protocol}</p>
          <p className="mt-xs font-mono text-mono-sm text-on-surface-variant">Tool: {task.tool}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-sm">
        <span className="text-body-md text-accent" aria-label={`Science value ${rubric.total} of 15`}>
          {stars(rubric)} <span className="font-mono text-mono-sm text-on-surface-variant">{rubric.total}/15</span>
        </span>
        {priority ? (
          <Button variant="ghost" size="sm" icon="remove" onClick={onToggle}>
            Remove goal #{priority}
          </Button>
        ) : (
          <Button size="sm" icon="add" onClick={onToggle}>
            Add to my goals
          </Button>
        )}
      </div>
    </article>
  );
}
