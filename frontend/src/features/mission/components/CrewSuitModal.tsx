import { useState } from 'react';
import { useMission } from '../state/MissionContext';
import type { CrewConfig } from '../state/types';

interface CrewSuitModalProps {
  open: boolean;
  onClose: () => void;
}

/** Crew config (durante la planificación): solo los parámetros de la tripulación. */
export function CrewSuitModal({ open, onClose }: CrewSuitModalProps) {
  const { state, dispatch } = useMission();
  const [draft, setDraft] = useState<CrewConfig>(() => state.crew);

  if (!open) return null;

  const updateMember = (idx: 0 | 1, patch: Partial<CrewConfig['members'][0]>) => {
    const next: CrewConfig['members'] = [...draft.members] as CrewConfig['members'];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, members: next });
  };

  const save = () => {
    dispatch({ type: 'setCrew', crew: draft });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-md backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Crew config"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-outline bg-surface-container p-lg shadow-2xl">
        <div className="mb-md flex items-start justify-between gap-md border-b border-outline-variant pb-sm">
          <div>
            <h2 className="font-headline text-headline-md text-on-surface">Crew config</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface hover:border-accent hover:text-accent"
          >
            ✕
          </button>
        </div>

        <label className="mb-md flex flex-col gap-1">
          <span className="font-mono text-mono-sm uppercase text-on-surface-variant">Callsign</span>
          <input
            type="text"
            value={draft.teamName}
            onChange={(e) => setDraft({ ...draft, teamName: e.target.value })}
            className="rounded border border-outline bg-surface px-sm py-xs font-headline text-title-md uppercase text-on-surface focus:border-accent focus:outline-none"
          />
        </label>

        <div className="grid gap-md md:grid-cols-2">
          {([0, 1] as const).map((idx) => {
            const m = draft.members[idx];
            return (
              <div key={m.id} className="flex flex-col gap-sm rounded-md border border-outline bg-surface p-sm">
                <div className="flex items-center justify-between font-mono text-mono-sm">
                  <span className="font-bold text-accent">{m.id}</span>
                  <span className="text-on-surface-variant">{m.suitId}</span>
                </div>

                <div className="grid grid-cols-2 gap-xs font-mono text-mono-sm">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-on-surface-variant">NAME</span>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMember(idx, { name: e.target.value.toUpperCase() })}
                      className="rounded border border-outline bg-surface-container min-h-[44px] px-xs py-1 text-on-surface focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-on-surface-variant">ROLE</span>
                    <input
                      type="text"
                      value={m.role}
                      onChange={(e) => updateMember(idx, { role: e.target.value.toUpperCase() })}
                      className="rounded border border-outline bg-surface-container min-h-[44px] px-xs py-1 text-on-surface focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-on-surface-variant">SUIT ID</span>
                    <input
                      type="text"
                      value={m.suitId}
                      onChange={(e) => updateMember(idx, { suitId: e.target.value })}
                      className="rounded border border-outline bg-surface-container min-h-[44px] px-xs py-1 text-on-surface focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-on-surface-variant">RESTING HR</span>
                    <input
                      type="number"
                      min={45}
                      max={110}
                      value={m.restingBpm}
                      onChange={(e) => updateMember(idx, { restingBpm: Number(e.target.value) || 68 })}
                      className="rounded border border-outline bg-surface-container min-h-[44px] px-xs py-1 text-on-surface focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-on-surface-variant">MASS (KG)</span>
                    <input
                      type="number"
                      min={40}
                      max={130}
                      value={m.massKg}
                      onChange={(e) => updateMember(idx, { massKg: Number(e.target.value) || 75 })}
                      className="rounded border border-outline bg-surface-container min-h-[44px] px-xs py-1 text-on-surface focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-md flex justify-end gap-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface-variant hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded bg-primary px-lg py-xs font-headline text-title-md font-bold text-on-primary hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
