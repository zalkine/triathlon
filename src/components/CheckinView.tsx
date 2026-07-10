'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { checkInRegistrant, undoCheckIn } from '@/actions/registrants';

type Registrant = {
  id: string;
  name: string;
  age: number | null;
  mode: string;
  categoryNameEn: string;
  categoryNameHe: string;
  checkedIn: boolean;
  hasEntry: boolean;
};

export default function CheckinView() {
  const locale = useLocale();
  const t = useTranslations('checkin');
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch('/api/registrants', { cache: 'no-store' });
    if (res.ok) setRegistrants((await res.json()).registrants);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrants;
    return registrants.filter((r) => r.name.toLowerCase().includes(q));
  }, [registrants, query]);

  const toggle = (r: Registrant) => {
    // Cancelling an already-recorded arrival is easy to do by accident, so make
    // the timekeeper confirm before we undo it.
    if (r.checkedIn && !window.confirm(t('confirmCancel', { name: r.name }))) return;
    startTransition(async () => {
      if (r.checkedIn) {
        await undoCheckIn(r.id);
      } else {
        await checkInRegistrant(r.id);
      }
      load();
    });
  };

  const checkedInCount = registrants.filter((r) => r.checkedIn).length;

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search')}
        className="w-full rounded-lg border border-ink/20 px-4 py-3 text-lg focus:border-ink focus:outline-none"
      />
      <p className="text-sm text-ink-light">
        {checkedInCount} / {registrants.length}
      </p>
      {filtered.length === 0 && <p className="text-ink-light">{t('noResults')}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((r) => (
          <button
            key={r.id}
            disabled={isPending}
            onClick={() => toggle(r)}
            className={`flex flex-col items-start gap-1 rounded-2xl p-5 text-start shadow-sm transition disabled:opacity-60 ${
              r.checkedIn ? 'bg-swim/40' : 'bg-white hover:brightness-95'
            }`}
          >
            <span className="text-xs text-ink-light">
              {locale === 'he' ? r.categoryNameHe : r.categoryNameEn}
              {r.age != null && ` · ${r.age}`}
            </span>
            <span className="text-lg font-bold">{r.name}</span>
            <span
              className={`mt-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
                r.checkedIn ? 'bg-swim-dark text-white' : 'bg-ink text-cream'
              }`}
            >
              {r.checkedIn ? t('arrived') : t('markArrived')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
