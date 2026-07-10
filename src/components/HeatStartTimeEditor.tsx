'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatClock, formatDateTimeInputValue, israelInputToISO } from '@/lib/time';
import { setHeatStartTime } from '@/actions/heats';

export default function HeatStartTimeEditor({ heatId, value }: { heatId: string; value: string | null }) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatDateTimeInputValue(value ? new Date(value) : null));
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold tabular-nums">
          {value ? formatClock(new Date(value), locale) : t('notSet')}
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(formatDateTimeInputValue(value ? new Date(value) : null));
            setEditing(true);
          }}
          className="text-sm font-semibold underline"
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
