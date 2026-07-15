'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { stampEntryTime, undoEntryTime } from '@/actions/entries';
import { formatClock, formatHeatName, israelClockToMs } from '@/lib/time';
import type { Station } from '@/lib/constants';

type Member = { id: string; name: string; leg: string | null };
type Entry = {
  id: string;
  name: string;
  heatName: string;
  heatStartTime: string | null;
  categoryNameEn: string;
  categoryNameHe: string;
  members: Member[];
};
type StampStation = Exclude<Station, 'start'>;

export default function StampStationView({ station }: { station: StampStation }) {
  const locale = useLocale();
  const t = useTranslations('stationStamp');
  const tc = useTranslations('common');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [toast, setToast] = useState<{ entryId: string; name: string; time: string } | null>(null);
  const [, setTick] = useState(0);
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef(0);

  const isFinish = station === 'run';

  const load = useCallback(async () => {
    const res = await fetch(`/api/stations/${station}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.serverNow) offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    setEntries(data.entries ?? []);
    setActive(data.active);
  }, [station]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 2000);
    const clock = setInterval(() => setTick((n) => n + 1), 250);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const serverNow = () => Date.now() + offsetRef.current;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.members.some((m) => m.name.toLowerCase().includes(q))
    );
  }, [entries, query]);

  const removeAndToast = (entry: Entry, atMs: number | undefined, displayName: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    setManualFor(null);
    setToast({ entryId: entry.id, name: displayName, time: formatClock(new Date(atMs ?? serverNow()), locale) });
    setTimeout(() => setToast((cur) => (cur?.entryId === entry.id ? null : cur)), 15000);
  };

  // On the finish line the person crossing is the runner, so the toast/name a
  // timekeeper reads back should be the runner, not the whole team.
  const primaryName = (entry: Entry) => {
    if (!isFinish) return entry.name;
    const runner = entry.members.find((m) => m.leg === 'RUN');
    return runner ? runner.name : entry.name;
  };

  const handleStamp = (entry: Entry) => {
    startTransition(async () => {
      const result = await stampEntryTime(entry.id, station);
      if (result.ok) removeAndToast(entry, undefined, primaryName(entry));
      else load();
    });
  };

  const handleManual = (entry: Entry) => {
    const atMs = israelClockToMs(manualValue, serverNow());
    if (atMs == null) return;
    startTransition(async () => {
      const result = await stampEntryTime(entry.id, station, atMs);
      if (result.ok) removeAndToast(entry, atMs, primaryName(entry));
      else load();
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

  const openManual = (entry: Entry) => {
    setManualFor(entry.id);
    setManualValue(formatClock(new Date(serverNow()), locale));
  };

  const legLabel = (leg: string | null) =>
    leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : '';

  if (!active) return <p className="text-ink-light">{t('notStartedYet')}</p>;

  return (
    <div className="space-y-4">
      {/* Live wall clock — the timekeeper's reference for manual entries. */}
      <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-cream">
        <span className="text-sm opacity-80">{t('clockLabel')}</span>
        <span className="font-mono text-2xl font-bold tabular-nums">{formatClock(new Date(serverNow()), locale)}</span>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search')}
        className="w-full rounded-lg border border-ink/20 px-4 py-3 text-lg focus:border-ink focus:outline-none"
      />
      {filtered.length === 0 && <p className="text-ink-light">{t('noEntries')}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((e) => {
          // Finish line: the runner is the headline; the team name and the other
          // two members are shown small so the timekeeper stamps the runner and
          // isn't confused by an earlier-leg member wandering past the line.
          const runner = isFinish ? e.members.find((m) => m.leg === 'RUN') : undefined;
          const otherMembers = isFinish ? e.members.filter((m) => m.leg !== 'RUN') : [];
          const headline = runner ? runner.name : e.name;
          return (
            <div key={e.id} className="rounded-2xl bg-surface p-4 shadow-sm">
              <div className="text-xs text-ink-light">
                {locale === 'he' ? e.categoryNameHe : e.categoryNameEn} · {formatHeatName(e.heatName, locale)}
              </div>
              <div className="mt-0.5 text-xl font-bold">{headline}</div>
              {isFinish && (runner || otherMembers.length > 0) && (
                <div className="mt-0.5 space-y-0.5 text-xs text-ink-light">
                  {runner && <div className="font-medium">{e.name}</div>}
                  {otherMembers.length > 0 && (
                    <div className="flex flex-wrap gap-x-3">
                      {otherMembers.map((m) => (
                        <span key={m.id}>
                          {legLabel(m.leg)}: {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {manualFor === e.id ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-ink-light">{t('manualHint')}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={manualValue}
                      onChange={(ev) => setManualValue(ev.target.value)}
                      placeholder="00:00:00"
                      className="w-32 rounded-lg border border-ink/20 px-3 py-2 font-mono text-lg tabular-nums focus:border-ink focus:outline-none"
                    />
                    <button
                      onClick={() => handleManual(e)}
                      disabled={isPending || israelClockToMs(manualValue, serverNow()) == null}
                      className="rounded-full bg-swim px-4 py-2 font-semibold text-ink transition hover:brightness-95 disabled:opacity-50"
                    >
                      {t('saveTime')}
                    </button>
                    <button onClick={() => setManualFor(null)} className="px-2 text-sm text-ink-light underline">
                      {tc('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleStamp(e)}
                    disabled={isPending}
                    className="flex-1 rounded-full bg-run px-4 py-3 text-lg font-bold text-white transition hover:brightness-95 disabled:opacity-60"
                  >
                    {isFinish ? t('arrived') : t('tapToStamp')}
                  </button>
                  <button
                    onClick={() => openManual(e)}
                    disabled={isPending}
                    className="rounded-full border-2 border-ink/20 px-3 py-3 text-sm font-semibold text-ink transition hover:bg-ink/5"
                  >
                    ⏱ {t('enterTime')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
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
