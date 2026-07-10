'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { undoCheckIn } from '@/actions/registrants';

// Cancel a competitor's "arrived" check-in from the management roster.
export default function UndoCheckinButton({ registrantId }: { registrantId: string }) {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(t('undoCheckinConfirm'))) return;
        startTransition(async () => {
          await undoCheckIn(registrantId);
          router.refresh();
        });
      }}
      className="text-xs text-run-dark underline disabled:opacity-60"
    >
      {t('undoCheckin')}
    </button>
  );
}
