import { getTranslations } from 'next-intl/server';
import { loadHofResults } from '@/lib/hofData';
import HofEditor from './HofEditor';
import CsvLink from './CsvLink';

export default async function HofPanel(_props: { locale: string }) {
  const t = await getTranslations('manage');
  const rows = await loadHofResults();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
        <h2 className="mb-3 font-semibold">{t('tabHof')}</h2>
        <HofEditor rows={rows} />
      </div>
      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/hof" label={t('exportHof')} />
      </div>
    </div>
  );
}
