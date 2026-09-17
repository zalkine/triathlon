'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createHeatForCategory, stampHeatStart, undoHeatStart } from '@/actions/heats';
import { addRaceEntry, moveEntry, removeRaceEntry, renameEntry, renameMember, setEntryScratched } from '@/actions/entries';
import { formatClock, formatDuration, formatHeatName } from '@/lib/time';
import { withCapacityConfirm } from '@/lib/confirmCapacity';
import CancelHeatStartButton from '@/components/CancelHeatStartButton';
import { useWakeLock } from '@/lib/useWakeLock';

type Member = { id: string; name: string; leg: string | null };
type Entry = { id: string; name: string; scratched: boolean; done: boolean; stamps: number; members: Member[] };
type Heat = {
  id: string;
  name: string;
  categoryNameEn: string;
  categoryNameHe: string;
  waveId: string | null;
  startTime: string | null;
  entries: Entry[];
};
type HeatOption = { id: string; name: string; categoryNameEn: string; categoryNameHe: string };
type Category = { id: string; nameEn: string; nameHe: string };

// What the start line actually sends off. Usually a single heat, but when the
// admin has combined heats from different categories into one start, they are
// one wave here: one roster card, one GO, one clock. Every action below targets
// the wave's first heat — the server applies a start, undo or cancel to the
// whole wave — so a wave can never end up with two different gun times.
type Wave = { key: string; heats: Heat[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Group heats into waves, keeping the order the server sent them in. A heat
// with no waveId is a wave of one, so the uncombined flow is unchanged.
function toWaves(heats: Heat[]): Wave[] {
  const waves: Wave[] = [];
  const byKey = new Map<string, Wave>();
  for (const heat of heats) {
    const key = heat.waveId ?? heat.id;
    const existing = byKey.get(key);
    if (existing) {
      existing.heats.push(heat);
    } else {
      const wave = { key, heats: [heat] };
      byKey.set(key, wave);
      waves.push(wave);
    }
  }
  return waves;
}

export default function StartStationView() {
  const locale = useLocale();
  const t = useTranslations('stationStart');
  const tc = useTranslations('common');
  const catName = (c: { categoryNameEn: string; categoryNameHe: string }) =>
    locale === 'he' ? c.categoryNameHe : c.categoryNameEn;

  const [heats, setHeats] = useState<Heat[]>([]);
  const [allHeats, setAllHeats] = useState<HeatOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState(true);
  const [armed, setArmed] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [addName, setAddName] = useState<Record<string, string>>({});
  const [newHeatCat, setNewHeatCat] = useState('');
  const [, setTick] = useState(0);
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef(0); // serverNow - clientNow, to align the stopwatch across devices

  const load = useCallback(async () => {
    const res = await fetch('/api/stations/start', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.serverNow) offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    setActive(data.active);
    setHeats(data.heats ?? []);
    setAllHeats(data.allHeats ?? []);
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 2000);
    const clock = setInterval(() => setTick((n) => n + 1), 250);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  // Keep the start-line timekeeper's device awake while this station is live, so
  // it never locks while they wait for the gun and forces a password unlock.
  useWakeLock(active);

  const serverNow = () => Date.now() + offsetRef.current;
  const upcoming = useMemo(() => toWaves(heats.filter((h) => !h.startTime)), [heats]);
  const running = useMemo(() => toWaves(heats.filter((h) => h.startTime)), [heats]);

  const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    setter(next);
  };
  const toggleArmed = (id: string, on: boolean) => toggleSet(armed, setArmed, id, on);
  const toggleEditing = (id: string) => toggleSet(editing, setEditing, id, !editing.has(id));

  const togglePresent = (entry: Entry) => {
    startTransition(async () => {
      await setEntryScratched(entry.id, !entry.scratched);
      setHeats((prev) =>
        prev.map((h) => ({
          ...h,
          entries: h.entries.map((e) => (e.id === entry.id ? { ...e, scratched: !e.scratched } : e)),
        }))
      );
      load();
    });
  };

  const doRename = (fn: (id: string, name: string) => Promise<unknown>, id: string, current: string) => {
    const name = window.prompt(t('namePrompt'), current);
    if (name == null) return;
    startTransition(async () => {
      await fn(id, name);
      load();
    });
  };

  const doMove = (entryId: string, targetHeatId: string) => {
    if (!targetHeatId) return;
    startTransition(async () => {
      await withCapacityConfirm(
        (force) => moveEntry(entryId, targetHeatId, force),
        (over) => tc('overCapacityConfirm', { total: over.total, capacity: over.capacity })
      );
      load();
    });
  };

  const doRemove = (entry: Entry) => {
    if (!window.confirm(t('confirmRemove', { name: entry.name }))) return;
    startTransition(async () => {
      await removeRaceEntry(entry.id);
      load();
    });
  };

  const doAdd = (heatId: string) => {
    const name = (addName[heatId] ?? '').trim();
    if (!name) return;
    startTransition(async () => {
      const result = await withCapacityConfirm(
        (force) => addRaceEntry(heatId, name, force),
        (over) => tc('overCapacityConfirm', { total: over.total, capacity: over.capacity })
      );
      // Keep what they typed if they backed out of the over-capacity prompt.
      if (result && 'ok' in result) setAddName((p) => ({ ...p, [heatId]: '' }));
      load();
    });
  };

  const doCreateHeat = () => {
    if (!newHeatCat) return;
    startTransition(async () => {
      await createHeatForCategory(newHeatCat);
      setNewHeatCat('');
      load();
    });
  };

  const handleGo = (wave: Wave) => {
    // Capture the true GO instant (server-aligned) up front, so any retry after a
    // network blip still records the real gun time — not the retry moment. The
    // server stamps every heat of the wave with this one instant.
    const pressMs = serverNow();
    setStarting((prev) => new Set(prev).add(wave.key));
    (async () => {
      let ok = false;
      for (let attempt = 0; attempt < 6 && !ok; attempt++) {
        try {
          const r = await stampHeatStart(wave.heats[0].id, pressMs);
          if (r?.ok) ok = true;
        } catch {
          await sleep(Math.min(1000 * (attempt + 1), 4000));
        }
      }
      setStarting((prev) => {
        const next = new Set(prev);
        next.delete(wave.key);
        return next;
      });
      toggleArmed(wave.key, false);
      load();
    })();
  };

  const handleUndo = (wave: Wave) => {
    startTransition(async () => {
      await undoHeatStart(wave.heats[0].id);
      load();
    });
  };

  if (!active) return <p className="text-ink-light">{t('notActiveYet')}</p>;

  const legLabel = (leg: string | null) =>
    leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : '';

  // Leg times recorded anywhere in the wave — named in the cancel-start prompt,
  // since cancelling sends the whole wave back to the start line.
  const waveStamps = (wave: Wave) =>
    wave.heats.reduce((n, h) => n + h.entries.reduce((m, e) => m + (e.stamps ?? 0), 0), 0);

  // A combined wave is titled by its category names; a lone heat keeps the
  // familiar "category / Heat N" heading.
  const waveCategories = (wave: Wave) => [...new Set(wave.heats.map(catName))].join(' + ');
  const waveHeatNames = (wave: Wave) => wave.heats.map((h) => formatHeatName(h.name, locale)).join(' + ');

  return (
    <div className="space-y-8">
      {running.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t('running')}</h2>
            <p className="text-xs text-ink-light">{t('cancelStartHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {running.map((wave) => {
              const startMs = new Date(wave.heats[0].startTime as string).getTime();
              const elapsed = Math.max(0, serverNow() - startMs);
              const canUndo = elapsed < 15_000;
              const combined = wave.heats.length > 1;
              return (
                <div key={wave.key} className="rounded-2xl bg-ink p-5 text-cream shadow-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs opacity-80">{waveCategories(wave)}</span>
                    <span className="text-xs opacity-80">
                      {t('started', { time: formatClock(new Date(startMs), locale) })}
                    </span>
                  </div>
                  <div className="mt-1 font-bold">
                    {combined && <span className="me-1">🔗</span>}
                    {waveHeatNames(wave)}
                  </div>
                  <div className="mt-2 font-mono text-5xl font-black tabular-nums tracking-tight">
                    {formatDuration(elapsed)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {canUndo ? (
                      <button onClick={() => handleUndo(wave)} disabled={isPending} className="text-sm underline opacity-90">
                        {tc('undo')}
                      </button>
                    ) : (
                      <span />
                    )}
                    {/* Escape hatch beyond the quick-undo window: wind this wave's
                        clock back so it can be sent off again. */}
                    <CancelHeatStartButton
                      heatId={wave.heats[0].id}
                      stampedTimes={waveStamps(wave)}
                      onCancelled={load}
                      className="rounded-full border border-cream/40 px-3 py-1 text-xs font-semibold text-cream hover:bg-cream/10"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('upcoming')}</h2>
          {/* New heat on the spot */}
          <div className="flex items-center gap-2">
            <select
              value={newHeatCat}
              onChange={(e) => setNewHeatCat(e.target.value)}
              className="rounded-lg border border-ink/20 px-2 py-1.5 text-sm"
            >
              <option value="">{t('pickCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'he' ? c.nameHe : c.nameEn}
                </option>
              ))}
            </select>
            <button
              onClick={doCreateHeat}
              disabled={isPending || !newHeatCat}
              className="rounded-full border border-ink/30 px-3 py-1.5 text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
            >
              + {t('newHeat')}
            </button>
          </div>
        </div>

        {upcoming.length === 0 && <p className="text-ink-light">{t('noHeats')}</p>}

        <div className="space-y-4">
          {upcoming.map((wave) => {
            const isArmed = armed.has(wave.key);
            const isStarting = starting.has(wave.key);
            const isEditing = editing.has(wave.key);
            const combined = wave.heats.length > 1;
            const liveCount = wave.heats.reduce((n, h) => n + h.entries.filter((e) => !e.scratched).length, 0);
            return (
              <div
                key={wave.key}
                className={`rounded-2xl border bg-surface p-5 shadow-sm ${
                  combined ? 'border-swim-dark/50' : 'border-ink/10'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs text-ink-light">{waveCategories(wave)}</span>
                  <span className="text-lg font-bold">
                    {combined && <span className="me-1">🔗</span>}
                    {waveHeatNames(wave)}
                  </span>
                </div>

                {/* A combined start is unusual enough to say out loud, so the
                    timekeeper knows this one GO sends every listed race off. */}
                {combined && (
                  <p className="mb-3 rounded-lg bg-swim/15 px-3 py-1.5 text-xs font-medium text-swim-dark">
                    🔗 {t('combinedStartHint', { count: wave.heats.length, competitors: liveCount })}
                  </p>
                )}

                {isStarting ? (
                  <div className="rounded-xl bg-run/10 px-4 py-6 text-center font-semibold text-run-dark">
                    {t('retrying')}
                  </div>
                ) : !isArmed ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{t('rosterTitle')}</p>
                        <p className="text-xs text-ink-light">{t('rosterHint')}</p>
                      </div>
                      <button onClick={() => toggleEditing(wave.key)} className="shrink-0 text-xs font-semibold text-swim-dark underline">
                        {isEditing ? t('doneEditing') : t('editRoster')}
                      </button>
                    </div>

                    {wave.heats.map((h) => {
                      const moveTargets = allHeats.filter((o) => o.id !== h.id);
                      return (
                        <div key={h.id}>
                          {/* Inside a combined start each race keeps its own
                              heading, so the timekeeper can still tell who is
                              swimming which race. */}
                          {combined && (
                            <p className="mt-3 border-b border-ink/10 pb-1 text-xs font-semibold text-ink-light">
                              {catName(h)} · {formatHeatName(h.name, locale)}
                            </p>
                          )}

                          <ul className="divide-y divide-ink/10">
                            {h.entries.map((e) => (
                              <li key={e.id} className={`py-2 ${e.scratched ? 'opacity-50' : ''}`}>
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-5 w-5 shrink-0"
                                    checked={!e.scratched}
                                    onChange={() => togglePresent(e)}
                                    disabled={isPending}
                                    aria-label={t('present')}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => doRename(renameEntry, e.id, e.name)}
                                      className={`text-start font-semibold ${e.scratched ? 'line-through' : ''}`}
                                    >
                                      {e.name}
                                    </button>
                                    {e.members.length > 0 && (
                                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-light">
                                        {e.members.map((m) => (
                                          <button key={m.id} type="button" onClick={() => doRename(renameMember, m.id, m.name)} className="hover:underline">
                                            {legLabel(m.leg)}: {m.name}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {e.scratched && <span className="shrink-0 text-xs font-medium text-run-dark">{t('scratched')}</span>}
                                </div>

                                {isEditing && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2 ps-8">
                                    <select
                                      value=""
                                      onChange={(ev) => doMove(e.id, ev.target.value)}
                                      disabled={isPending}
                                      className="rounded-lg border border-ink/20 px-2 py-1 text-xs"
                                    >
                                      <option value="">{t('moveTo')}</option>
                                      {moveTargets.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {catName(o)} · {formatHeatName(o.name, locale)}
                                        </option>
                                      ))}
                                    </select>
                                    <button onClick={() => doRemove(e)} disabled={isPending} className="text-xs font-semibold text-run-dark underline">
                                      {t('removeEntry')}
                                    </button>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>

                          {isEditing && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={addName[h.id] ?? ''}
                                onChange={(ev) => setAddName((p) => ({ ...p, [h.id]: ev.target.value }))}
                                onKeyDown={(ev) => ev.key === 'Enter' && doAdd(h.id)}
                                placeholder={combined ? t('addPlaceholderTo', { heat: formatHeatName(h.name, locale) }) : t('addPlaceholder')}
                                className="flex-1 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
                              />
                              <button
                                onClick={() => doAdd(h.id)}
                                disabled={isPending || !(addName[h.id] ?? '').trim()}
                                className="rounded-full border border-ink/30 px-3 py-1.5 text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
                              >
                                + {t('addCompetitor')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      onClick={() => toggleArmed(wave.key, true)}
                      className="mt-3 w-full rounded-full bg-ink px-6 py-3 font-semibold text-cream transition hover:brightness-95"
                    >
                      {t('confirmRoster')}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-sm font-medium text-ink-light">{t('armedHint')}</p>
                    <button
                      onClick={() => handleGo(wave)}
                      className="w-full rounded-2xl bg-run py-10 text-6xl font-black tracking-widest text-white shadow-lg transition hover:brightness-95 active:scale-[0.98]"
                    >
                      {t('go')}
                    </button>
                    <button onClick={() => toggleArmed(wave.key, false)} className="text-sm text-ink-light underline">
                      {t('backToRoster')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
