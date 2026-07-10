'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Competitor = {
  id: string;
  name: string;
  categoryNameEn: string;
  categoryNameHe: string;
  mode: string;
  checkedIn: boolean;
  teamCount: number;
  noTeam: boolean;
  multiTeam: boolean;
  anomaly: boolean;
};

type FilterKey = 'all' | 'checkedIn' | 'notCheckedIn' | 'noTeam' | 'multiTeam' | 'anomaly';

const FILTERS: FilterKey[] = ['all', 'checkedIn', 'notCheckedIn', 'noTeam', 'multiTeam', 'anomaly'];

// Read-only visibility tool on the admin registration screen: surface who's
// checked in, who still has no team, who ended up on more than one team, and any
// anomaly worth a look. The admin decides whether to act — edits live in the
// roster below.
export default function CompetitorFilters() {
  const locale = useLocale();
  const t = useTranslations('competitorFilters');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/competitors', { cache: 'no-store' });
    if (res.ok) {
      setCompetitors((await res.json()).competitors);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const matches = useCallback((c: Competitor, f: FilterKey) => {
    switch (f) {
      case 'all':
        return true;
      case 'checkedIn':
        return c.checkedIn;
      case 'notCheckedIn':
        return !c.checkedIn;
      case 'noTeam':
        return c.noTeam;
      case 'multiTeam':
        return c.multiTeam;
      case 'anomaly':
        return c.anomaly;
    }
  }, []);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0,
      checkedIn: 0,
      notCheckedIn: 0,
      noTeam: 0,
      multiTeam: 0,
      anomaly: 0,
    };
    for (const comp of competitors) for (const f of FILTERS) if (matches(comp, f)) c[f]++;
    return c;
  }, [competitors, matches]);

  const shown = useMemo(
    () => competitors.filter((c) => matches(c, filter)),
    [competitors, filter, matches]
  );

  if (loaded && competitors.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-3">
      <div>
        <h2 className="font-semibold">{t('title')}</h2>
        <p className="text-sm text-ink-light">{t('hint')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f;
          const isAnomaly = f === 'anomaly' && counts[f] > 0;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-ink text-cream'
                  : isAnomaly
                    ? 'bg-run/15 text-run-dark hover:bg-run/25'
                    : 'bg-ink/5 text-ink hover:bg-ink/10'
              }`}
            >
              {t(f)} <span className="opacity-70">({counts[f]})</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-ink-light">{t('none')}</p>
      ) : (
        <ul className="divide-y divide-ink/5">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{c.name}</span>{' '}
                <span className="text-xs text-ink-light">
                  · {locale === 'he' ? c.categoryNameHe : c.categoryNameEn}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.checkedIn ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'
                  }`}
                >
                  {c.checkedIn ? t('badgeCheckedIn') : t('badgeNotCheckedIn')}
                </span>
                {c.noTeam && (
                  <span className="rounded-full bg-bike/20 px-2 py-0.5 text-xs font-medium text-bike-dark">
                    ⚠ {t('badgeNoTeam')}
                  </span>
                )}
                {c.multiTeam && (
                  <span className="rounded-full bg-run/20 px-2 py-0.5 text-xs font-medium text-run-dark">
                    ⚠ {t('badgeMultiTeam', { count: c.teamCount })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
