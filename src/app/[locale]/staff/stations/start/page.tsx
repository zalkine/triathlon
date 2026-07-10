import { getTranslations } from 'next-intl/server';
import StartStationView from '@/components/StartStationView';
import StampStationView from '@/components/StampStationView';

export default async function StartStationPage() {
  const t = await getTranslations('stationStart');
  const ts = await getTranslations('stations');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <StartStationView />

      {/* The start-line timekeeper stands at the pool, so they can also record
          swim-exit times here without switching stations. */}
      <section className="space-y-4 border-t border-ink/10 pt-6">
        <div>
          <h2 className="text-xl font-bold">{ts('swim')}</h2>
          <p className="text-sm text-ink-light">{t('poolFinishHint')}</p>
        </div>
        <StampStationView station="swim" />
      </section>
    </div>
  );
}
