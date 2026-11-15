import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useMission } from '@/features/mission';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { useAssistant, type Exchange } from '../hooks/useAssistant';
import type { Availability } from '../types';
import { useSpeech } from '../hooks/useSpeech';

const EXAMPLES = [
  { icon: 'event', text: 'Prepara la salida de mañana, tengo 3 horas' },
  { icon: 'storm', text: 'Hay una tormenta de polvo, replanifica' },
  { icon: 'science', text: 'Cambia a la ruta científica' },
  { icon: 'rocket_launch', text: 'Inicia la simulación' },
  { icon: 'help', text: '¿Cómo calcula SENDA la seguridad de una ruta?' },
];

/**
 * Copiloto de SENDA: chat lateral. El usuario da una orden y el asistente la ejecuta en el sistema;
 * el plan aparece en el mapa y aquí solo se resume. En la misión se abre desde la cabecera
 * ("Copilot"), así el botón no tapa los paneles; en el globo queda el botón flotante.
 */
export function AssistantPanel({ floating = false }: { floating?: boolean }) {
  const assistant = useAssistant();
  const { state, dispatch } = useMission();
  const open = state.copilotOpen;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    dispatch({ type: 'setCopilotOpen', open: typeof v === 'function' ? v(open) : v });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ready = assistant.availability === 'ready';

  return (
    <>
      {floating && <Launcher open={open} busy={assistant.busy} availability={assistant.availability} onClick={() => setOpen((v) => !v)} />}
      <aside
        aria-label="SENDA Copilot"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-outline bg-surface-container shadow-[-24px_0_48px_rgba(0,0,0,0.45)] transition-transform duration-standard ease-standard ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <Header availability={assistant.availability} onClose={() => setOpen(false)} onClear={assistant.history.length ? assistant.clear : undefined} />
        {ready || assistant.history.length > 0 ? (
          <Conversation {...assistant} />
        ) : (
          <Unavailable availability={assistant.availability} model={assistant.model} onRetry={assistant.retry} />
        )}
        <Composer busy={assistant.busy} disabled={!ready} onSend={assistant.send} />
      </aside>
    </>
  );
}

const STATUS: Record<Availability, { dot: string; text: string }> = {
  checking: { dot: 'bg-on-surface-variant', text: 'Connecting…' },
  ready: { dot: 'bg-success', text: 'Plans with the real planner · runs on a local open model' },
  disabled: { dot: 'bg-warning', text: 'Not available on this server' },
  offline: { dot: 'bg-error', text: 'Model not responding' },
  'no-backend': { dot: 'bg-error', text: 'SENDA server not reachable' },
};

function Launcher({ open, busy, availability, onClick }: { open: boolean; busy: boolean; availability: Availability; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? 'Close SENDA Copilot' : 'Open SENDA Copilot'}
      className={`group fixed bottom-lg right-lg z-40 flex items-center gap-sm rounded-full bg-gradient-to-br from-primary to-accent py-sm pl-sm pr-lg text-on-primary shadow-[0_8px_28px_rgba(59,130,246,0.45)] transition-all duration-standard hover:shadow-[0_10px_34px_rgba(56,189,248,0.6)] ${
        open ? 'pointer-events-none translate-y-4 opacity-0' : 'opacity-100'
      }`}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
        <Icon name="auto_awesome" filled className="text-[20px]" />
        {busy && <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="font-headline text-title-md">SENDA Copilot</span>
        <span className="font-body text-[11px] opacity-85">
          {busy ? 'Working on it…' : availability === 'ready' ? 'Tell me what to plan' : availability === 'checking' ? 'Connecting…' : 'Not available here'}
        </span>
      </span>
    </button>
  );
}

function Header({ availability, onClose, onClear }: { availability: Availability; onClose: () => void; onClear?: () => void }) {
  return (
    <header className="flex items-center gap-sm border-b border-outline bg-surface-container-high px-md py-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-on-primary">
        <Icon name="auto_awesome" filled className="text-[20px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-headline text-title-md text-on-surface">SENDA Copilot</h2>
        <p className="flex items-center gap-xs font-body text-[11px] text-on-surface-variant">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS[availability].dot}`} />
          {STATUS[availability].text}
        </p>
      </div>
      {onClear && (
        <IconButton icon="delete_sweep" label="Clear conversation" onClick={onClear} />
      )}
      <IconButton icon="close" label="Close" onClick={onClose} />
    </header>
  );
}

function Conversation({ history, busy, error, send, dismissError }: ReturnType<typeof useAssistant>) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Con llaves: en navegadores nuevos scrollIntoView devuelve una promesa, y React tomaría
    // cualquier valor devuelto por el efecto como función de limpieza
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history.length, busy, error]);

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-md overflow-y-auto px-md py-md">
      {history.length === 0 && !busy && <Welcome onPick={(t) => void send(t)} />}
      {history.map((x, i) => (
        <div key={i} className="flex flex-col gap-sm animate-fade-up">
          <UserBubble text={x.order} />
          <AssistantBubble exchange={x} />
        </div>
      ))}
      {busy && <Typing />}
      {error && (
        <div role="alert" className="flex items-start gap-xs rounded-lg border border-error/40 bg-error/10 p-sm font-body text-body-sm text-on-surface">
          <Icon name="error" className="mt-px text-[16px] text-error" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={dismissError} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface">
            <Icon name="close" className="text-[16px]" />
          </button>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-md pt-sm">
      <div>
        <p className="font-headline text-headline-sm text-on-surface">Hi, I’m your mission copilot.</p>
        <p className="mt-xs font-body text-body-md text-on-surface-variant">
          Tell me what you need and I’ll do it in SENDA: check the weather, pick the places, plan the drive and the walks.
          You’ll see the result on the map.
        </p>
      </div>
      <div className="flex flex-col gap-xs">
        <span className="font-label text-label-sm uppercase text-on-surface-variant">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.text}
            type="button"
            onClick={() => onPick(ex.text)}
            className="flex items-center gap-sm rounded-lg border border-outline bg-surface px-sm py-xs text-left font-body text-body-sm text-on-surface transition-colors duration-fast hover:border-accent hover:bg-accent/5"
          >
            <Icon name={ex.icon} className="shrink-0 text-[18px] text-accent" />
            {ex.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Aviso cuando el copiloto no puede responder: qué pasa y cómo activarlo, sin jerga de errores. */
function Unavailable({ availability, model, onRetry }: { availability: Availability; model: string | null; onRetry: () => void }) {
  if (availability === 'checking' || availability === 'ready') {
    return (
      <div className="flex flex-1 items-center justify-center gap-sm font-body text-body-sm text-on-surface-variant">
        <Icon name="progress_activity" className="animate-spin text-[18px] text-accent" /> Connecting to the copilot…
      </div>
    );
  }
  const modelName = model ?? 'qwen3:1.7b';
  const content: Record<'disabled' | 'offline' | 'no-backend', { icon: string; title: string; body: string; steps: string[] }> = {
    disabled: {
      icon: 'cloud_off',
      title: 'The copilot is not available on this server',
      body:
        'SENDA Copilot runs on a free open AI model that lives on the computer running the backend, not in the cloud. ' +
        'Everything else in SENDA works normally: plan with the panels on the right.',
      steps: [
        `Install Ollama and download the model: ollama pull ${modelName}`,
        'In backend/.env set SENDA_ASSISTANT_ENABLED=true',
        'Restart the backend (python scripts/dev.py)',
      ],
    },
    offline: {
      icon: 'power_off',
      title: 'The AI model is not responding',
      body: `The copilot is turned on, but the local model (${modelName}) is not running or not downloaded yet.`,
      steps: ['Open Ollama (icon next to the clock)', `Download the model if needed: ollama pull ${modelName}`, 'Press "Try again"'],
    },
    'no-backend': {
      icon: 'dns',
      title: 'Cannot reach the SENDA server',
      body: 'The backend is not running or the address is wrong. Start it and try again.',
      steps: ['Run python scripts/dev.py from the project folder'],
    },
  };
  const c = content[availability];
  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-md overflow-y-auto px-md py-lg">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
        <Icon name={c.icon} className="text-[26px]" />
      </span>
      <div>
        <p className="font-headline text-headline-sm text-on-surface">{c.title}</p>
        <p className="mt-xs font-body text-body-md text-on-surface-variant">{c.body}</p>
      </div>
      <div className="rounded-lg border border-outline bg-surface p-sm">
        <p className="mb-xs font-label text-label-sm uppercase text-on-surface-variant">How to turn it on</p>
        <ol className="flex list-decimal flex-col gap-[4px] pl-md font-body text-body-sm text-on-surface marker:text-accent">
          {c.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-xs self-start rounded-full border border-accent px-md py-xs font-label text-label-lg text-accent transition-colors duration-fast hover:bg-accent/10"
      >
        <Icon name="refresh" className="text-[18px]" /> Try again
      </button>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-primary px-md py-sm font-body text-body-md text-on-primary">{text}</p>
    </div>
  );
}

function AssistantBubble({ exchange }: { exchange: Exchange }) {
  const { targetById } = useMission();
  const { reply } = exchange;
  const outing = reply.outing;
  const name = (id: string) => targetById.get(id)?.name ?? id;

  return (
    <div className="flex items-start gap-xs">
      <span className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-on-primary">
        <Icon name="auto_awesome" filled className="text-[14px]" />
      </span>
      <div className="flex min-w-0 max-w-[88%] flex-col gap-xs rounded-2xl rounded-tl-sm border border-outline bg-surface px-md py-sm">
        {reply.reply ? (
          <p className="whitespace-pre-line font-body text-body-md text-on-surface">
            <RichText text={reply.reply} />
          </p>
        ) : (
          <p className="font-body text-body-md text-on-surface-variant">Done.</p>
        )}

        {outing?.planned && (
          <Result tone="success" icon="map">
            <span className="font-semibold">On the map:</span>{' '}
            <Live>
              {outing.target_ids.map(name).join(', ')} · {Math.round(outing.total_duration_min)} min
              {outing.budget_min ? ` of ${Math.round(outing.budget_min)}` : ''} · {outing.traverse_profile} route
              {outing.speed_factor < 1 ? ' · dust storm' : ''}
            </Live>
          </Result>
        )}
        {outing && !outing.planned && (
          <Result tone="error" icon="block">
            Nothing planned: conditions do not allow going out.
          </Result>
        )}
        {outing && outing.dropped.length > 0 && (
          <Result tone="warning" icon="remove_circle">
            Left out: {outing.dropped.map((d) => `${name(d.id)} (${d.reason === 'time' ? 'no time' : 'no safe way back'})`).join(', ')}
          </Result>
        )}
        {exchange.calendar && (
          <Result tone={exchange.calendar.ok ? 'success' : 'error'} icon={exchange.calendar.ok ? 'event_available' : 'event_busy'}>
            {exchange.calendar.text}
          </Result>
        )}
        {reply.view && (
          <Result tone="success" icon="visibility">
            Screen updated{reply.view.profile ? ` · ${reply.view.profile} route` : ''}
            {reply.view.screen ? ` · ${SCREEN_NAME[reply.view.screen]}` : ''}
          </Result>
        )}
        {reply.tools_used.length > 0 && (
          <p className="flex flex-wrap gap-[4px] pt-[2px]" translate="no">
            {[...new Set(reply.tools_used)].map((t) => (
              <span key={t} className="rounded-full bg-surface-container-high px-xs py-[1px] font-mono text-[10px] text-on-surface-variant">
                {t}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/** El modelo a veces responde con **negritas** de Markdown: se muestran como negrita, sin asteriscos. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part.replace(/^#{1,4} /gm, '')}</span>
        ),
      )}
    </>
  );
}

const SCREEN_NAME = { plan: 'vehicle route', walk: 'EVA', go: 'simulation started' } as const;

function Result({ tone, icon, children }: { tone: 'success' | 'warning' | 'error'; icon: string; children: ReactNode }) {
  const tones = {
    success: 'border-success/30 bg-success/10 text-on-surface',
    warning: 'border-warning/30 bg-warning/10 text-on-surface',
    error: 'border-error/30 bg-error/10 text-on-surface',
  };
  const iconTone = { success: 'text-success', warning: 'text-warning', error: 'text-error' };
  return (
    <p className={`flex items-start gap-xs rounded-lg border px-sm py-xs font-body text-body-sm ${tones[tone]}`}>
      <Icon name={icon} className={`mt-px shrink-0 text-[16px] ${iconTone[tone]}`} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** El modelo local tarda de segundos a medio minuto: se muestra que sigue trabajando. */
function Typing() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-xs">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-on-primary">
        <Icon name="auto_awesome" filled className="text-[14px]" />
      </span>
      <div className="flex items-center gap-sm rounded-2xl rounded-tl-sm border border-outline bg-surface px-md py-sm">
        <span className="flex gap-[3px]">
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        <span className="font-body text-body-sm text-on-surface-variant">
          Checking conditions and planning… <Live className="font-mono">{seconds}s</Live>
        </span>
      </div>
    </div>
  );
}

function Composer({ busy, disabled, onSend }: { busy: boolean; disabled: boolean; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const speech = useSpeech((spoken) => void onSend(spoken));
  const submit = () => {
    if (!text.trim() || busy || disabled) return;
    const order = text;
    setText('');
    void onSend(order);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <footer className="border-t border-outline bg-surface-container-high p-sm">
      <div className="flex items-end gap-xs rounded-2xl border border-outline bg-surface px-sm py-xs focus-within:border-accent">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={busy || disabled}
          placeholder={disabled ? 'Copilot not available right now' : 'Tell SENDA what to do…'}
          aria-label="Message for SENDA Copilot"
          className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-xs font-body text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none disabled:opacity-60"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            disabled={busy || disabled}
            aria-label={speech.listening ? 'Stop listening' : 'Speak'}
            title={speech.listening ? 'Listening…' : 'Speak'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-fast disabled:opacity-40 ${
              speech.listening ? 'animate-pulse bg-error/15 text-error' : 'text-on-surface-variant hover:bg-accent/10 hover:text-accent'
            }`}
          >
            <Icon name={speech.listening ? 'mic' : 'mic_none'} className="text-[20px]" />
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || disabled || !text.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors duration-fast hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name={busy ? 'progress_activity' : 'arrow_upward'} className={`text-[20px] ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="mt-[4px] px-xs font-body text-[10px] text-on-surface-variant">
        Enter to send · Shift+Enter for a new line · Figures always come from the SENDA planner.
      </p>
    </footer>
  );
}

function IconButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-fast hover:bg-accent/10 hover:text-on-surface"
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
}
