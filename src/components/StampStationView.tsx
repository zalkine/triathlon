'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { stampEntryTime, undoEntryTime } from '@/actions/entries';
import { formatClock } from '@/lib/time';
import type { Station } from '@/lib/constants';

type Entry = { id: string; name: string; heatName: string; categoryNameEn: string; categoryNameHe: string };
type StampStation = Exclude<Station, 'start'>;

export default function StampStationView({ station }: { station: StampStation }) {
  const locale = useLocale();
  const t = useTranslations('stationStamp');
  const tc = useTranslations('common');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<{ entryId: string; name: string; time: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch(`/api/stations/${station}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setActive(data.active);
    }
  }, [station]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, query]);

  const handleStamp = (entry: Entry) => {
    startTransition(async () => {
      const result = await stampEntryTime(entry.id, station);
      if (result.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        setToast({ entryId: entry.id, name: entry.name, time: formatClock(new Date(), locale) });
        setTimeout(() => setToast((cur) => (cur?.entryId === entry.id ? null : cur)), 15000);
      } else {
        load();
      }
    });
  };

  const handleUndo = () => {
    if (!toast) return;
    const entryId = toast.entryId;
    startTransition(async () => {
      const result = await undoEntryTime(entryId, station);
      if (result.ok) {
        setToast(null);
        load();
      }
    });
  };

  if (!active) {
    return <p className="text-ink-light">{t('notStartedYet')}</p>;
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search')}
        className="w-full rounded-lg border border-ink/20 px-4 py-3 text-lg focus:border-ink focus:outline-none"
      />
      {filtered.length === 0 && <p className="text-ink-light">{t('noEntries')}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((e) => (
          <button
            key={e.id}
            disabled={isPending}
            onClick={() => handleStamp(e)}
            className="flex flex-col items-start gap-1 rounded-2xl bg-white p-6 text-start shadow-sm transition hover:brightness-95 disabled:opacity-60"
          >
            <span className="text-xs text-ink-light">
              {locale === 'he' ? e.categoryNameHe : e.categoryNameEn} · {e.heatName}
            </span>
            <span className="text-xl font-bold">{e.name}</span>
            <span className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream">{t('tapToStamp')}</span>
          </button>
        ))}
      </div>
      {toast && (
        <div className="fixed bottom-6 start-6 z-10 flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-cream shadow-lg">
          <span>{t('stamped', { name: toast.name, time: toast.time })}</span>
          <button onClick={handleUndo} className="font-semibold underline">
            {tc('undo')}
          </button>
        </div>
      )}
    </div>
  );
}
