'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createHeatForCategory, stampHeatStart, undoHeatStart } from '@/actions/heats';
import { addRaceEntry, moveEntry, removeRaceEntry, renameEntry, renameMember, setEntryScratched } from '@/actions/entries';
import { formatClock, formatDuration, formatHeatName } from '@/lib/time';

type Member = { id: string; name: string; leg: string | null };
type Entry = { id: string; name: string; scratched: boolean; done: boolean; members: Member[] };
type Heat = {
  id: string;
  name: string;
  categoryNameEn: string;
  categoryNameHe: string;
  startTime: string | null;
  entries: Entry[];
};
type HeatOption = { id: string; name: string; categoryNameEn: string; categoryNameHe: string };
type Category = { id: string; nameEn: string; nameHe: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const serverNow = () => Date.now() + offsetRef.current;
  const upcoming = useMemo(() => heats.filter((h) => !h.startTime), [heats]);
  const running = useMemo(() => heats.filter((h) => h.startTime), [heats]);

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
      await moveEntry(entryId, targetHeatId);
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
      await addRaceEntry(heatId, name);
      setAddName((p) => ({ ...p, [heatId]: '' }));
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

  const handleGo = (heat: Heat) => {
    // Capture the true GO instant (server-aligned) up front, so any retry after a
    // network blip still records the real gun time — not the retry moment.
    const pressMs = serverNow();
    setStarting((prev) => new Set(prev).add(heat.id));
    (async () => {
      let ok = false;
      for (let attempt = 0; attempt < 6 && !ok; attempt++) {
        try {
          const r = await stampHeatStart(heat.id, pressMs);
          if (r?.ok) ok = true;
        } catch {
          await sleep(Math.min(1000 * (attempt + 1), 4000));
        }
      }
      setStarting((prev) => {
        const next = new Set(prev);
        next.delete(heat.id);
        return next;
      });
      toggleArmed(heat.id, false);
      load();
    })();
  };

  const handleUndo = (heat: Heat) => {
    startTransition(async () => {
      await undoHeatStart(heat.id);
      load();
    });
  };

  if (!active) return <p className="text-ink-light">{t('notActiveYet')}</p>;

  const legLabel = (leg: string | null) =>
    leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : '';

  return (
    <div className="space-y-8">
      {running.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('running')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {running.map((h) => {
              const startMs = new Date(h.startTime as string).getTime();
              const elapsed = Math.max(0, serverNow() - startMs);
              const canUndo = elapsed < 15_000;
              return (
                <div key={h.id} className="rounded-2xl bg-ink p-5 text-cream shadow-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs opacity-80">{catName(h)}</span>
                    <span className="text-xs opacity-80">
                      {t('started', { time: formatClock(new Date(startMs), locale) })}
                    </span>
                  </div>
                  <div className="mt-1 font-bold">{formatHeatName(h.name, locale)}</div>
                  <div className="mt-2 font-mono text-5xl font-black tabular-nums tracking-tight">
                    {formatDuration(elapsed)}
                  </div>
                  {canUndo && (
                    <button onClick={() => handleUndo(h)} disabled={isPending} className="mt-2 text-sm underline opacity-90">
                      {tc('undo')}
                    </button>
                  )}
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
          {upcoming.map((h) => {
            const isArmed = armed.has(h.id);
            const isStarting = starting.has(h.id);
            const isEditing = editing.has(h.id);
            const moveTargets = allHeats.filter((o) => o.id !== h.id);
            return (
              <div key={h.id} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-ink-light">{catName(h)}</span>
                  <span className="text-lg font-bold">{formatHeatName(h.name, locale)}</span>
                </div>

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
                      <button onClick={() => toggleEditing(h.id)} className="shrink-0 text-xs font-semibold text-swim-dark underline">
                        {isEditing ? t('doneEditing') : t('editRoster')}
                      </button>
                    </div>

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
                          placeholder={t('addPlaceholder')}
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

                    <button
                      onClick={() => toggleArmed(h.id, true)}
                      className="mt-3 w-full rounded-full bg-ink px-6 py-3 font-semibold text-cream transition hover:brightness-95"
                    >
                      {t('confirmRoster')}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-sm font-medium text-ink-light">{t('armedHint')}</p>
                    <button
                      onClick={() => handleGo(h)}
                      className="w-full rounded-2xl bg-run py-10 text-6xl font-black tracking-widest text-white shadow-lg transition hover:brightness-95 active:scale-[0.98]"
                    >
                      {t('go')}
                    </button>
                    <button onClick={() => toggleArmed(h.id, false)} className="text-sm text-ink-light underline">
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
