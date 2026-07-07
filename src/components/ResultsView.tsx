'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDuration, formatClock } from '@/lib/time';

type Category = { id: string; nameEn: string; nameHe: string };
type Entry = {
  id: string;
  name: string;
  heatName: string;
  startTime: string | null;
  runTime: string | null;
  totalMs: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
  rank: number | null;
};

export default function ResultsView({ categories }: { categories: Category[] }) {
  const locale = useLocale();
  const t = useTranslations('results');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/results/${id}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setHidden(!!data.hidden);
    setEntries(data.entries ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(categoryId);
    const interval = setInterval(() => load(categoryId), 5000);
    return () => clearInterval(interval);
  }, [categoryId, load]);

  const statusLabel = (status: Entry['status']) =>
    status === 'NOT_STARTED' ? t('notStarted') : status === 'IN_PROGRESS' ? t('inProgress') : t('finished');

  if (hidden) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-10 text-center text-ink-light">
        {t('hidden')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              c.id === categoryId ? 'bg-ink text-cream' : 'bg-white/70 text-ink hover:bg-ink/10'
            }`}
          >
            {locale === 'he' ? c.nameHe : c.nameEn}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/70">
        <table className="w-full min-w-[560px] text-start">
          <thead>
            <tr className="border-b border-ink/10 text-sm text-ink-light">
              <th className="px-4 py-3 text-start">{t('rank')}</th>
              <th className="px-4 py-3 text-start">{t('name')}</th>
              <th className="px-4 py-3 text-start">{t('start')}</th>
              <th className="px-4 py-3 text-start">{t('finish')}</th>
              <th className="px-4 py-3 text-start">{t('total')}</th>
              <th className="px-4 py-3 text-start">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-light">
                  {t('noEntries')}
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-semibold">{e.rank ?? '—'}</td>
                <td className="px-4 py-3">{e.name}</td>
                <td className="px-4 py-3 tabular-nums">{formatClock(e.startTime ? new Date(e.startTime) : null, locale)}</td>
                <td className="px-4 py-3 tabular-nums">{formatClock(e.runTime ? new Date(e.runTime) : null, locale)}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{e.totalMs !== null ? formatDuration(e.totalMs) : '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      e.status === 'FINISHED'
                        ? 'bg-swim/30 text-swim-dark'
                        : e.status === 'IN_PROGRESS'
                          ? 'bg-bike/30 text-bike-dark'
                          : 'bg-ink/10 text-ink-light'
                    }`}
                  >
                    {statusLabel(e.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-xs text-ink-light">{t('updatedLive')}</p>
    </div>
  );
}
