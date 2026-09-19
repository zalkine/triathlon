'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatClock, formatDateTimeInputValue, israelInputToISO } from '@/lib/time';
import { setHeatStartTime } from '@/actions/heats';

/**
 * Edits the clock a heat was sent off by — and with it every total measured
 * against that start, since a result is finish minus start. A heat combined
 * with others into one start is edited as a whole (`setHeatStartTime` follows
 * the wave), because they left on a single gun.
 *
 * `size` is the only difference between the heat's own page, where this is the
 * headline control, and the results review, where one sits beside each heat
 * name in a row of them.
 */
export default function HeatStartTimeEditor({
  heatId,
  value,
  size = 'lg',
}: {
  heatId: string;
  value: string | null;
  size?: 'lg' | 'sm';
}) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatDateTimeInputValue(value ? new Date(value) : null));
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className={`flex items-center ${size === 'lg' ? 'gap-3' : 'gap-2'}`}>
        <span className={`tabular-nums ${size === 'lg' ? 'text-lg font-semibold' : 'text-sm font-medium'}`}>
          {value ? formatClock(new Date(value), locale) : t('notSet')}
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(formatDateTimeInputValue(value ? new Date(value) : null));
            setEditing(true);
          }}
          className={`font-semibold underline ${size === 'lg' ? 'text-sm' : 'text-xs'}`}
        >
          {t('edit')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="datetime-local"
        step="1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="rounded border border-ink/20 px-2 py-1"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setHeatStartTime(locale, heatId, israelInputToISO(draft));
            setEditing(false);
          })
        }
        className="text-sm font-semibold text-swim-dark"
      >
        {t('save')}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setHeatStartTime(locale, heatId, '');
            setEditing(false);
          })
        }
        className="text-sm text-ink-light"
      >
        {t('clear')}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-sm text-ink-light">
        {t('cancel')}
      </button>
    </div>
  );
}
