'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Single = { name: string; checkedIn: boolean };
type Group = { id: string; swim: string | null; bike: string | null; run: string | null };
type Available = { name: string; legSwim: boolean; legBike: boolean; legRun: boolean; checkedIn: boolean };
type Category = {
  id: string;
  nameEn: string;
  nameHe: string;
  type: string;
  count: number;
  singles: Single[];
  groups: Group[];
  available: Available[];
};

export default function CompetitorsView() {
  const locale = useLocale();
  const t = useTranslations('competitors');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/participants', { cache: 'no-store' });
    if (res.ok) {
      setCategories((await res.json()).categories);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  // Count real people (headcount), so the total matches the check-in list — a
  // relay team of three counts as three, not one.
  const catTotal = (c: Category) => c.count;
  const total = categories.reduce((s, c) => s + catTotal(c), 0);
  const shown = categories.filter((c) => catTotal(c) > 0 || c.singles.length + c.groups.length + c.available.length > 0);

  const legsOf = (a: Available) =>
    [a.legSwim && t('legSwim'), a.legBike && t('legBike'), a.legRun && t('legRun')].filter(Boolean).join(' · ');

  const arrivedBadge = (
    <span className="rounded-full bg-swim/30 px-2 py-0.5 text-xs font-medium text-swim-dark">{t('arrived')}</span>
  );

  if (loaded && total === 0) return <p className="text-ink-light">{t('none')}</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-light">{t('count', { count: total })}</p>
      {shown.map((c) => (
        <div key={c.id} className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
          <h2 className="mb-3 font-semibold">
            {locale === 'he' ? c.nameHe : c.nameEn}{' '}
            <span className="text-sm font-normal text-ink-light">({catTotal(c)})</span>
          </h2>

          {/* Solo competitors */}
          {c.singles.length > 0 && (
            <ul className="divide-y divide-ink/5">
              {c.singles.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{s.name}</span>
                  {s.checkedIn && <span className="flex items-center gap-2 text-ink-light">{arrivedBadge}</span>}
                </li>
              ))}
            </ul>
          )}

          {/* Formed groups */}
          {c.groups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-light">{t('groups')}</h3>
              <ul className="space-y-2">
                {c.groups.map((g) => (
                  <li key={g.id} className="rounded-xl bg-cream/60 p-3 text-sm">
                    <div className="flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
                      <span>
                        <span className="text-ink-light">{t('roleSwim')}:</span>{' '}
                        {g.swim ?? <span className="italic text-ink-light">{t('openSlot')}</span>}
                      </span>
                      <span>
                        <span className="text-ink-light">{t('roleBike')}:</span>{' '}
                        {g.bike ?? <span className="italic text-ink-light">{t('openSlot')}</span>}
                      </span>
                      <span>
                        <span className="text-ink-light">{t('roleRun')}:</span>{' '}
                        {g.run ?? <span className="italic text-ink-light">{t('openSlot')}</span>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Available pool */}
          {c.available.length > 0 && (
            <div className="mt-3 space-y-2">
              <h3 className="text-sm font-semibold text-ink-light">{t('availableTitle')}</h3>
              <ul className="divide-y divide-ink/5">
                {c.available.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium">{a.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-ink-light">
                      {legsOf(a) && <span>{legsOf(a)}</span>}
                      {a.checkedIn && arrivedBadge}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
