import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { loadHofResults } from '@/lib/hofData';
import { listArchivedResults, type ArchivedResult } from '@/lib/archiveFix';
import HofEditor from './HofEditor';
import ArchivedTimeFixForm from './ArchivedTimeFixForm';
import CsvLink from './CsvLink';

export default async function HofPanel(_props: { locale: string }) {
  const t = await getTranslations('manage');
  const [rows, archives] = await Promise.all([
    loadHofResults(),
    prisma.competitionArchive.findMany({ orderBy: { year: 'desc' }, select: { year: true } }),
  ]);

  // Each closed year's results, for the picker. Read here rather than in the
  // browser so the admin chooses from the year's own record instead of typing a
  // name that has to match what the archive happens to hold.
  const archived: Record<string, ArchivedResult[]> = {};
  for (const { year } of archives) archived[year] = await listArchivedResults(year);
  const correctable = Object.values(archived).some((r) => r.length > 0);

  return (
    <div className="space-y-4">
      {/* Correcting a time in a closed year. Its own card, above the record
          itself: a wrong time has to be fixed in the year's archive — what the
          Hall of Fame is rebuilt from — or the next re-import puts it back. */}
      {correctable && (
        <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-3">
          <h2 className="font-semibold">{t('fixTitle')}</h2>
          <p className="text-sm text-ink-light">{t('fixHint')}</p>
          <ArchivedTimeFixForm results={archived} />
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
        <h2 className="mb-3 font-semibold">{t('tabHof')}</h2>
        <HofEditor rows={rows} />
      </div>
      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/hof" label={t('exportHof')} />
      </div>
    </div>
  );
}
