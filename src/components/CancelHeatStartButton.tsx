'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cancelHeatStart } from '@/actions/heats';

// "Cancel start" — the escape hatch when a heat was sent off but has to be run
// again (false start, a competitor missing, something wrong on the course).
// Used by the start-line timekeeper on the Start station and by the admin on the
// heats board / heat page, so the confirmation text lives in `common`.
//
// It resets only this heat's clock; nobody is removed from the race. The
// confirmation spells out how many already-stamped leg times go with it, since
// those were measured against the start being cancelled.
export default function CancelHeatStartButton({
  heatId,
  stampedTimes = 0,
  onCancelled,
  className = 'text-sm font-semibold text-run-dark underline',
}: {
  heatId: string;
  /** Leg times already stamped in this heat — named in the confirmation. */
  stampedTimes?: number;
  /** Called instead of router.refresh() when the parent reloads its own data. */
  onCancelled?: () => void;
  className?: string;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    const message =
      stampedTimes > 0
        ? t('confirmCancelStartWithTimes', { count: stampedTimes })
        : t('confirmCancelStart');
    if (!window.confirm(message)) return;
    startTransition(async () => {
      await cancelHeatStart(heatId);
      if (onCancelled) onCancelled();
      else router.refresh();
    });
  };

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={`${className} disabled:opacity-50`}>
      {t('cancelStart')}
    </button>
  );
}
