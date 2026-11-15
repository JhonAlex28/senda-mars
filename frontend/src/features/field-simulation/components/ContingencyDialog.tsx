import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { CONTINGENCIES, type ContingencyKind } from '../hooks/useSimulation';

interface ContingencyDialogProps {
  /** Opciones válidas para el tramo actual (EVA o vehículo) que ofrece el motor de seguridad. */
  options: ContingencyKind[];
  onPick: (kind: ContingencyKind) => void;
  onClose: () => void;
}

/** Elegir la situación; en EVA la evalúa el motor de seguridad (/simulate) y se replanifica. */
export function ContingencyDialog({ options, onPick, onClose }: ContingencyDialogProps) {
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
                <span className="font-body text-body-sm text-on-surface-variant">{c.text}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
