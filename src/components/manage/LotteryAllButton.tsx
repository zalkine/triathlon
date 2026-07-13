'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { lotteryAllCategories } from '@/actions/groups';

// Registration tab: one push forms random teams from the ungrouped registrants
// of every team category at once. Additive — never touches existing groups.
export default function LotteryAllButton() {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-4">
      <button
        type="button"
        onClick={() => {
          if (!window.confirm(t('lotteryAllConfirm'))) return;
          startTransition(async () => {
            const r = await lotteryAllCategories();
            setMsg(t('lotteryDone', { count: r.formed }));
            router.refresh();
          });
        }}
        disabled={isPending}
        className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-50"
      >
        🎲 {t('lotteryAll')}
      </button>
      <span className="text-xs text-ink-light">{t('lotteryAllHint')}</span>
      {msg && <span className="text-xs font-semibold text-swim-dark">{msg}</span>}
    </div>
  );
}
