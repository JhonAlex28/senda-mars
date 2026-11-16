import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './Icon';

/**
 * Avisos emergentes (arriba a la derecha) que se cierran solos. Cualquier parte de la app llama a
 * `toast(...)`; `<Toaster />` se monta una sola vez en App. Pasar el ratón por encima pausa el
 * cierre, para que dé tiempo a leerlo.
 */
export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  icon?: string;
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastInput, 'description' | 'icon'>> {
  id: number;
  description?: string;
  icon?: string;
}

const MAX_VISIBLE = 3;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast({ tone = 'success', durationMs = 5000, ...rest }: ToastInput): number {
  const id = nextId++;
  items = [...items, { id, tone, durationMs, ...rest }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const TONE: Record<ToastTone, { icon: string; color: string; border: string; bar: string }> = {
  success: { icon: 'check_circle', color: 'text-success', border: 'border-success/50', bar: 'bg-success' },
  info: { icon: 'info', color: 'text-accent', border: 'border-accent/50', bar: 'bg-accent' },
  warning: { icon: 'warning', color: 'text-warning', border: 'border-warning/50', bar: 'bg-warning' },
  error: { icon: 'error', color: 'text-error', border: 'border-error/60', bar: 'bg-error' },
};

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-md top-md z-[60] flex w-[min(380px,calc(100%-2rem))] flex-col gap-sm"
    >
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(item.durationMs);
  const tone = TONE[item.tone];

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const id = window.setTimeout(() => dismissToast(item.id), remaining);
    return () => {
      window.clearTimeout(id);
      setRemaining((r) => Math.max(0, r - (Date.now() - started)));
    };
  }, [paused, item.id]); // eslint-disable-line react-hooks/exhaustive-deps -- remaining se lee al reanudar

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto relative flex animate-toast-in items-start gap-sm overflow-hidden rounded-lg border bg-surface-container-high/95 py-sm pl-md pr-xs shadow-2xl backdrop-blur ${tone.border}`}
    >
      <Icon name={item.icon ?? tone.icon} filled className={`mt-[1px] text-[22px] ${tone.color}`} />
      <div className="min-w-0 flex-1 pb-xs">
        <p className="font-headline text-title-md text-on-surface">{item.title}</p>
        {item.description && <p className="mt-[2px] font-body text-body-sm text-on-surface-variant">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss notification"
        className="rounded-full p-xs text-on-surface-variant transition-colors duration-fast hover:bg-surface hover:text-on-surface"
      >
        <Icon name="close" className="text-[18px]" />
      </button>
      {/* Barra de tiempo: muestra cuánto falta para que se cierre */}
      <span
        aria-hidden="true"
        className={`absolute bottom-0 left-0 h-[3px] w-full origin-left opacity-70 ${tone.bar}`}
        style={{
          animation: `toast-timer ${item.durationMs}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </div>
  );
}
