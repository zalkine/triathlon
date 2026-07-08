import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getCategoryResults } from '@/lib/ranking';
import { formatDuration } from '@/lib/time';
import { setPublicResultsVisible, setResultsApproved } from '@/actions/event';
import { addResultsToHof } from '@/actions/hof';
import ConfirmForm from '@/components/ConfirmForm';
import CsvLink from './CsvLink';

export default async function ScoresPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const tr = await getTranslations('results');

  const [settings, categories] = await Promise.all([
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const results = await Promise.all(categories.map((c) => getCategoryResults(c.id)));

  const toggleApproved = setResultsApproved.bind(null, locale, !settings.resultsApproved);
  const toggleVisible = setPublicResultsVisible.bind(null, locale, !settings.publicResultsVisible);
  const runAddToHof = async (formData: FormData) => {
    'use server';
    await addResultsToHof(locale, formData);
  };
  const publiclyLive = settings.resultsApproved && settings.publicResultsVisible;
  const currentYear = new Date().getFullYear();

  const anyResults = results.some((r) => r && r.ranked.some((e) => e.totalMs != null));

  const statusLabel = (s: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED') =>
    s === 'NOT_STARTED' ? tr('notStarted') : s === 'IN_PROGRESS' ? tr('inProgress') : tr('finished');

  return (
    <div className="space-y-6">
      {/* Review & publish workflow */}
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-4">
        <h2 className="font-semibold">{t('scoresReviewTitle')}</h2>
        <p className="text-sm text-ink-light">{t('scoresReviewHint')}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-ink-light">{t('resultsApprovedLabel')}:</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${settings.resultsApproved ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'}`}>
              {settings.resultsApproved ? t('approved') : t('notApproved')}
            </span>
            <form action={toggleApproved}>
              <button type="submit" className="text-sm font-semibold underline">
                {settings.resultsApproved ? t('revokeApproval') : t('approveResults')}
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ink-light">{t('publicResultsLabel')}:</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${settings.publicResultsVisible ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'}`}>
              {settings.publicResultsVisible ? t('shown') : t('hidden')}
            </span>
            <form action={toggleVisible}>
              <button type="submit" className="text-sm font-semibold underline">
                {settings.publicResultsVisible ? t('hideResults') : t('showResults')}
              </button>
            </form>
          </div>
        </div>

        <p className={`text-sm font-semibold ${publiclyLive ? 'text-swim-dark' : 'text-ink-light'}`}>
          {publiclyLive ? `✓ ${t('resultsLivePublic')}` : t('resultsNotLivePublic')}
        </p>

        {/* Add approved results to the Hall of Fame */}
        <form action={runAddToHof} className="flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4">
          <span className="text-sm text-ink-light">{t('addToHofLabel')}:</span>
          <input
            name="year"
            type="number"
            defaultValue={currentYear}
            min={1900}
            max={2200}
            className="w-24 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:brightness-110">
            {t('addToHof')}
          </button>
          <span className="text-xs text-ink-light">{t('addToHofHint')}</span>
        </form>
      </div>

      {/* Results review — always visible to the admin */}
      {!anyResults ? (
        <p className="text-sm text-ink-light">{t('noResultsYet')}</p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat, i) => {
            const result = results[i];
            if (!result || result.ranked.length === 0) return null;
            return (
              <div key={cat.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
                <h3 className="mb-3 font-semibold">{locale === 'he' ? cat.nameHe : cat.nameEn}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-ink/10 text-xs text-ink-light">
                        <th className="px-2 py-2 text-start font-medium">{tr('rank')}</th>
                        <th className="px-2 py-2 text-start font-medium">{tr('name')}</th>
                        <th className="px-2 py-2 text-end font-medium">{tr('total')}</th>
                        <th className="px-2 py-2 text-start font-medium">{tr('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.ranked.map((e) => (
                        <tr key={e.id} className="border-b border-ink/5 last:border-0">
                          <td className="px-2 py-2 font-semibold">{e.rank ?? '—'}</td>
                          <td className="px-2 py-2">{e.name}</td>
                          <td className="px-2 py-2 text-end tabular-nums font-medium">
                            {e.totalMs != null ? formatDuration(e.totalMs) : '—'}
                          </td>
                          <td className="px-2 py-2 text-ink-light">{statusLabel(e.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/results" label={t('exportResults')} />
      </div>
    </div>
  );
}
