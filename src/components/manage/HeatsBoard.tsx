'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { moveEntry } from '@/actions/entries';
import { combineHeats, createHeatForCategory, removeHeat, removeHeatFromWave, splitWave } from '@/actions/heats';
import { formatClock, formatHeatName } from '@/lib/time';
import { withCapacityConfirm } from '@/lib/confirmCapacity';
import CancelHeatStartButton from '@/components/CancelHeatStartButton';

export type BoardMember = { id: string; name: string; leg: string | null };
export type BoardEntry = { id: string; name: string; members: BoardMember[] };
export type BoardHeat = {
  id: string;
  name: string;
  /** ISO start time once the heat has been sent off, else null. */
  startTime: string | null;
  /** Leg times recorded in this heat — shown in the cancel-start confirmation. */
  stampedTimes: number;
  /** Set when this heat is combined with others into a single start. */
  waveId: string | null;
  entries: BoardEntry[];
};
export type BoardCategory = { id: string; nameEn: string; nameHe: string; heats: BoardHeat[] };
/** One combined start: its display number and the heats that go off together. */
export type BoardWave = {
  id: string;
  number: number;
  heats: { id: string; name: string; categoryNameEn: string; categoryNameHe: string }[];
};

// Admin heats organiser. Every heat in a category is shown side by side (they
// wrap onto the next row on narrow screens), and competitors are moved between
// heats by dragging their chip onto another heat — or, on touch devices, via
// the small "move to" menu on each chip. No drilling into a per-heat page.
//
// Ticking heats across categories and combining them makes them one wave: they
// keep their own rosters and their own results, but the start line sends them
// off together with one GO, so two thin categories can fill the pool in a
// single dip instead of swimming three-to-a-pool twice.
export default function HeatsBoard({ categories, waves }: { categories: BoardCategory[]; waves: BoardWave[] }) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragEntry, setDragEntry] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const catName = (c: { nameEn: string; nameHe: string }) => (locale === 'he' ? c.nameHe : c.nameEn);
  const heatLabel = (h: { categoryNameEn: string; categoryNameHe: string; name: string }) =>
    `${locale === 'he' ? h.categoryNameHe : h.categoryNameEn} · ${formatHeatName(h.name, locale)}`;
  const legIcon = (leg: string | null) =>
    leg === 'SWIM' ? '🏊' : leg === 'BIKE' ? '🚴' : leg === 'RUN' ? '🏃' : '';
  const legName = (leg: string | null) =>
    leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : '';

  const waveById = new Map(waves.map((w) => [w.id, w]));

  // Dropping someone into a heat that is already at the pool's lane count asks
  // first — over-filling stays possible, it just isn't silent.
  const doMove = (entryId: string, targetHeatId: string) => {
    startTransition(async () => {
      await withCapacityConfirm(
        (force) => moveEntry(entryId, targetHeatId, force),
        (over) => tc('overCapacityConfirm', { total: over.total, capacity: over.capacity })
      );
      router.refresh();
    });
  };

  const doCreateHeat = (categoryId: string) => {
    startTransition(async () => {
      await createHeatForCategory(categoryId);
      router.refresh();
    });
  };

  const doDeleteHeat = (heat: BoardHeat) => {
    const msg = heat.entries.length > 0 ? t('confirmDeleteHeat') : t('confirmDeleteEmptyHeat');
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      await removeHeat(heat.id);
      router.refresh();
    });
  };

  const toggleSelected = (heatId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(heatId)) next.delete(heatId);
      else next.add(heatId);
      return next;
    });
  };

  // Combine the ticked heats. The server caps a wave at the pool's lane count;
  // when it reports the selection is over that, the admin is asked once and can
  // go ahead anyway (they may know some of those competitors won't be there).
  const doCombine = () => {
    const ids = [...selected];
    startTransition(async () => {
      const first = await combineHeats(ids);
      if ('ok' in first && first.ok) {
        setSelected(new Set());
        router.refresh();
        return;
      }
      if (first.error === 'over-capacity') {
        if (!window.confirm(t('combineOverCapacity', { total: first.total, capacity: first.capacity }))) return;
        const forced = await combineHeats(ids, true);
        if ('ok' in forced && forced.ok) {
          setSelected(new Set());
          router.refresh();
        }
        return;
      }
      window.alert(first.error === 'already-started' ? t('combineStartedError') : t('combineFailed'));
    });
  };

  const doSplit = (waveId: string) => {
    if (!window.confirm(t('confirmSplitWave'))) return;
    startTransition(async () => {
      await splitWave(waveId);
      router.refresh();
    });
  };

  const doLeaveWave = (heatId: string) => {
    startTransition(async () => {
      await removeHeatFromWave(heatId);
      router.refresh();
    });
  };

  if (categories.every((c) => c.heats.length === 0)) {
    return <p className="text-sm text-ink-light">{t('noHeats')}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Combined-start toolbar: explains the feature, and turns into the combine
          action as soon as the admin ticks heats. */}
      <div className="sticky top-2 z-10 rounded-2xl border border-ink/10 bg-surface/95 p-4 shadow-sm backdrop-blur">
        <h3 className="font-semibold">{t('combinedStartsTitle')}</h3>
        <p className="mt-1 text-sm text-ink-light">{t('combinedStartsHint')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t('heatsSelected', { count: selected.size })}</span>
          <button
            type="button"
            onClick={doCombine}
            disabled={isPending || selected.size < 2}
            className="rounded-full bg-swim px-4 py-1.5 text-sm font-semibold text-ink hover:brightness-95 disabled:opacity-40"
          >
            🔗 {t('combineSelected')}
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-sm underline">
              {t('clearSelection')}
            </button>
          )}
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">{catName(cat)}</h3>
            <button
              type="button"
              onClick={() => doCreateHeat(cat.id)}
              disabled={isPending}
              className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold hover:bg-ink/5 disabled:opacity-50"
            >
              + {t('newHeat')}
            </button>
          </div>

          {cat.heats.length === 0 ? (
            <p className="text-sm text-ink-light">{t('noHeats')}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {cat.heats.map((heat) => {
                const moveTargets = cat.heats.filter((h) => h.id !== heat.id);
                const isTarget = dropTarget === heat.id;
                const wave = heat.waveId ? waveById.get(heat.waveId) : undefined;
                const partners = wave?.heats.filter((h) => h.id !== heat.id) ?? [];
                return (
                  <div
                    key={heat.id}
                    onDragOver={(e) => {
                      if (dragEntry) {
                        e.preventDefault();
                        setDropTarget(heat.id);
                      }
                    }}
                    onDragLeave={() => setDropTarget((cur) => (cur === heat.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const entryId = e.dataTransfer.getData('text/entry-id') || dragEntry;
                      setDropTarget(null);
                      setDragEntry(null);
                      if (entryId && !heat.entries.some((en) => en.id === entryId)) {
                        doMove(entryId, heat.id);
                      }
                    }}
                    className={`flex w-full flex-col rounded-xl border p-3 transition sm:w-56 ${
                      isTarget
                        ? 'border-swim-dark bg-swim/10'
                        : selected.has(heat.id)
                          ? 'border-swim-dark bg-swim/5'
                          : 'border-ink/15 bg-cream/40'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="flex min-w-0 items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0"
                          checked={selected.has(heat.id)}
                          onChange={() => toggleSelected(heat.id)}
                          disabled={isPending || !!heat.startTime}
                          aria-label={t('selectForCombinedStart')}
                          title={t('selectForCombinedStart')}
                        />
                        <span className="truncate text-sm font-bold">{formatHeatName(heat.name, locale)}</span>
                      </label>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-ink-light">{heat.entries.length}</span>
                        <button
                          type="button"
                          onClick={() => doDeleteHeat(heat)}
                          disabled={isPending}
                          className="text-xs text-run-dark hover:underline disabled:opacity-50"
                          aria-label={t('deleteHeat')}
                          title={t('deleteHeat')}
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    {wave && (
                      <div className="mb-2 rounded-lg bg-swim/15 px-2 py-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-swim-dark">
                            🔗 {t('combinedStartNumber', { number: wave.number })}
                          </span>
                          <button
                            type="button"
                            onClick={() => (partners.length > 1 ? doLeaveWave(heat.id) : doSplit(wave.id))}
                            disabled={isPending}
                            className="text-xs font-semibold text-swim-dark underline disabled:opacity-50"
                          >
                            {partners.length > 1 ? t('leaveCombinedStart') : t('splitCombinedStart')}
                          </button>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-tight text-ink-light">
                          {t('startsWith')}: {partners.map(heatLabel).join(' · ')}
                        </p>
                      </div>
                    )}

                    {heat.startTime && (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-run/10 px-2 py-1">
                        <span className="text-xs font-medium text-run-dark">
                          ▶ {t('startedAtLabel', { time: formatClock(new Date(heat.startTime), locale) })}
                        </span>
                        <CancelHeatStartButton
                          heatId={heat.id}
                          stampedTimes={heat.stampedTimes}
                          className="text-xs font-semibold text-run-dark underline"
                        />
                      </div>
                    )}

                    {heat.entries.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-ink/15 px-2 py-4 text-center text-xs text-ink-light">
                        {t('dropHere')}
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {heat.entries.map((entry) => (
                          <li
                            key={entry.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/entry-id', entry.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setDragEntry(entry.id);
                            }}
                            onDragEnd={() => {
                              setDragEntry(null);
                              setDropTarget(null);
                            }}
                            className={`group flex items-start justify-between gap-1 rounded-lg border border-ink/10 bg-surface px-2 py-1.5 text-sm shadow-sm ${
                              isPending ? '' : 'cursor-grab active:cursor-grabbing'
                            } ${dragEntry === entry.id ? 'opacity-40' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              {entry.members.length > 0 ? (
                                <ul className="space-y-0.5">
                                  {entry.members.map((m) => (
                                    <li key={m.id} className="break-words leading-tight">
                                      {m.leg && (
                                        <span className="me-1" aria-label={legName(m.leg)} title={legName(m.leg)}>
                                          {legIcon(m.leg)}
                                        </span>
                                      )}
                                      {m.name}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="break-words">{entry.name}</span>
                              )}
                            </div>
                            {moveTargets.length > 0 && (
                              <select
                                value=""
                                disabled={isPending}
                                onChange={(ev) => {
                                  const target = ev.target.value;
                                  ev.currentTarget.value = '';
                                  if (target) doMove(entry.id, target);
                                }}
                                aria-label={t('moveTo')}
                                title={t('moveTo')}
                                className="shrink-0 rounded border border-ink/15 bg-transparent px-1 py-0.5 text-xs text-ink-light"
                              >
                                <option value="">⇄</option>
                                {moveTargets.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {formatHeatName(h.name, locale)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
