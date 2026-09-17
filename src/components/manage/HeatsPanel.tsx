import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { formatClock } from '@/lib/time';
import { REGISTRATION_ONLY_CATEGORY_KEYS } from '@/lib/constants';
import { racingCategories } from '@/lib/categories';
import { generateSchedule } from '@/actions/event';
import ConfirmForm from '@/components/ConfirmForm';
import UnassignedRegistrants from '@/components/UnassignedRegistrants';
import HeatsBoard, { type BoardWave } from './HeatsBoard';
import SyncHeatsWithRoster from './SyncHeatsWithRoster';
import MergeCategoriesPanel from './MergeCategoriesPanel';
import CsvLink from './CsvLink';

export default async function HeatsPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  const [fields, heatRows, settings, unplacedSingles, unplacedGroups] = await Promise.all([
    // Age brackets an admin has merged race as one field, so the board shows
    // them as one column of heats under the merged name.
    racingCategories(),
    prisma.heat.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        entries: {
          include: { members: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    // Registration-only categories (the toddlers fun run) are never scheduled,
    // so their sign-ups aren't "waiting to be placed".
    prisma.registrant.count({
      where: {
        entryId: null,
        mode: 'SINGLE',
        category: { key: { notIn: [...REGISTRATION_ONLY_CATEGORY_KEYS] } },
      },
    }),
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
  const anyHeats = heatRows.length > 0;

  // Heats belong to the field that races them; a heat left under an absorbed
  // bracket still shows with its field rather than disappearing off the board.
  const heatsOfField = new Map<string, typeof heatRows>();
  for (const field of fields) {
    heatsOfField.set(
      field.id,
      heatRows.filter((h) => field.memberIds.includes(h.categoryId))
    );
  }

  // Leg times per heat, and — for heats combined into a shared start — per wave,
  // since cancelling one sends the whole wave back to the start line and the
  // confirmation has to say how many stamps that clears.
  const countStamps = (entries: { swimTime: Date | null; bikeTime: Date | null; runTime: Date | null }[]) =>
    entries.reduce((n, e) => n + (e.swimTime ? 1 : 0) + (e.bikeTime ? 1 : 0) + (e.runTime ? 1 : 0), 0);
  const waveStamps = new Map<string, number>();
  for (const h of heatRows) {
    if (!h.waveId) continue;
    waveStamps.set(h.waveId, (waveStamps.get(h.waveId) ?? 0) + countStamps(h.entries));
  }

  const boardCategories = fields.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameHe: c.nameHe,
    heats: (heatsOfField.get(c.id) ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      startTime: h.startTime ? h.startTime.toISOString() : null,
      stampedTimes: h.waveId ? (waveStamps.get(h.waveId) ?? 0) : countStamps(h.entries),
      waveId: h.waveId,
      entries: h.entries.map((e) => ({
        id: e.id,
        name: e.name,
        members: e.members
          .map((m) => ({ id: m.id, name: m.name, leg: m.leg }))
          .sort((a, b) => legOrder(a.leg) - legOrder(b.leg)),
      })),
    })),
  }));

  // Combined starts, numbered in the order they appear down the board, so each
  // heat card can say which wave it belongs to and which heats leave with it.
  const waves: BoardWave[] = [];
  const waveIndex = new Map<string, BoardWave>();
  for (const c of fields) {
    for (const h of heatsOfField.get(c.id) ?? []) {
      if (!h.waveId) continue;
      let wave = waveIndex.get(h.waveId);
      if (!wave) {
        wave = { id: h.waveId, number: waves.length + 1, heats: [] };
        waveIndex.set(h.waveId, wave);
        waves.push(wave);
      }
      wave.heats.push({ id: h.id, name: h.name, categoryNameEn: c.nameEn, categoryNameHe: c.nameHe });
    }
  }

  return (
    <div className="space-y-6">
      {/* Reconcile placed heats with registration-tab group/competitor edits */}
      <SyncHeatsWithRoster />

      {/* Race two age brackets as one category (before generating the schedule) */}
      <MergeCategoriesPanel locale={locale} />

      <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-3">
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

      <HeatsBoard categories={boardCategories} waves={waves} />

      <UnassignedRegistrants locale={locale} />

      {anyHeats && (
        <div className="flex flex-wrap gap-3">
          <CsvLink href="/api/export/heats" label={t('exportHeats')} />
        </div>
      )}
    </div>
  );
}
