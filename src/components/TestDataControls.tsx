'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { generateTestCompetitors, resetCompetitionData, resetResultsAndTiming } from '@/actions/testdata';

export default function TestDataControls({ locale }: { locale: string }) {
  const t = useTranslations('testdata');
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');

  return (
    <div className="rounded-2xl border border-dashed border-ink/30 bg-white/50 p-5">
      <h2 className="mb-1 font-semibold">{t('title')}</h2>
      <p className="mb-3 text-sm text-ink-light">{t('hint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const r = await generateTestCompetitors(locale, 100);
              setMsg(r.ok ? t('added', { count: r.count }) : t('failed'));
            });
          }}
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-60"
        >
          {t('generate')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm(t('resetResultsConfirm'))) return;
            startTransition(async () => {
              await resetResultsAndTiming(locale);
              setMsg(t('resetResultsDone'));
            });
          }}
          className="rounded-full border border-ink/40 px-5 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-60"
        >
          {t('resetResults')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm(t('resetConfirm'))) return;
            startTransition(async () => {
              await resetCompetitionData(locale);
              setMsg(t('resetDone'));
            });
          }}
          className="rounded-full border border-run-dark px-5 py-2 text-sm font-semibold text-run-dark hover:bg-run-light/30 disabled:opacity-60"
        >
          {t('reset')}
        </button>
        {msg && <span className="text-sm text-ink-light">{msg}</span>}
      </div>
    </div>
  );
}
