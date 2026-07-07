'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { stampHeatStart, undoHeatStart } from '@/actions/heats';
import { renameEntry, renameMember, setEntryScratched } from '@/actions/entries';
import { formatClock, formatDuration } from '@/lib/time';

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function StartStationView() {
  const locale = useLocale();
  const t = useTranslations('stationStart');
  const tc = useTranslations('common');

  const [heats, setHeats] = useState<Heat[]>([]);
  const [active, setActive] = useState(true);
  const [armed, setArmed] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState<Set<string>>(new Set());
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

  const toggleArmed = (heatId: string, on: boolean) =>
    setArmed((prev) => {
      const next = new Set(prev);
      if (on) next.add(heatId);
      else next.delete(heatId);
      return next;
    });

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

  const doRenameEntry = (entry: Entry) => {
    const name = window.prompt(t('namePrompt'), entry.name);
    if (name == null) return;
    startTransition(async () => {
      await renameEntry(entry.id, name);
      load();
    });
  };

  const doRenameMember = (member: Member) => {
    const name = window.prompt(t('namePrompt'), member.name);
    if (name == null) return;
    startTransition(async () => {
      await renameMember(member.id, name);
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

  const Roster = ({ heat }: { heat: Heat }) => (
    <ul className="divide-y divide-ink/10">
      {heat.entries.map((e) => (
        <li key={e.id} className={`flex items-start gap-3 py-2 ${e.scratched ? 'opacity-50' : ''}`}>
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
              onClick={() => doRenameEntry(e)}
              className={`text-start font-semibold ${e.scratched ? 'line-through' : ''}`}
            >
              {e.name}
            </button>
            {e.members.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-light">
                {e.members.map((m) => (
                  <button key={m.id} type="button" onClick={() => doRenameMember(m)} className="hover:underline">
                    {legLabel(m.leg)}: {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {e.scratched && <span className="shrink-0 text-xs font-medium text-run-dark">{t('scratched')}</span>}
        </li>
      ))}
    </ul>
  );

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
                    <span className="text-xs opacity-80">{locale === 'he' ? h.categoryNameHe : h.categoryNameEn}</span>
                    <span className="text-xs opacity-80">
                      {t('started', { time: formatClock(new Date(startMs), locale) })}
                    </span>
                  </div>
                  <div className="mt-1 font-bold">{h.name}</div>
                  <div className="mt-2 font-mono text-5xl font-black tabular-nums tracking-tight">
                    {formatDuration(elapsed)}
                  </div>
                  {canUndo && (
                    <button
                      onClick={() => handleUndo(h)}
                      disabled={isPending}
                      className="mt-2 text-sm underline opacity-90"
                    >
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
        <h2 className="text-lg font-semibold">{t('upcoming')}</h2>
        {upcoming.length === 0 && <p className="text-ink-light">{t('noHeats')}</p>}
        <div className="space-y-4">
          {upcoming.map((h) => {
            const isArmed = armed.has(h.id);
            const isStarting = starting.has(h.id);
            return (
              <div key={h.id} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-ink-light">{locale === 'he' ? h.categoryNameHe : h.categoryNameEn}</span>
                  <span className="text-lg font-bold">{h.name}</span>
                </div>

                {isStarting ? (
                  <div className="rounded-xl bg-run/10 px-4 py-6 text-center font-semibold text-run-dark">
                    {t('retrying')}
                  </div>
                ) : !isArmed ? (
                  <>
                    <p className="mb-1 text-sm font-medium">{t('rosterTitle')}</p>
                    <p className="mb-2 text-xs text-ink-light">{t('rosterHint')}</p>
                    <Roster heat={h} />
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
