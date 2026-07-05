import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import ResultsView from '@/components/ResultsView';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const t = await getTranslations('results');
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });

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
