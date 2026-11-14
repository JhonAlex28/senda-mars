import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { VERDICT_META } from '../lib/verdict';
import type { Readiness, Verdict } from '../types';

const ORDER: Verdict[] = ['go', 'caution', 'no_go'];
const PILL: Record<Verdict, string> = {
  go: 'bg-success text-on-success',
  caution: 'bg-warning text-on-warning',
  no_go: 'bg-error text-on-error',
};
const FACE_COLOR: Record<Verdict, string> = { go: 'text-success', caution: 'text-warning', no_go: 'text-error' };
const CARD_TONE = { go: 'success', caution: 'warning', no_go: 'error' } as const;
const MESSAGE: Record<Verdict, string> = {
  go: 'The weather is good!',
  caution: 'You can go, but watch the weather.',
  no_go: 'Stay inside today.',
};

/** "Can I go today?" — veredicto ambiental con el sol y la fuente de la medición. */
export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { verdict } = readiness;
  const sources = [...new Set(readiness.checks.map((c) => c.source.split(' ')[0]))].join(', ');
  return (
    <Card tone={CARD_TONE[verdict]} className="items-center text-center">
      <h2 className="font-headline text-title-md text-on-surface">Can I go today?</h2>
      <div className="flex items-center gap-sm">
        {ORDER.map((v) =>
          v === verdict ? (
            <div key={v} className={`flex items-center gap-xs rounded-full px-md py-xs ${PILL[v]}`}>
              <Icon name={VERDICT_META[v].face} className="text-[24px]" />
              <span className="font-headline text-headline-sm uppercase">{VERDICT_META[v].label}</span>
            </div>
          ) : (
            <Icon key={v} name={VERDICT_META[v].face} className={`text-[20px] opacity-40 ${FACE_COLOR[v]}`} />
          ),
        )}
      </div>
      <p className="font-body text-body-sm text-on-surface">{MESSAGE[verdict]}</p>
      <p className="font-mono text-mono-sm text-on-surface-variant">
        Measured on Sol {readiness.sol}, {readiness.local_solar_time} LTST. Source: {sources}.
      </p>
    </Card>
  );
}
