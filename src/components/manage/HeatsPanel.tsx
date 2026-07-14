import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { formatClock } from '@/lib/time';
import { generateSchedule } from '@/actions/event';
import ConfirmForm from '@/components/ConfirmForm';
import UnassignedRegistrants from '@/components/UnassignedRegistrants';
import HeatsBoard from './HeatsBoard';
import SyncHeatsWithRoster from './SyncHeatsWithRoster';
import CsvLink from './CsvLink';

export default async function HeatsPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  const [categories, settings, unplacedSingles, unplacedGroups] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        heats: {
          include: {
            entries: {
              include: { members: true },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    prisma.registrant.count({ where: { entryId: null, mode: 'SINGLE' } }),
    // Only non-empty unplaced groups count as "to schedule" — a dismantled
    // (all-legs-cleared) group isn't a team and won't be placed.
    prisma.group.count({
      where: {
        entryId: null,
        OR: [
          { swimRegistrantId: { not: null } },
          { bikeRegistrantId: { not: null } },
          { runRegistrantId: { not: null } },
        ],
      },
    }),
  ]);

  // Display relay members in race order (swim → bike → run).
  const legOrder = (leg: string | null) => (leg === 'SWIM' ? 0 : leg === 'BIKE' ? 1 : leg === 'RUN' ? 2 : 3);

  const placeableCount = unplacedSingles + unplacedGroups;
  const runGenerate = generateSchedule.bind(null, locale);
  const anyHeats = categories.some((c) => c.heats.length > 0);

  const boardCategories = categories.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameHe: c.nameHe,
    heats: c.heats.map((h) => ({
      id: h.id,
      name: h.name,
      entries: h.entries.map((e) => ({
        id: e.id,
        name: e.name,
        members: e.members
          .map((m) => ({ id: m.id, name: m.name, leg: m.leg }))
          .sort((a, b) => legOrder(a.leg) - legOrder(b.leg)),
      })),
    })),
  }));

  return (
    <div className="space-y-6">
      {/* Reconcile placed heats with registration-tab group/competitor edits */}
      <SyncHeatsWithRoster />

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-3">
        <h2 className="font-semibold">{t('heatsTitle')}</h2>
        <p className="text-sm text-ink-light">{t('heatsBoardHint')}</p>
        {placeableCount > 0 && (
          <p className="rounded-lg bg-bike/15 px-3 py-2 text-sm font-medium text-bike-dark">
            ⚠ {t('unscheduledHint', { count: placeableCount })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmForm action={runGenerate} confirmMessage={t('generateScheduleConfirm')}>
            <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110">
              {t('generateSchedule')}
            </button>
          </ConfirmForm>
          {settings.scheduleGeneratedAt && (
            <span className="text-xs text-ink-light">
              {t('scheduleGeneratedAt', { time: formatClock(settings.scheduleGeneratedAt, locale) })}
            </span>
          )}
        </div>
      </div>

      <HeatsBoard categories={boardCategories} />

      <UnassignedRegistrants locale={locale} />

      {anyHeats && (
        <div className="flex flex-wrap gap-3">
          <CsvLink href="/api/export/heats" label={t('exportHeats')} />
        </div>
      )}
    </div>
  );
}
