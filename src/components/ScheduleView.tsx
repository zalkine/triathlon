'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatClockHM, formatHeatName } from '@/lib/time';

type CategoryName = { nameEn: string; nameHe: string };
type Heat = {
  id: string;
  name: string;
  entryCount: number;
  estimatedStart: string | null;
  startTime: string | null;
  /** Other categories combined into this heat's start, if any. */
  startsWith: CategoryName[];
};
type Category = { id: string; nameEn: string; nameHe: string; heats: Heat[] };

export default function ScheduleView() {
  const locale = useLocale();
  const t = useTranslations('schedule');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [published, setPublished] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/schedule', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setPublished(data.published ?? false);
      setCategories(data.categories);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const hasAnyHeats = categories.some((c) => c.heats.length > 0);

  if (loaded && (!published || !hasAnyHeats)) {
    return <p className="text-ink-light">{t('notGenerated')}</p>;
  }

  return (
    <div className="space-y-6">
      {categories
        .filter((c) => c.heats.length > 0)
        .map((c) => (
          <div key={c.id} className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
            <h2 className="mb-3 font-semibold">{locale === 'he' ? c.nameHe : c.nameEn}</h2>
            <ul className="divide-y divide-ink/5">
              {c.heats.map((h) => (
                <li key={h.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{formatHeatName(h.name, locale)}</span>
                    <span className="text-ink-light">
                      {t('competitors')}: {h.entryCount}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {h.startTime
                        ? formatClockHM(new Date(h.startTime), locale)
                        : h.estimatedStart
                          ? `${t('estimatedStart')}: ${formatClockHM(new Date(h.estimatedStart), locale)}`
                          : '—'}
                    </span>
                  </div>
                  {/* This heat shares the pool with another race — say so, so a
                      competitor isn't surprised to line up beside one. */}
                  {h.startsWith?.length > 0 && (
                    <p className="mt-1 text-xs text-ink-light">
                      🔗 {t('startsTogetherWith')}:{' '}
                      {h.startsWith.map((o) => (locale === 'he' ? o.nameHe : o.nameEn)).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
