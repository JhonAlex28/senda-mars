import { useEffect, useRef, useState } from 'react';
import { useMission } from '@/features/mission';
import { Icon } from '@/shared/ui/Icon';

/** Quién está planificando en este equipo (los planes y procedimientos quedan a su nombre). */
export function CrewSwitcher() {
  const { state, dispatch } = useMission();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const me = state.crew.members.find((m) => m.id === state.profileId) ?? state.crew.members[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Who is planning"
        className="inline-flex h-11 items-center gap-xs rounded-lg border border-outline bg-surface pl-[5px] pr-sm font-headline text-title-md uppercase text-on-surface transition-colors duration-fast hover:border-accent hover:text-accent"
      >
        <Avatar name={me.name} />
        <span className="max-w-[120px] truncate">{me.name}</span>
        <Icon name="expand_more" className="text-[18px] text-on-surface-variant" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Crew member" className="absolute right-0 z-50 mt-xs w-56 rounded-lg border border-outline bg-surface-container p-xs shadow-2xl">
          <li className="px-xs pb-xs font-label text-label-sm uppercase text-on-surface-variant">{state.crew.teamName}</li>
          {state.crew.members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={m.id === me.id}
                onClick={() => {
                  dispatch({ type: 'setProfile', id: m.id });
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-sm rounded-md px-xs py-xs text-left hover:bg-accent/10 ${m.id === me.id ? 'bg-accent/10' : ''}`}
              >
                <Avatar name={m.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-body-md text-on-surface">{m.name}</span>
                  <span className="font-mono text-mono-sm text-on-surface-variant">{m.id} · {m.role}</span>
                </span>
                {m.id === me.id && <Icon name="check" className="text-[18px] text-accent" />}
              </button>
            </li>
          ))}
          <li className="px-xs pt-xs font-body text-[11px] text-on-surface-variant">Edit names in Crew.</li>
        </ul>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-label text-label-sm text-on-primary">
      {initials}
    </span>
  );
}
