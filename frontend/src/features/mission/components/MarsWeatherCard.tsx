import { CHECK_ICON, VERDICT_META, plainWord, type Readiness } from '@/features/environment';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { TEXT_TONE } from '@/shared/ui/Meter';
import { Live } from '@/shared/ui/Text';

/** Clima real: mediciones de Curiosity (REMS/RAD) del backend y su veredicto para salir. */
export function MarsWeatherCard({ readiness }: { readiness: Readiness | null }) {
  const verdict = readiness ? VERDICT_META[readiness.verdict] : null;

  return (
    <Card
      title="Weather"
      action={
        verdict && (
          <span className={`rounded-full border px-sm py-[1px] font-label text-label-sm ${TEXT_TONE[verdict.tone]} border-current`}>
            {verdict.label}
          </span>
        )
      }
      className="gap-sm"
    >
      <div className="flex flex-col gap-xs">
        <p className="font-label text-label-sm text-on-surface-variant">
          Right now
          {readiness && (
            <Live className="font-mono">
              {' '}
              · sol {readiness.sol}, {readiness.local_solar_time}
            </Live>
          )}
        </p>
        {readiness
          ? readiness.checks.map((check) => (
              <div key={check.key} className="flex items-center gap-sm" title={`${check.label} · measured by ${check.source}`}>
                <Icon name={CHECK_ICON[check.key]} className="shrink-0 text-[20px] text-accent" />
                <div className="min-w-0 flex-1">
                  <span className="block font-body text-body-sm leading-tight text-on-surface">{plainWord(check)}</span>
                  <Live className="font-mono text-mono-sm text-on-surface-variant">
                    {check.value} {check.unit}
                  </Live>
                </div>
                <Icon name={VERDICT_META[check.verdict].face} className={`shrink-0 text-[20px] ${TEXT_TONE[VERDICT_META[check.verdict].tone]}`} />
              </div>
            ))
          : Array.from({ length: 4 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded bg-surface" />)}
        <p className="font-body text-[11px] text-on-surface-variant">Curiosity REMS · RAD</p>
      </div>
    </Card>
  );
}
