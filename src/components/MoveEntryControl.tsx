'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { moveEntry } from '@/actions/entries';
import { withCapacityConfirm } from '@/lib/confirmCapacity';

type HeatOption = { id: string; name: string; nameEn: string; nameHe: string };

// Admin heat page: move a competitor to another heat (including a different race
// type). Server action revalidates, so the entry disappears from this heat.
export default function MoveEntryControl({ entryId, heats }: { entryId: string; heats: HeatOption[] }) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const tc = useTranslations('common');
  const [pending, start] = useTransition();

  if (heats.length === 0) return null;
  return (
    <select
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const target = e.target.value;
        e.currentTarget.value = '';
        if (target)
          start(async () => {
            await withCapacityConfirm(
              (force) => moveEntry(entryId, target, force),
              (over) => tc('overCapacityConfirm', { total: over.total, capacity: over.capacity })
            );
          });
      }}
      className="rounded-lg border border-ink/20 px-2 py-1 text-sm disabled:opacity-50"
    >
      <option value="">{t('moveTo')}</option>
      {heats.map((h) => (
        <option key={h.id} value={h.id}>
          {(locale === 'he' ? h.nameHe : h.nameEn)} · {h.name}
        </option>
      ))}
    </select>
  );
}
