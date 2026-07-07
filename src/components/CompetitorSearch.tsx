'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { annotatedResults, familyLabel, formatHms, kindLabel } from '@/lib/hallOfFame';

// Computed once for the whole page — every historical result with its place.
const ALL = annotatedResults();

const medalEmoji = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '');

export default function CompetitorSearch() {
  const locale = useLocale();
  const t = useTranslations('hof');
  const [query, setQuery] = useState('');

  const q = query.trim();
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return ALL.filter((r) => r.name.includes(q)).sort((a, b) => b.year - a.year || a.place - b.place);
  }, [q]);

  // Highlight the matched part of a (possibly multi-name) team string.
  const renderName = (name: string) => {
    const i = name.indexOf(q);
    if (q.length < 2 || i < 0) return name;
    return (
      <>
        {name.slice(0, i)}
        <mark className="rounded bg-bike/40 px-0.5">{name.slice(i, i + q.length)}</mark>
        {name.slice(i + q.length)}
      </>
    );
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full rounded-xl border border-ink/20 px-4 py-3 text-lg focus:border-ink focus:outline-none"
      />

      {q.length >= 2 && (
        <p className="text-sm text-ink-light">{t('searchCount', { count: matches.length })}</p>
      )}

      <ul className="space-y-2">
        {matches.map((r, i) => (
          <li key={i} className="rounded-xl border border-ink/10 bg-white/70 p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-semibold">{renderName(r.name)}</span>
              <span className="font-mono tabular-nums text-ink-light">{formatHms(r.seconds)}</span>
            </div>
            <div className="mt-0.5 text-xs text-ink-light">
              {r.year} · {familyLabel(r.family, locale)} · {kindLabel(r.isTeam, locale)} ·{' '}
              <span className="font-medium text-ink">
                {medalEmoji(r.place)} {t('place', { place: r.place })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
