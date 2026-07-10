'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatClock, formatDateTimeInputValue, israelInputToISO } from '@/lib/time';
import { setEntryTime } from '@/actions/entries';

export default function TimeFieldEditor({
  heatId,
  entryId,
  field,
  value,
}: {
  heatId: string;
  entryId: string;
  field: 'swimTime' | 'bikeTime' | 'runTime';
  value: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatDateTimeInputValue(value ? new Date(value) : null));
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(formatDateTimeInputValue(value ? new Date(value) : null));
          setEditing(true);
        }}
        className="tabular-nums underline decoration-dotted decoration-ink/40 underline-offset-4"
      >
        {value ? formatClock(new Date(value), locale) : t('noValue')}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input
        type="datetime-local"
        step="1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="rounded border border-ink/20 px-1 py-0.5 text-sm"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setEntryTime(locale, heatId, entryId, field, israelInputToISO(draft));
            setEditing(false);
          })
        }
        className="text-xs font-semibold text-swim-dark"
      >
        {t('save')}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setEntryTime(locale, heatId, entryId, field, '');
            setEditing(false);
          })
        }
        className="text-xs text-ink-light"
      >
        {t('clear')}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-light">
        {t('cancel')}
      </button>
    </span>
  );
}
