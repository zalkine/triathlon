'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setEntryScratched } from '@/actions/entries';

/**
 * Takes a competitor out of the results, or puts them back.
 *
 * It writes the same `scratched` flag the start line sets for a no-show, which
 * is what keeps the two screens honest with each other: whoever didn't race is
 * left out of the ranking wherever that was decided. Nothing else is touched —
 * the competitor keeps their place in the heat and any times already recorded —
 * so the decision is reversible right up to publishing, and afterwards.
 */
export default function ResultInclusionToggle({
  entryId,
  name,
  scratched,
}: {
  entryId: string;
  name: string;
  scratched: boolean;
}) {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    // Only taking someone out needs asking about; putting them back is the undo.
    if (!scratched && !window.confirm(t('removeFromResultsConfirm', { name }))) return;
    startTransition(async () => {
      await setEntryScratched(entryId, !scratched);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={`text-xs underline ${
        scratched ? 'font-semibold text-swim-dark' : 'text-ink-light hover:text-run-dark'
      }`}
    >
      {scratched ? t('restoreToResults') : t('removeFromResults')}
    </button>
  );
}
