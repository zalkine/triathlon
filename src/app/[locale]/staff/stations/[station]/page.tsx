import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import StampStationView from '@/components/StampStationView';

const VALID = ['swim', 'bike', 'run'] as const;

export default async function StampStationPage({ params }: { params: Promise<{ station: string }> }) {
  const { station } = await params;
  if (!VALID.includes(station as (typeof VALID)[number])) notFound();

  const t = await getTranslations('stations');
  const title = station === 'swim' ? t('swim') : station === 'bike' ? t('bike') : t('run');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <StampStationView station={station as 'swim' | 'bike' | 'run'} />
    </div>
  );
}
