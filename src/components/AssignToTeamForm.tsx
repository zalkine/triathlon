'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { addRegistrantToEntry } from '@/actions/event';
import type { Leg } from '@/lib/constants';

type Option = { entryId: string; entryName: string; leg: Leg };

export default function AssignToTeamForm({
  locale,
  registrantId,
  options,
}: {
  locale: string;
  registrantId: string;
  options: Option[];
}) {
  const t = useTranslations('manage');
  const [value, setValue] = useState(options[0] ? `${options[0].entryId}::${options[0].leg}` : '');
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (options.length === 0 || done) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-ink/20 px-2 py-1 text-sm"
      >
        {options.map((o) => (
          <option key={`${o.entryId}-${o.leg}`} value={`${o.entryId}::${o.leg}`}>
            {o.entryName} — {o.leg}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const [entryId, leg] = value.split('::');
          startTransition(async () => {
            await addRegistrantToEntry(locale, registrantId, entryId, leg as Leg);
            setDone(true);
          });
        }}
        className="text-xs font-semibold underline"
      >
        {t('addToTeam')}
      </button>
    </div>
  );
}
