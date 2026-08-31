import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import ResultsView from '@/components/ResultsView';
import { prisma } from '@/lib/db';
import { REGISTRATION_ONLY_CATEGORY_KEYS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const t = await getTranslations('results');
  // Registration-only categories (the toddlers fun run) aren't timed, so they
  // get no results tab.
  const categories = await prisma.category.findMany({
    where: { key: { notIn: [...REGISTRATION_ONLY_CATEGORY_KEYS] } },
    orderBy: { sortOrder: 'asc' },
  });

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
