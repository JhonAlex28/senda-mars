import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { stars } from '../lib/stars';
import type { Target } from '../types';

interface GoalListProps {
  goals: Target[];
  focusedId: string | null;
  disabled?: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onFocus: (id: string) => void;
}

/** Objetivos elegidos, ordenables arrastrando (o con las flechas, desde el teclado). */
export function GoalList({ goals, focusedId, disabled = false, onMove, onRemove, onFocus }: GoalListProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  if (goals.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-outline px-sm py-md text-center font-body text-body-sm text-on-surface-variant">
        <Icon name="touch_app" className="mb-xs block text-[22px] text-accent mx-auto" />
        Tap a rock on the map
      </p>
    );
  }

  const drop = (to: number) => {
    if (dragging !== null && dragging !== to) onMove(dragging, to);
    setDragging(null);
    setOver(null);
  };

  return (
    <ol className="flex flex-col gap-xs">
      {goals.map((t, i) => (
        <li
          key={t.id}
          draggable={!disabled}
          onDragStart={() => setDragging(i)}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(i);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={() => drop(i)}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          className={`group flex items-center justify-between gap-xs rounded-md border bg-surface px-sm py-xs transition-colors ${
            disabled ? '' : 'cursor-grab active:cursor-grabbing'
          } ${over === i && dragging !== i ? 'border-accent' : 'border-outline'} ${dragging === i ? 'opacity-40' : ''} ${
            focusedId === t.id ? 'ring-1 ring-accent' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => onFocus(t.id)}
            className="flex min-w-0 items-center gap-sm text-left font-body text-body-sm text-on-surface"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-headline text-label-sm ${
                i === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
              }`}
            >
              {i + 1}
            </span>
            <span className="truncate" title={t.name}>
              {t.name}
            </span>
          </button>
          <span className="flex shrink-0 items-center gap-xs">
            <span className="text-body-sm text-accent">{stars(t.rubric)}</span>
            {!disabled && (
              <span className="flex items-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Move ${t.name} up`}
                  disabled={i === 0}
                  onClick={() => onMove(i, i - 1)}
                  className="text-on-surface-variant hover:text-accent disabled:opacity-20"
                >
                  <Icon name="arrow_upward" className="text-[16px]" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => onRemove(t.id)}
                  className="text-on-surface-variant hover:text-error"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
