import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { stars } from '../lib/stars';
import type { Target } from '../types';

interface TargetCardProps {
  target: Target;
  priority: number | null; // posición en "My goals" (1 = primero) o null si no está elegido
  onToggle: () => void;
  onClose: () => void;
}

/** Ficha de un objetivo: lo esencial a la vista (qué es, cuánto vale, cuánto tarda); el detalle, a un clic. */
export function TargetCard({ target, priority, onToggle, onClose }: TargetCardProps) {
  const [open, setOpen] = useState(false);
  const { rubric, task } = target;
  const scores = [
    { icon: 'auto_awesome', label: 'Novelty', value: rubric.novelty },
    { icon: 'water_drop', label: 'Signs of life', value: rubric.habitability },
    { icon: 'person', label: 'Needs a human', value: rubric.human_only },
  ];

  return (
    <article className="flex w-72 animate-fade-up flex-col gap-sm rounded-lg border border-outline bg-surface-container/95 p-md shadow-2xl backdrop-blur">
      <header className="flex items-start gap-sm">
        <div className="min-w-0 flex-1">
          <h3 className="font-headline text-title-md text-on-surface">{target.name}</h3>
          <p className="flex items-center gap-xs font-body text-body-sm text-on-surface-variant">
            <span translate="no" className="text-accent" aria-label={`Science value ${rubric.total} of 15`}>
              {stars(rubric)}
            </span>
            <span className="truncate">{target.category}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-xs text-on-surface-variant hover:text-on-surface">
          <Icon name="close" className="text-[18px]" />
        </button>
      </header>

      <ul className="flex flex-col gap-xs">
        {scores.map(({ icon, label, value }) => (
          <li key={label} className="flex items-center gap-sm font-body text-body-sm" title={`${label}: ${value}/5`}>
            <Icon name={icon} className="shrink-0 text-[16px] text-accent" />
            <span className="min-w-0 flex-1 truncate text-on-surface-variant">{label}</span>
            <span className="flex shrink-0 gap-[3px]" aria-label={`${value} of 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-2 w-4 rounded-full ${n <= value ? 'bg-accent' : 'bg-surface-container-high'}`} />
              ))}
            </span>
          </li>
        ))}
      </ul>

      {task && (
        <div className="flex items-center gap-xs rounded-md bg-surface px-sm py-xs font-body text-body-sm text-on-surface">
          <Icon name="science" className="shrink-0 text-[16px] text-accent" />
          <span className="min-w-0 flex-1 truncate">{task.tool}</span>
          <Live className="shrink-0 font-mono text-mono-sm text-on-surface-variant">{task.duration_min} min</Live>
        </div>
      )}

      {open && (
        <div className="flex animate-fade-up flex-col gap-xs border-t border-outline-variant pt-sm font-body text-body-sm text-on-surface-variant">
          <p>{target.description}</p>
          {task && <p className="text-on-surface">{task.protocol}</p>}
        </div>
      )}

      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-xs font-label text-label-sm uppercase text-on-surface-variant hover:text-on-surface"
        >
          <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          <span key={String(open)}>{open ? 'Less' : 'Details'}</span>
        </button>
        {priority ? (
          <Button variant="ghost" size="sm" icon="remove" className="ml-auto" onClick={onToggle}>
            Remove #{priority}
          </Button>
        ) : (
          <Button size="sm" icon="add" className="ml-auto" onClick={onToggle}>
            Add goal
          </Button>
        )}
      </div>
    </article>
  );
}
