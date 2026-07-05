import { getTranslations } from 'next-intl/server';
import CheckinView from '@/components/CheckinView';

export default async function CheckinPage() {
  const t = await getTranslations('checkin');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <CheckinView />
    </div>
  );
}
