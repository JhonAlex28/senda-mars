import type { Tone } from '@/shared/ui/Meter';
import type { Check, Verdict } from '../types';

export const VERDICT_META: Record<Verdict, { label: string; face: string; tone: Tone }> = {
  go: { label: 'GO', face: 'sentiment_very_satisfied', tone: 'success' },
  caution: { label: 'CAUTION', face: 'sentiment_neutral', tone: 'warning' },
  no_go: { label: 'NO GO', face: 'sentiment_very_dissatisfied', tone: 'error' },
};

/** Palabra simple para cada medición, como en el mockup ("Cold", "Calm", "Low", "Safe"). */
export function plainWord(check: Check): string {
  const words: Record<Check['key'], Record<Verdict, string>> = {
    temperature: { go: 'Cold', caution: 'Very cold', no_go: 'Freezing' },
    wind: { go: 'Calm', caution: 'Windy', no_go: 'Storm' },
    dust: { go: 'Low dust', caution: 'Dusty', no_go: 'Dust storm' },
    radiation: { go: 'Safe sky', caution: 'High dose', no_go: 'Solar storm' },
  };
  return words[check.key][check.verdict];
}

export const CHECK_ICON: Record<Check['key'], string> = {
  temperature: 'thermostat',
  wind: 'air',
  dust: 'grain',
  radiation: 'wb_sunny',
};
