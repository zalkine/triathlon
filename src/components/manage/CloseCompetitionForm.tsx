'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { closeCompetition } from '@/actions/competition';

/**
 * The last button of the year. Asks once, in full sentences, because what
 * follows is not a toggle: the season is archived and the management screens
 * come back empty for the next competition.
 */
export default function CloseCompetitionForm({
  defaultYear,
  published,
}: {
  defaultYear: number;
  published: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const router = useRouter();
  const [year, setYear] = useState(String(defaultYear));
  const [error, setError] = useState('');
  const [closedYear, setClosedYear] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError('');
    const parsed = parseInt(year, 10);
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2200) {
      setError(t('closeYearError'));
      return;
    }
    // Years are passed as text: a number would be formatted with a thousands
    // separator ("2,026").
    if (!window.confirm(t('closeConfirm', { year: String(parsed), next: String(parsed + 1) }))) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set('year', String(parsed));
      const result = await closeCompetition(locale, fd);
      if (result.error) {
        setError(
          result.error === 'not-published'
            ? t('closeNotPublished')
            : result.error === 'nothing-to-close'
              ? t('closeNothingToClose')
              : t('closeYearError')
        );
        return;
      }
      setClosedYear(result.year ?? parsed);
      router.refresh();
    });
  };

  if (closedYear !== null) {
    return (
      <p className="text-sm font-semibold text-swim-dark">
        ✓ {t('closeDone', { year: String(closedYear), next: String(closedYear + 1) })}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-ink-light" htmlFor="close-year">
          {t('closeYear')}
        </label>
        <input
          id="close-year"
          type="number"
          value={year}
          min={1900}
          max={2200}
          onChange={(e) => setYear(e.target.value)}
          className="w-24 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !published}
          className="rounded-full bg-run-dark px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('closeAction')}
        </button>
      </div>
      {!published && <p className="text-xs text-ink-light">{t('closeNotPublished')}</p>}
      {error && <p className="text-xs font-semibold text-run-dark">{error}</p>}
    </div>
  );
}
