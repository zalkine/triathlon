import { getTranslations } from 'next-intl/server';
import StationTile from '@/components/StationTile';

export default async function StationsPage() {
  const t = await getTranslations('stations');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-ink-light">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StationTile href="/staff/stations/start" station="start" title={t('start')} desc={t('startDesc')} />
        <StationTile href="/staff/stations/swim" station="swim" title={t('swim')} desc={t('swimDesc')} />
        <StationTile href="/staff/stations/bike" station="bike" title={t('bike')} desc={t('bikeDesc')} />
        <StationTile href="/staff/stations/run" station="run" title={t('run')} desc={t('runDesc')} />
      </div>
    </div>
  );
}
