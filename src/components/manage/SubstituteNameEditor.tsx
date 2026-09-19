'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { substituteCompetitor } from '@/actions/entries';

/**
 * Records a stand-in on the results review table: tap a name, type whoever
 * actually raced. One editor per solo competitor (`memberId` null) or per relay
 * leg, so a relay's three legs are replaced independently and the team name
 * follows on its own.
 *
 * The ranking is re-read from the server afterwards rather than patched here —
 * the swap also moves the roster behind the entry, so the whole panel refreshes.
 */
export default function SubstituteNameEditor({
  entryId,
  memberId = null,
  name,
  legLabel,
}: {
  entryId: string;
  memberId?: string | null;
  name: string;
  legLabel?: string;
}) {
  const t = useTranslations('manage');
  const tr = useTranslations('register');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError('');
    startTransition(async () => {
      const result = await substituteCompetitor(entryId, memberId, draft);
      if ('error' in result && result.error) {
        setError(result.error === 'name-letters-only' ? tr('errorNameLettersOnly') : tr('errorInvalid'));
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setError('');
          setEditing(true);
        }}
        title={t('substituteHint')}
        className="text-start underline decoration-dotted decoration-ink/40 underline-offset-4"
      >
        {legLabel ? <span className="text-ink-light">{legLabel}: </span> : null}
        {name}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {legLabel ? <span className="text-xs text-ink-light">{legLabel}</span> : null}
      <input
        type="text"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('substitutePlaceholder')}
        className="rounded border border-ink/20 px-1 py-0.5 text-sm"
      />
      <button type="button" disabled={isPending} onClick={save} className="text-xs font-semibold text-swim-dark">
        {t('save')}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setEditing(false);
          setError('');
        }}
        className="text-xs text-ink-light"
      >
        {t('cancel')}
      </button>
      {error ? <span className="w-full text-xs text-run-dark">{error}</span> : null}
    </span>
  );
}
