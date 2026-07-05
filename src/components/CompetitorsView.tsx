'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Competitor = {
  id: string;
  name: string;
  age: number;
  mode: string;
  legSwim: boolean;
  legBike: boolean;
  legRun: boolean;
  checkedIn: boolean;
};
type Category = { id: string; nameEn: string; nameHe: string; type: string; competitors: Competitor[] };

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

  const total = categories.reduce((sum, c) => sum + c.competitors.length, 0);
  const withPeople = categories.filter((c) => c.competitors.length > 0);

  const legs = (c: Competitor) =>
    [c.legSwim && t('legSwim'), c.legBike && t('legBike'), c.legRun && t('legRun')].filter(Boolean).join(' · ');

  if (loaded && total === 0) {
    return <p className="text-ink-light">{t('none')}</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-light">{t('count', { count: total })}</p>
      {withPeople.map((c) => (
        <div key={c.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
          <h2 className="mb-3 font-semibold">
            {locale === 'he' ? c.nameHe : c.nameEn}{' '}
            <span className="text-sm font-normal text-ink-light">({c.competitors.length})</span>
          </h2>
          <ul className="divide-y divide-ink/5">
            {c.competitors.map((comp) => (
              <li key={comp.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{comp.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-ink-light">
                  <span>{t('age')}: {comp.age}</span>
                  {c.type === 'TEAM' && legs(comp) && <span>· {legs(comp)}</span>}
                  {comp.checkedIn && (
                    <span className="rounded-full bg-swim/30 px-2 py-0.5 text-xs font-medium text-swim-dark">
                      {t('arrived')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
