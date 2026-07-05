import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import CompetitorsView from '@/components/CompetitorsView';

export default async function CompetitorsPage() {
  const t = await getTranslations('competitors');

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-ink-light">{t('subtitle')}</p>
        </div>
        <CompetitorsView />
      </main>
    </div>
  );
}
