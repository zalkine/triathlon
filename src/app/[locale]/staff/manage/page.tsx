import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { formatClock } from '@/lib/time';
import EventControls from '@/components/EventControls';
import UnassignedRegistrants from '@/components/UnassignedRegistrants';
import TestDataControls from '@/components/TestDataControls';

export const dynamic = 'force-dynamic';

export default async function ManageDashboardPage() {
  const t = await getTranslations('manage');
  const locale = await getLocale();
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { heats: { include: { _count: { select: { entries: true } } }, orderBy: { createdAt: 'asc' } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <Link
          href="/staff/manage/heats/new"
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110"
        >
          {t('newHeat')}
        </Link>
      </div>

      <EventControls locale={locale} />
      <TestDataControls locale={locale} />
      <UnassignedRegistrants locale={locale} />

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
            <h2 className="mb-3 font-semibold">{locale === 'he' ? cat.nameHe : cat.nameEn}</h2>
            {cat.heats.length === 0 ? (
              <p className="text-sm text-ink-light">{t('noHeats')}</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {cat.heats.map((heat) => (
                  <li key={heat.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-medium">{heat.name}</span>{' '}
                      <span className="text-sm text-ink-light">
                        · {heat._count.entries} · {heat.startTime ? formatClock(heat.startTime, locale) : t('notSet')}
                      </span>
                    </div>
                    <Link href={`/staff/manage/heats/${heat.id}`} className="text-sm font-semibold underline">
                      {t('viewHeat')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
