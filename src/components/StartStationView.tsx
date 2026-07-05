'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { stampHeatStart, undoHeatStart } from '@/actions/heats';
import { formatClock } from '@/lib/time';

type Heat = { id: string; name: string; categoryNameEn: string; categoryNameHe: string };

export default function StartStationView() {
  const locale = useLocale();
  const t = useTranslations('stationStart');
  const tc = useTranslations('common');
  const [heats, setHeats] = useState<Heat[]>([]);
  const [toast, setToast] = useState<{ heatId: string; name: string; time: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch('/api/stations/start', { cache: 'no-store' });
    if (res.ok) setHeats((await res.json()).heats);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  const handleStart = (heat: Heat) => {
    if (!window.confirm(t('confirm'))) return;
    startTransition(async () => {
      const result = await stampHeatStart(heat.id);
      if (result.ok) {
        setHeats((prev) => prev.filter((h) => h.id !== heat.id));
        setToast({ heatId: heat.id, name: heat.name, time: formatClock(new Date(), locale) });
        setTimeout(() => setToast((cur) => (cur?.heatId === heat.id ? null : cur)), 15000);
      } else {
        load();
      }
    });
  };

  const handleUndo = () => {
    if (!toast) return;
    const heatId = toast.heatId;
    startTransition(async () => {
      const result = await undoHeatStart(heatId);
      if (result.ok) {
        setToast(null);
        load();
      }
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('heats')}</h2>
      {heats.length === 0 && <p className="text-ink-light">{t('noHeats')}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {heats.map((h) => (
          <button
            key={h.id}
            disabled={isPending}
            onClick={() => handleStart(h)}
            className="flex flex-col items-start gap-1 rounded-2xl bg-white p-6 text-start shadow-sm transition hover:brightness-95 disabled:opacity-60"
          >
            <span className="text-xs text-ink-light">{locale === 'he' ? h.categoryNameHe : h.categoryNameEn}</span>
            <span className="text-xl font-bold">{h.name}</span>
            <span className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream">{t('startNow')}</span>
          </button>
        ))}
      </div>
      {toast && (
        <div className="fixed bottom-6 start-6 z-10 flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-cream shadow-lg">
          <span>
            {toast.name} — {t('started', { time: toast.time })}
          </span>
          <button onClick={handleUndo} className="font-semibold underline">
            {tc('undo')}
          </button>
        </div>
      )}
    </div>
  );
}
