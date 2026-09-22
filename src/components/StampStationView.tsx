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
  // This competitor's place in the station list. A competitor held on screen
  // for their undo window is put back in this place, instead of at the end.
  createdAt: string;
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
  // The swim and bike stations keep a short working list, so a competitor drops
  // off it the moment they are stamped. These are the ones stamped on this
  // device a moment ago: they stay on the list, in their own place, for as long
  // as the stamp can still be taken back. The confirmation and its Undo live on
  // the competitor's own card, so nothing ever floats over the list and hides
  // the next competitor's name or their button.
  const [held, setHeld] = useState<Entry[]>([]);
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  // Read out to screen readers only — on screen the card itself is the receipt.
  const [announcement, setAnnouncement] = useState('');
  const [, setTick] = useState(0);
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef(0);

  const isFinish = station === 'run';
  // Each finish-line volunteer covers one or more categories, so their selection
  // is remembered on the device: a reload or an accidental back-navigation
  // mid-race puts them straight back on their own races rather than the whole
  // field.
  const filterStorageKey = `tg:station:${station}:category`;

  const serverNow = () => Date.now() + offsetRef.current;

  // A stamp can only be taken back within the undo window (the server enforces
  // the same limit), so that is exactly how long a stamped competitor is worth
  // keeping on the swim/bike list.
  const canStillUndo = (entry: Entry) =>
    entry.stampedAt != null && serverNow() - new Date(entry.stampedAt).getTime() < UNDO_WINDOW_MS;

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
    const clock = setInterval(() => {
      setTick((n) => n + 1);
      // Once the window has run out there is nothing left to take back, so the
      // competitor leaves the working list as they always did.
      setHeld((prev) => (prev.every(canStillUndo) ? prev : prev.filter(canStillUndo)));
    }, 250);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  // Restore the saved selection after mount (never during render, so the server
  // and client markup still match).
  useEffect(() => {
    if (!isFinish) return;
    try {
      const saved = window.localStorage.getItem(filterStorageKey);
      if (!saved) return;
      // Selections used to be a single category id stored as a bare string, so
      // a phone that still holds one keeps its choice instead of losing it.
      const parsed: unknown = saved.startsWith('[') ? JSON.parse(saved) : [saved];
      if (Array.isArray(parsed)) setCategoryIds(parsed.filter((v): v is string => typeof v === 'string'));
    } catch {
      // Private mode / blocked storage / unreadable value — start on "all".
    }
  }, [isFinish, filterStorageKey]);

  const remember = (ids: string[]) => {
    try {
      if (ids.length) window.localStorage.setItem(filterStorageKey, JSON.stringify(ids));
      else window.localStorage.removeItem(filterStorageKey);
    } catch {
      // Not being able to remember the choice doesn't stop them using it now.
    }
  };

  // Keep the timekeeper's device awake while this station is live, so it never
  // locks between athletes and forces a password unlock mid-stamp.
  useWakeLock(active);

  // What the station shows: the live list with the just-stamped competitors put
  // back in their own place. Recomputed on every render, so the quarter-second
  // clock tick is also what drops a competitor whose window has just closed.
  const heldOnScreen = held.filter(canStillUndo);
  const shown = isFinish
    ? entries
    : [...entries.filter((e) => !heldOnScreen.some((h) => h.id === e.id)), ...heldOnScreen].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );

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

  // Selected categories that have since left the list would hide everything with
  // no way back, so only the ones still on screen count. An empty selection
  // means "show everything", which is also what the "all" chip sets.
  const selectedIds = useMemo(
    () => categoryIds.filter((id) => categories.some((c) => c.id === id)),
    [categoryIds, categories]
  );
  const isSelected = (id: string) => selectedIds.includes(id);

  // Chips toggle, so one timekeeper can cover two or three races at once.
  const toggleCategory = (id: string) => {
    const next = isSelected(id) ? selectedIds.filter((c) => c !== id) : [...selectedIds, id];
    setCategoryIds(next);
    remember(next);
  };

  const showAllCategories = () => {
    setCategoryIds([]);
    remember([]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shown.filter((e) => {
      if (selectedIds.length > 0 && !selectedIds.includes(e.categoryId)) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.members.some((m) => m.name.toLowerCase().includes(q));
    });
  }, [shown, query, selectedIds]);

  const waitingShown = filtered.filter((e) => !e.stampedAt).length;
  const doneShown = filtered.length - waitingShown;
  // Competitors the category filter is holding back — worth saying out loud, so
  // nobody is left un-stamped because they were filtered off the screen.
  const hiddenWaiting =
    selectedIds.length > 0
      ? entries.filter((e) => !e.stampedAt && !selectedIds.includes(e.categoryId)).length
      : 0;

  const afterStamp = (entry: Entry, atMs: number | undefined, displayName: string) => {
    const at = new Date(atMs ?? serverNow());
    const stamped = { ...entry, stampedAt: at.toISOString() };
    if (isFinish) {
      // Finish line: keep them exactly where they are and just mark them done,
      // so the list never reshuffles under the timekeeper.
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? stamped : e)));
    } else {
      // Swim/bike: they are off the working list, but stay on screen in their
      // own place until the undo window closes — the card carries the time and
      // the Undo, so the list underneath stays readable and tappable.
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setHeld((prev) => [...prev.filter((e) => e.id !== entry.id), stamped]);
    }
    setManualFor(null);
    setAnnouncement(t('stamped', { name: displayName, time: formatClock(at, locale) }));
  };

  // An open relay leg is stored as a placeholder name, which is no use as the
  // headline — fall back to the entry's own name for those.
  const realName = (name: string | undefined) => {
    const trimmed = (name ?? '').trim();
    return trimmed && trimmed !== '—' && trimmed !== '?' ? trimmed : null;
  };

  // On the finish line the person crossing is the runner, so the toast/name a
  // timekeeper reads back should be the runner, not the whole team.
  const primaryName = (entry: Entry) => {
    if (!isFinish) return entry.name;
    return realName(entry.members.find((m) => m.leg === 'RUN')?.name) ?? entry.name;
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
        // Straight back to waiting: the finish line already has their card, and
        // at the swim/bike stations it returns from the held set to its place.
        const heldBack = held.find((e) => e.id === entryId);
        setHeld((prev) => prev.filter((e) => e.id !== entryId));
        setEntries((prev) =>
          prev.some((e) => e.id === entryId)
            ? prev.map((e) => (e.id === entryId ? { ...e, stampedAt: null } : e))
            : heldBack
              ? [...prev, { ...heldBack, stampedAt: null }]
              : prev
        );
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

  // The lottery names a relay entry after its own members ("swimmer / biker /
  // runner"), so printing that under the runner just repeats all three names and
  // competes with the one name the finish line cares about. Only show the entry
  // name when a human has given the team a name of their own.
  const isAutoTeamName = (entry: Entry) => {
    const parts = entry.name.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return false;
    const memberNames = new Set(entry.members.map((m) => m.name.trim()));
    return parts.every((p) => memberNames.has(p));
  };

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

      {/* Finish line only: a volunteer narrows the list to the races they're
          covering — tapping more than one chip adds them together. */}
      {isFinish && categories.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-light">{t('filterByCategory')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={showAllCategories}
              aria-pressed={selectedIds.length === 0}
              className={`cat-chip rounded-full px-3 py-1.5 text-sm font-semibold ${
                selectedIds.length === 0 ? '' : 'text-ink'
              }`}
            >
              {t('allCategories')}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                aria-pressed={isSelected(c.id)}
                className={`cat-chip rounded-full px-3 py-1.5 text-sm font-semibold ${categoryColorClass(c.key)} ${
                  isSelected(c.id) ? '' : 'text-ink'
                }`}
              >
                {isSelected(c.id) ? '✓ ' : ''}
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
        <p className="text-ink-light">{selectedIds.length > 0 ? t('noEntriesInCategory') : t('noEntries')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((e) => {
          // Finish line: the runner is the headline; the team name and the other
          // two members are shown small so the timekeeper stamps the runner and
          // isn't confused by an earlier-leg member wandering past the line.
          // The finish line is the runner's line: their name is the headline and the
          // rest of the relay is supporting detail underneath, in small type.
          const runnerName = isFinish ? realName(e.members.find((m) => m.leg === 'RUN')?.name) : null;
          const otherMembers = isFinish ? e.members.filter((m) => m.leg !== 'RUN') : [];
          const headline = runnerName ?? e.name;
          // Shown only when it adds something the headline and the legs don't.
          const teamName = runnerName && !isAutoTeamName(e) ? e.name : null;
          // Already recorded: the card stays in place and goes grey instead of
          // vanishing, so the timekeeper can see who they've already taken.
          const stampedMs = e.stampedAt ? new Date(e.stampedAt).getTime() : null;
          const done = stampedMs != null;
          const canUndo = stampedMs != null && serverNow() - stampedMs < UNDO_WINDOW_MS;
          return (
            <div
              key={e.id}
              className={`rounded-2xl p-4 shadow-sm ${isFinish ? `cat-card ${categoryColorClass(e.categoryKey)}` : 'bg-surface'} ${
                done ? (canUndo ? 'ring-2 ring-ink/30' : 'opacity-70') : ''
              }`}
            >
              <div className="text-xs text-ink-light">
                {locale === 'he' ? e.categoryNameHe : e.categoryNameEn} · {formatHeatName(e.heatName, locale)}
              </div>
              <div className={`mt-0.5 text-xl font-bold ${done ? 'text-ink-light' : ''}`}>{headline}</div>
              {isFinish && (teamName || otherMembers.length > 0) && (
                <div className="mt-0.5 space-y-0.5 text-xs text-ink-light">
                  {teamName && <div className="font-medium">{teamName}</div>}
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
                  <span className={`font-semibold tabular-nums ${canUndo ? 'text-ink' : 'text-ink-light'}`}>
                    ✓ {t('finishedAt', { time: formatClock(new Date(stampedMs as number), locale) })}
                  </span>
                  {canUndo && (
                    <button
                      onClick={() => handleUndo(e.id)}
                      disabled={isPending}
                      className="rounded-full border-2 border-ink/30 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:opacity-50"
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

      {/* The stamp is confirmed on the competitor's own card, where the tap was.
          Screen readers get the same confirmation here, and nothing is drawn
          over the list — a banner used to sit across the bottom of the screen
          and hide whoever was there, so the next competitor to arrive couldn't
          be found or stamped. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
