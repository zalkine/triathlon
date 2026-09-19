'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  categoriesForYear,
  categoryLabel,
  formatHms,
  hasSplits,
  resultsFor,
  type HofResult,
} from '@/lib/hallOfFame';

/**
 * One year's full results in the Hall of Fame, with the leg splits folded away
 * behind a button.
 *
 * A finishing time is what almost everyone comes for, so it stays the whole row
 * and the splits open only when asked for. The button appears only for a year
 * that has them: the 2018–2023 sheets record finishing times alone, and a race
 * can be timed at the finish line only, so offering it everywhere would promise
 * something most years can't show.
 */
export default function YearResults({ year, results }: { year: number; results: HofResult[] }) {
  const t = useTranslations('hof');
  const [showSplits, setShowSplits] = useState(false);
  const anySplits = results.some(hasSplits);

  const split = (seconds: number | null | undefined) => (seconds == null ? '—' : formatHms(seconds));

  return (
    <div className="mt-3 space-y-5">
      {anySplits && (
        <button
          type="button"
          onClick={() => setShowSplits((on) => !on)}
          aria-expanded={showSplits}
          className="rounded-full border border-ink/20 bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-ink/5"
        >
          {showSplits ? `▴ ${t('hideSplits')}` : `▾ ${t('showSplits')}`}
        </button>
      )}

      {categoriesForYear(results, year).map(({ categoryHe, isTeam }) => {
        const rows = resultsFor(results, year, categoryHe, isTeam);
        if (rows.length === 0) return null;
        return (
          <div key={`${categoryHe}-${isTeam}`}>
            <h4 className="mb-1 text-sm font-semibold text-ink-light">{categoryLabel(categoryHe)}</h4>
            <ol className="divide-y divide-ink/5">
              {rows.map((r, i) => (
                <li key={i} className="py-1.5 text-sm">
                  <div className="flex items-baseline gap-3">
                    <span className="w-6 shrink-0 text-end font-mono text-ink-light">{i + 1}</span>
                    <span className="min-w-0 flex-1 break-words font-medium">{r.name}</span>
                    <span className="shrink-0 font-mono tabular-nums text-ink-light">{formatHms(r.seconds)}</span>
                  </div>
                  {showSplits && hasSplits(r) && (
                    <div className="ms-9 mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-light">
                      <span>
                        {t('swim')} <span className="font-mono tabular-nums text-swim-dark">{split(r.swimSeconds)}</span>
                      </span>
                      <span>
                        {t('bike')} <span className="font-mono tabular-nums text-bike-dark">{split(r.bikeSeconds)}</span>
                      </span>
                      <span>
                        {t('run')} <span className="font-mono tabular-nums text-run-dark">{split(r.runSeconds)}</span>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
