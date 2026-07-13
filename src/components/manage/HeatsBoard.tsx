'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { moveEntry } from '@/actions/entries';
import { createHeatForCategory, removeHeat } from '@/actions/heats';
import { formatHeatName } from '@/lib/time';

export type BoardMember = { id: string; name: string; leg: string | null };
export type BoardEntry = { id: string; name: string; members: BoardMember[] };
export type BoardHeat = { id: string; name: string; entries: BoardEntry[] };
export type BoardCategory = { id: string; nameEn: string; nameHe: string; heats: BoardHeat[] };

// Admin heats organiser. Every heat in a category is shown side by side (they
// wrap onto the next row on narrow screens), and competitors are moved between
// heats by dragging their chip onto another heat — or, on touch devices, via
// the small "move to" menu on each chip. No drilling into a per-heat page.
export default function HeatsBoard({ categories }: { categories: BoardCategory[] }) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragEntry, setDragEntry] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const catName = (c: BoardCategory) => (locale === 'he' ? c.nameHe : c.nameEn);
  const legIcon = (leg: string | null) =>
    leg === 'SWIM' ? '🏊' : leg === 'BIKE' ? '🚴' : leg === 'RUN' ? '🏃' : '';
  const legName = (leg: string | null) =>
    leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : '';

  const doMove = (entryId: string, targetHeatId: string) => {
    startTransition(async () => {
      await moveEntry(entryId, targetHeatId);
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

  if (categories.every((c) => c.heats.length === 0)) {
    return <p className="text-sm text-ink-light">{t('noHeats')}</p>;
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
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
                      isTarget ? 'border-swim-dark bg-swim/10' : 'border-ink/15 bg-cream/40'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{formatHeatName(heat.name, locale)}</span>
                      <span className="flex items-center gap-2">
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
                            className={`group flex items-start justify-between gap-1 rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm shadow-sm ${
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
