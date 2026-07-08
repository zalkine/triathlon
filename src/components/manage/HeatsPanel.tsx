import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { formatClock } from '@/lib/time';
import { generateSchedule } from '@/actions/event';
import AutoGenerateHeats from '@/components/AutoGenerateHeats';
import ConfirmForm from '@/components/ConfirmForm';
import UnassignedRegistrants from '@/components/UnassignedRegistrants';
import CsvLink from './CsvLink';

export default async function HeatsPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  const [categories, settings, unplacedSingles, unplacedGroups] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { heats: { include: { _count: { select: { entries: true } } }, orderBy: { createdAt: 'asc' } } },
    }),
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    prisma.registrant.count({ where: { entryId: null, mode: 'SINGLE' } }),
    prisma.group.count({ where: { entryId: null } }),
  ]);

  const placeableCount = unplacedSingles + unplacedGroups;
  const runGenerate = generateSchedule.bind(null, locale);
  const anyHeats = categories.some((c) => c.heats.length > 0);

  return (
    <div className="space-y-6">
      {/* Additive auto-generation on load (safe, only appends new people) */}
      <AutoGenerateHeats locale={locale} placeableCount={placeableCount} />

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-3">
        <h2 className="font-semibold">{t('heatsTitle')}</h2>
        <p className="text-sm text-ink-light">{t('heatsHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmForm action={runGenerate} confirmMessage={t('generateScheduleConfirm')}>
            <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110">
              {t('generateSchedule')}
            </button>
          </ConfirmForm>
          <Link
            href="/staff/manage/heats/new"
            className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold hover:bg-ink/5"
          >
            {t('newHeat')}
          </Link>
          {settings.scheduleGeneratedAt && (
            <span className="text-xs text-ink-light">
              {t('scheduleGeneratedAt', { time: formatClock(settings.scheduleGeneratedAt, locale) })}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
            <h3 className="mb-3 font-semibold">{locale === 'he' ? cat.nameHe : cat.nameEn}</h3>
            {cat.heats.length === 0 ? (
              <p className="text-sm text-ink-light">{t('noHeats')}</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {cat.heats.map((heat) => (
                  <li key={heat.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <span className="font-medium">{heat.name}</span>{' '}
                      <span className="text-sm text-ink-light">
                        · {heat._count.entries} · {heat.startTime ? formatClock(heat.startTime, locale) : t('notSet')}
                      </span>
                    </div>
                    <Link href={`/staff/manage/heats/${heat.id}`} className="shrink-0 text-sm font-semibold underline">
                      {t('viewHeat')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <UnassignedRegistrants locale={locale} />

      {anyHeats && (
        <div className="flex flex-wrap gap-3">
          <CsvLink href="/api/export/heats" label={t('exportHeats')} />
        </div>
      )}
    </div>
  );
}
