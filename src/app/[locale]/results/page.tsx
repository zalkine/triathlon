import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import PublicHeader from '@/components/PublicHeader';
import ResultsView from '@/components/ResultsView';
import { racingCategories } from '@/lib/categories';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const t = await getTranslations('results');
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  // A closed competition has been archived: its results live on in the Hall of
  // Fame and this page has nothing left to rank. Say where they went rather
  // than showing an empty table. Opening registration for the next competition
  // clears this.
  const closedYear = settings?.closedYear ?? null;

  if (closedYear !== null) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-10">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <div className="space-y-4 rounded-2xl border border-ink/10 bg-surface/70 p-10 text-center">
            <p className="text-ink-light">{t('archived', { year: String(closedYear) })}</p>
            <Link
              href={`/hall-of-fame#year-${closedYear}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-run to-run-dark px-6 py-3 text-lg font-extrabold text-white shadow-lg transition hover:brightness-95"
            >
              🏆 {t('archivedCta', { year: String(closedYear) })}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // One tab per field that actually races: registration-only categories (the
  // toddlers fun run) aren't timed, and age brackets merged by the admin are
  // ranked as one, so they get a single tab under the merged name.
  const categories = await racingCategories();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-10">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <ResultsView categories={categories} />
      </main>
    </div>
  );
}
