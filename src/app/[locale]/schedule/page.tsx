import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import ScheduleView from '@/components/ScheduleView';

export default async function SchedulePage() {
  const t = await getTranslations('schedule');

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-10">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <ScheduleView />
      </main>
    </div>
  );
}
