import { useEffect, useState, type FormEvent } from 'react';
import { useMission } from '@/features/mission';
import { ErrorNote } from '@/features/mission';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { useAssistant, type Exchange } from '../hooks/useAssistant';
import { useSpeech } from '../hooks/useSpeech';

const EXAMPLES = [
  'Prepara la salida de mañana, tengo 3 horas',
  'Hay una tormenta de polvo, replanifica',
  'Cambia a la ruta científica',
  'Inicia la simulación',
];

/**
 * Barra de órdenes: el usuario dice qué quiere y el asistente lo ejecuta en SENDA.
 * El plan aparece directamente en el mapa y en los paneles; aquí solo se ve el resumen.
 */
export function CommandBar() {
  const { enabled, history, busy, error, send, clear, dismissError } = useAssistant();
  const [text, setText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const speech = useSpeech((spoken) => {
    setText(spoken);
    void send(spoken).then(() => setText(''));
  });

  if (!enabled) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const order = text;
    setText('');
    void send(order);
  };
  const last = history[history.length - 1];

  return (
    <section className="flex flex-col gap-xs border-b border-outline-variant bg-surface px-xl py-sm" aria-label="SENDA assistant">
      <form onSubmit={submit} className="flex items-center gap-sm">
        <Icon name="auto_awesome" className="text-[22px] text-accent" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          placeholder="Tell SENDA what to do — e.g. “Plan tomorrow's outing, 3 hours, dust storm”"
          aria-label="Order for the SENDA assistant"
          className="min-w-0 flex-1 rounded-full border border-outline bg-surface px-lg py-xs font-body text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-accent focus:outline-none disabled:opacity-60"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            disabled={busy}
            aria-label={speech.listening ? 'Stop listening' : 'Speak an order'}
            title={speech.listening ? 'Listening…' : 'Speak an order'}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-fast disabled:opacity-40 ${
              speech.listening ? 'animate-pulse border-error bg-error/15 text-error' : 'border-outline text-on-surface-variant hover:border-accent hover:text-accent'
            }`}
          >
            <Icon name={speech.listening ? 'mic' : 'mic_none'} className="text-[20px]" />
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex items-center gap-xs rounded-full bg-primary px-lg py-xs font-headline text-title-md uppercase text-on-primary transition-colors duration-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name={busy ? 'progress_activity' : 'send'} className={`text-[18px] ${busy ? 'animate-spin' : ''}`} />
          <span>{busy ? 'Working' : 'Run'}</span>
        </button>
      </form>

      {busy && <Working />}
      {error && <ErrorNote message={error} onClose={dismissError} />}
      {!busy && !last && !error && <Examples onPick={(order) => void send(order)} />}
      {!busy && last && <Result exchange={last} />}

      {history.length > 1 && (
        <div className="flex items-center gap-md font-label text-label-sm text-on-surface-variant">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="hover:text-accent">
            {showHistory ? 'Hide' : 'Show'} earlier orders ({history.length - 1})
          </button>
          <button type="button" onClick={clear} className="hover:text-accent">
            Clear
          </button>
        </div>
      )}
      {showHistory && (
        <ol className="scroll-thin flex max-h-48 flex-col gap-xs overflow-y-auto">
          {history.slice(0, -1).reverse().map((x, i) => (
            <li key={i} className="rounded-md border border-outline-variant p-xs font-body text-body-sm text-on-surface-variant">
              <span className="text-on-surface">› {x.order}</span>
              <p className="whitespace-pre-line">{x.reply.reply}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** El modelo local tarda entre unos segundos y medio minuto: se muestra que sigue trabajando. */
function Working() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="flex items-center gap-sm font-label text-label-lg text-on-surface-variant">
      <Icon name="satellite_alt" className="animate-pulse text-[18px] text-accent" />
      SENDA is checking conditions and planning… <Live className="font-mono">{seconds}s</Live>
    </p>
  );
}

function Examples({ onPick }: { onPick: (order: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-xs">
      <span className="font-label text-label-sm text-on-surface-variant">Try:</span>
      {EXAMPLES.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onPick(ex)}
          className="rounded-full border border-outline-variant px-sm py-[2px] font-body text-body-sm text-on-surface-variant hover:border-accent hover:text-accent"
        >
          {ex}
        </button>
      ))}
    </div>
  );
}

function Result({ exchange }: { exchange: Exchange }) {
  const { targetById } = useMission();
  const { reply } = exchange;
  const outing = reply.outing;
  const name = (id: string) => targetById.get(id)?.name ?? id;

  return (
    <div className="flex flex-col gap-xs rounded-lg border border-accent/40 bg-surface p-sm">
      <p className="font-body text-body-sm text-on-surface-variant">› {exchange.order}</p>
      {reply.reply && <p className="whitespace-pre-line font-body text-body-md text-on-surface">{reply.reply}</p>}

      {outing?.planned && (
        <p className="flex flex-wrap items-center gap-xs font-label text-label-sm text-success">
          <Icon name="check_circle" className="text-[16px]" />
          <span>Loaded on the map:</span>
          <Live>
            {outing.target_ids.map(name).join(', ')} · {Math.round(outing.total_duration_min)} min
            {outing.budget_min ? ` of ${Math.round(outing.budget_min)}` : ''} · {outing.traverse_profile}
            {outing.speed_factor < 1 ? ' · dust storm' : ''}
          </Live>
        </p>
      )}
      {outing && !outing.planned && (
        <p className="flex items-center gap-xs font-label text-label-sm text-error">
          <Icon name="block" className="text-[16px]" />
          Nothing was planned: conditions do not allow an outing.
        </p>
      )}
      {outing?.dropped.length ? (
        <p className="font-label text-label-sm text-warning">
          Left out: {outing.dropped.map((d) => `${name(d.id)} (${d.reason === 'time' ? 'no time' : 'no safe return'})`).join(', ')}
        </p>
      ) : null}
      {reply.view && (
        <p className="flex items-center gap-xs font-label text-label-sm text-success">
          <Icon name="visibility" className="text-[16px]" />
          View changed{reply.view.profile ? ` · ${reply.view.profile} route` : ''}
          {reply.view.screen ? ` · ${reply.view.screen} screen` : ''}
        </p>
      )}
      {reply.tools_used.length > 0 && (
        <p className="font-mono text-mono-sm text-on-surface-variant" translate="no">
          tools: {reply.tools_used.join(' → ')}
        </p>
      )}
    </div>
  );
}
