import type { Target } from '@/features/targets';
import { formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Meter } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import type { TaskProgress } from '../state/simulationReducer';

interface ScienceTaskCardProps {
  target: Target | undefined;
  targetId: string;
  task: TaskProgress | null;
  onBegin: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

/** Tarjeta sobre el mapa al llegar a un objetivo: iniciar, seguir y completar la tarea científica. */
export function ScienceTaskCard({ target, targetId, task, onBegin, onComplete, onSkip }: ScienceTaskCardProps) {
  const done = !!task && task.doneMin >= task.durationMin;
  const pct = task ? (task.doneMin / task.durationMin) * 100 : 0;

  return (
    <article className="w-[min(420px,calc(100%-2rem))] animate-fade-up rounded-lg border-2 border-accent/70 bg-surface-container/95 p-md shadow-2xl backdrop-blur" aria-live="polite">
      <header className="mb-sm flex items-center gap-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
          <Icon name={done ? 'task_alt' : 'science'} className="text-[24px]" />
        </div>
        <div className="min-w-0">
          <p className="font-label text-label-sm uppercase text-accent">
            You arrived at <Live>{targetId}</Live>
          </p>
          <h3 className="break-words font-headline text-headline-sm">{target?.name ?? targetId}</h3>
        </div>
      </header>

      {target?.task && (
        <div className="mb-sm rounded-md border border-outline-variant bg-surface p-sm">
          <p className="font-body text-body-sm text-on-surface">{target.task.protocol}</p>
          <p className="mt-xs font-body text-body-sm text-on-surface-variant">
            Tool: {target.task.tool}. Time needed: <Live>{formatMinutes(target.task.duration_min)}</Live>.
          </p>
        </div>
      )}

      {task && (
        <div className="mb-sm flex flex-col gap-xs">
          <Meter value={pct} tone={done ? 'success' : 'accent'} label="Task progress" className="h-2" />
          <p className="font-body text-body-sm text-on-surface-variant">
            {done ? (
              <Phrase>The samples are ready. You can finish the task.</Phrase>
            ) : (
              <span>
                Working on the task. Time left: <Live className="font-mono text-mono-sm">{formatMinutes(task.durationMin - task.doneMin)}</Live>
              </span>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-sm">
        {!task && (
          <>
            <Button icon="play_arrow" className="flex-1" onClick={onBegin}>
              Begin science task
            </Button>
            <Button variant="ghost" icon="skip_next" onClick={onSkip}>
              Skip
            </Button>
          </>
        )}
        {task && (
          <Button icon="check" className="flex-1" disabled={!done} onClick={onComplete}>
            Complete task
          </Button>
        )}
      </div>
    </article>
  );
}
