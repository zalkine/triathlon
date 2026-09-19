'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { addHeatToField, placeInHeat, placeWaitingCompetitors } from '@/actions/placement';
import { withCapacityConfirm } from '@/lib/confirmCapacity';
import { formatHeatName } from '@/lib/time';

type Item = {
  kind: 'GROUP' | 'SOLO';
  id: string;
  name: string;
  members: { leg: string; name: string }[];
  maybeAlreadyPlaced: boolean;
};
type Field = {
  id: string;
  name: string;
  heats: { id: string; name: string; count: number; waveId: string | null }[];
  items: Item[];
};

// Places waiting competitors into heats. Everything here only ever adds: no heat
// the admin arranged is rebuilt, renamed or reordered, so it is safe to use on a
// board laid out by hand.
export default function WaitingForHeatsControls({ fields }: { fields: Field[] }) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const legIcon = (leg: string) => (leg === 'SWIM' ? '🏊' : leg === 'BIKE' ? '🚴' : '🏃');

  const doPlaceAll = (fieldId?: string) => {
    startTransition(async () => {
      const result = await placeWaitingCompetitors(fieldId);
      if ('ok' in result && result.placed === 0) window.alert(t('waitingNonePlaced'));
      router.refresh();
    });
  };

  const doPlaceOne = (item: Item, heatId: string) => {
    if (!heatId) return;
    if (item.maybeAlreadyPlaced && !window.confirm(t('confirmPlaceDuplicate', { name: item.name }))) return;
    setBusy(item.id);
    startTransition(async () => {
      await withCapacityConfirm(
        (force) => placeInHeat(item.kind, item.id, heatId, force),
        (over) => tc('overCapacityConfirm', { total: over.total, capacity: over.capacity })
      );
      setBusy(null);
      router.refresh();
    });
  };

  const doAddHeat = (fieldId: string) => {
    startTransition(async () => {
      await addHeatToField(fieldId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => doPlaceAll()}
        disabled={isPending}
        className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-50"
      >
        {t('placeAllWaiting')}
      </button>

      {fields.map((field) => (
        <div key={field.id} className="rounded-xl border border-ink/15 bg-surface/80 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {field.name} <span className="font-normal text-ink-light">({field.items.length})</span>
            </h3>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => doAddHeat(field.id)}
                disabled={isPending}
                className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold hover:bg-ink/5 disabled:opacity-50"
              >
                + {t('newHeat')}
              </button>
              <button
                type="button"
                onClick={() => doPlaceAll(field.id)}
                disabled={isPending}
                className="text-xs font-semibold underline disabled:opacity-50"
              >
                {t('placeAllInField')}
              </button>
            </span>
          </div>

          <ul className="divide-y divide-ink/10">
            {field.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  {item.members.length > 0 ? (
                    <ul className="space-y-0.5 text-sm">
                      {item.members.map((m, i) => (
                        <li key={i} className="leading-tight">
                          <span className="me-1">{legIcon(m.leg)}</span>
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm font-medium">{item.name}</span>
                  )}
                  {item.maybeAlreadyPlaced && (
                    <p className="mt-0.5 text-xs font-medium text-run-dark">⚠ {t('maybeAlreadyPlaced')}</p>
                  )}
                </div>

                {field.heats.length > 0 ? (
                  <select
                    value=""
                    disabled={isPending || busy === item.id}
                    onChange={(e) => {
                      const heatId = e.target.value;
                      e.currentTarget.value = '';
                      doPlaceOne(item, heatId);
                    }}
                    className="shrink-0 rounded-lg border border-ink/20 bg-surface px-2 py-1 text-xs"
                  >
                    <option value="">{t('placeIntoHeat')}</option>
                    {field.heats.map((h) => (
                      <option key={h.id} value={h.id}>
                        {formatHeatName(h.name, locale)} ({h.count})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="shrink-0 text-xs text-ink-light">{t('noHeatsYetHint')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
