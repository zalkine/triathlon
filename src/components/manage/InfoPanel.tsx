import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/navigation';
import InfoEditor from './InfoEditor';

export default async function InfoPanel(_props: { locale: string }) {
  const t = await getTranslations('manage');
  const sections = await prisma.infoSection.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t('tabInfo')}</h2>
          <Link href="/info" className="text-sm font-semibold underline">
            {t('infoViewPublic')}
          </Link>
        </div>
        <InfoEditor
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
