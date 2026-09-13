'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { stampEntryTime, undoEntryTime } from '@/actions/entries';
import { formatClock, formatHeatName, israelClockToMs } from '@/lib/time';
import { useWakeLock } from '@/lib/useWakeLock';
import { categoryColorClass, type Station } from '@/lib/constants';

type Member = { id: string; name: string; leg: string | null };
type Entry = {
  id: string;
  name: string;
  heatName: string;
  heatStartTime: string | null;
  categoryId: string;
  categoryKey: string;
  categoryNameEn: string;
  categoryNameHe: string;
  stampedAt: string | null;
  members: Member[];
};
type StampStation = Exclude<Station, 'start'>;

// How long after a stamp the timekeeper can still take it back themselves
// (matches the window enforced by `undoEntryTime` on the server).
const UNDO_WINDOW_MS = 15_000;

export default function StampStationView({ station }: { station: StampStation }) {
  const locale = useLocale();
  const t = useTranslations('stationStamp');
  const tc = useTranslations('common');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [toast, setToast] = useState<{ entryId: string; name: string; time: string } | null>(null);
  const [, setTick] = useState(0);
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef(0);

  const isFinish = station === 'run';
  // Each finish-line volunteer works one category, so their choice is remembered
  // on the device: a reload or an accidental back-navigation mid-race puts them
  // straight back on their own race rather than the whole field.
  const filterStorageKey = `tg:station:${station}:category`;

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

  // Restore the saved category filter after mount (never during render, so the
  // server and client markup still match).
  useEffect(() => {
    if (!isFinish) return;
    try {
      const saved = window.localStorage.getItem(filterStorageKey);
      if (saved) setCategoryId(saved);
    } catch {
      // Private mode / blocked storage — the filter just starts on "all".
    }
  }, [isFinish, filterStorageKey]);

  const pickCategory = (id: string) => {
    setCategoryId(id);
    try {
      if (id) window.localStorage.setItem(filterStorageKey, id);
      else window.localStorage.removeItem(filterStorageKey);
    } catch {
      // Not being able to remember the choice doesn't stop them using it now.
    }
  };

  // Keep the timekeeper's device awake while this station is live, so it never
  // locks between athletes and forces a password unlock mid-stamp.
  useWakeLock(active);

  const serverNow = () => Date.now() + offsetRef.current;

  // The categories actually on this station's list, in the order they appear
  // (the API returns the finish list already grouped by category).
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; key: string; nameEn: string; nameHe: string; waiting: number }>();
    for (const e of entries) {
      const found = seen.get(e.categoryId);
      if (found) {
        if (!e.stampedAt) found.waiting += 1;
      } else {
        seen.set(e.categoryId, {
          id: e.categoryId,
          key: e.categoryKey,
          nameEn: e.categoryNameEn,
          nameHe: e.categoryNameHe,
          waiting: e.stampedAt ? 0 : 1,
        });
      }
    }
    return [...seen.values()];
  }, [entries]);

  const catName = (c: { nameEn: string; nameHe: string }) => (locale === 'he' ? c.nameHe : c.nameEn);

  // A filter for a category that has since disappeared from the list would hide
  // everything with no way back, so fall back to "all" until it reappears.
  const activeCategory = categories.find((c) => c.id === categoryId);
  const effectiveCategoryId = activeCategory ? categoryId : '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (effectiveCategoryId && e.categoryId !== effectiveCategoryId) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.members.some((m) => m.name.toLowerCase().includes(q));
    });
  }, [entries, query, effectiveCategoryId]);

  const waitingShown = filtered.filter((e) => !e.stampedAt).length;
  const doneShown = filtered.length - waitingShown;
  // Competitors the category filter is holding back — worth saying out loud, so
  // nobody is left un-stamped because they were filtered off the screen.
  const hiddenWaiting = effectiveCategoryId
    ? entries.filter((e) => !e.stampedAt && e.categoryId !== effectiveCategoryId).length
    : 0;

  const afterStamp = (entry: Entry, atMs: number | undefined, displayName: string) => {
    const at = new Date(atMs ?? serverNow());
    setEntries((prev) =>
      isFinish
        ? // Finish line: keep them exactly where they are and just mark them
          // done, so the list never reshuffles under the timekeeper.
          prev.map((e) => (e.id === entry.id ? { ...e, stampedAt: at.toISOString() } : e))
        : prev.filter((e) => e.id !== entry.id)
    );
    setManualFor(null);
    setToast({ entryId: entry.id, name: displayName, time: formatClock(at, locale) });
    setTimeout(() => setToast((cur) => (cur?.entryId === entry.id ? null : cur)), UNDO_WINDOW_MS);
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
      if (result.ok) afterStamp(entry, undefined, primaryName(entry));
      else load();
    });
  };

  const handleManual = (entry: Entry) => {
    const atMs = israelClockToMs(manualValue, serverNow());
    if (atMs == null) return;
    startTransition(async () => {
      const result = await stampEntryTime(entry.id, station, atMs);
      if (result.ok) afterStamp(entry, atMs, primaryName(entry));
      else load();
    });
  };

  const handleUndo = (entryId: string) => {
    startTransition(async () => {
      const result = await undoEntryTime(entryId, station);
      if (result.ok) {
        setToast((cur) => (cur?.entryId === entryId ? null : cur));
        setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, stampedAt: null } : e)));
      }
      load();
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

      {/* Finish line only: one volunteer per race, so they narrow the list to
          their own category and work just that colour. */}
      {isFinish && categories.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-light">{t('filterByCategory')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => pickCategory('')}
              aria-pressed={effectiveCategoryId === ''}
              className={`cat-chip rounded-full px-3 py-1.5 text-sm font-semibold ${
                effectiveCategoryId === '' ? '' : 'text-ink'
              }`}
            >
              {t('allCategories')}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCategory(c.id)}
                aria-pressed={effectiveCategoryId === c.id}
                className={`cat-chip rounded-full px-3 py-1.5 text-sm font-semibold ${categoryColorClass(c.key)} ${
                  effectiveCategoryId === c.id ? '' : 'text-ink'
                }`}
              >
                {catName(c)} · {c.waiting}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-light">
            {t('stationSummary', { waiting: waitingShown, done: doneShown })}
          </p>
          {hiddenWaiting > 0 && (
            <p className="rounded-lg bg-run/15 px-3 py-2 text-sm font-medium text-run-dark">
              ⚠ {t('filterHidingHint', { count: hiddenWaiting })}
            </p>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-ink-light">{effectiveCategoryId ? t('noEntriesInCategory') : t('noEntries')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((e) => {
          // Finish line: the runner is the headline; the team name and the other
          // two members are shown small so the timekeeper stamps the runner and
          // isn't confused by an earlier-leg member wandering past the line.
          const runner = isFinish ? e.members.find((m) => m.leg === 'RUN') : undefined;
          const otherMembers = isFinish ? e.members.filter((m) => m.leg !== 'RUN') : [];
          const headline = runner ? runner.name : e.name;
          // Already recorded: the card stays in place and goes grey instead of
          // vanishing, so the timekeeper can see who they've already taken.
          const stampedMs = e.stampedAt ? new Date(e.stampedAt).getTime() : null;
          const done = stampedMs != null;
          const canUndo = stampedMs != null && serverNow() - stampedMs < UNDO_WINDOW_MS;
          return (
            <div
              key={e.id}
              className={`rounded-2xl p-4 shadow-sm ${isFinish ? `cat-card ${categoryColorClass(e.categoryKey)}` : 'bg-surface'} ${
                done ? 'opacity-70' : ''
              }`}
            >
              <div className="text-xs text-ink-light">
                {locale === 'he' ? e.categoryNameHe : e.categoryNameEn} · {formatHeatName(e.heatName, locale)}
              </div>
              <div className={`mt-0.5 text-xl font-bold ${done ? 'text-ink-light' : ''}`}>{headline}</div>
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

              {done ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums text-ink-light">
                    ✓ {t('finishedAt', { time: formatClock(new Date(stampedMs as number), locale) })}
                  </span>
                  {canUndo && (
                    <button
                      onClick={() => handleUndo(e.id)}
                      disabled={isPending}
                      className="text-sm font-semibold text-ink-light underline disabled:opacity-50"
                    >
                      {tc('undo')}
                    </button>
                  )}
                </div>
              ) : manualFor === e.id ? (
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
          <button onClick={() => handleUndo(toast.entryId)} className="font-semibold underline">
            {tc('undo')}
          </button>
        </div>
      )}
    </div>
  );
}
