import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/navigation';
import CompetitionInfoEditor from './CompetitionInfoEditor';

export default async function CompetitionInfoPanel(_props: { locale: string }) {
  const t = await getTranslations('manage');
  const [settings, sections] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.infoSection.findMany({
      where: { type: 'competitionInfo' },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t('tabCompetitionInfo')}</h2>
          <Link href="/competition-info" className="text-sm font-semibold underline">
            {t('viewPublic')}
          </Link>
        </div>
        <CompetitionInfoEditor
          published={settings?.competitionInfoPublished ?? false}
          sections={sections.map((s) => ({
            id: s.id,
            titleEn: s.titleEn,
            titleHe: s.titleHe,
            bodyEn: s.bodyEn,
            bodyHe: s.bodyHe,
            imageUrl: s.imageUrl,
          }))}
        />
      </div>
    </div>
  );
}
