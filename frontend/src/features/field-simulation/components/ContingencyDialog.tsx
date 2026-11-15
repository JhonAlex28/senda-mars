import type { TravelMode } from '@/features/route-planning';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { CONTINGENCIES, type ContingencyKind } from '../hooks/useSimulation';

interface ContingencyDialogProps {
  mode: TravelMode;
  onPick: (kind: ContingencyKind) => void;
  onClose: () => void;
}

/** Elegir la situación simulada; la app recalcula la ruta y los recursos. */
export function ContingencyDialog({ mode, onPick, onClose }: ContingencyDialogProps) {
  const options = (Object.keys(CONTINGENCIES) as ContingencyKind[]).filter((k) => mode === 'eva' || !CONTINGENCIES[k].evaOnly);
  return (
    <Dialog title="Contingency" icon="warning" onClose={onClose}>
      <div className="flex flex-col gap-sm">
        {options.map((kind) => {
          const c = CONTINGENCIES[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onPick(kind)}
              className="flex min-h-[56px] items-center gap-sm rounded-lg border border-outline bg-surface p-sm text-left transition-colors hover:border-warning"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <Icon name={c.icon} className="text-[24px]" />
              </div>
              <div>
                <span className="block font-headline text-title-md">{c.title}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
