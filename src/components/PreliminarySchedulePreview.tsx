import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { HEAT_CAPACITY } from '@/lib/constants';
import { chunk, computeEstimatedStarts } from '@/lib/schedule';
import { formatClockHM, formatDateTimeInputValue } from '@/lib/time';
import { setRaceStartTime, setHeatGapMinutes } from '@/actions/event';

export default async function PreliminarySchedulePreview({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  const [categories, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
  ]);

  // Count registrants and groups per category to estimate heat distribution.
  const counts = await Promise.all(
    categories.map(async (cat) => {
      if (cat.type === 'SINGLE') {
        const total = await prisma.registrant.count({ where: { categoryId: cat.id } });
        return { categoryId: cat.id, expectedEntries: total };
      } else {
        // Only admin-formed groups become heat entries; ungrouped registrants
        // are not auto-teamed, so they don't count towards the schedule.
        const groups = await prisma.group.count({ where: { categoryId: cat.id } });
        return { categoryId: cat.id, expectedEntries: groups };
      }
    })
  );

  const countMap = new Map(counts.map((c) => [c.categoryId, c.expectedEntries]));

  const blocks = categories.map((cat) => {
    const entries = countMap.get(cat.id) ?? 0;
    return {
      categoryId: cat.id,
      estDurationMinutes: cat.estDurationMinutes,
      heatCount: Math.ceil(entries / HEAT_CAPACITY) || 0,
    };
  });

  const totalHeats = blocks.reduce((s, b) => s + b.heatCount, 0);

  // Compute estimated starts only when a race start time is configured.
  let startsByBlock: Date[][] | null = null;
  if (settings.raceStartTime) {
    startsByBlock = computeEstimatedStarts(blocks, settings.raceStartTime, settings.heatGapMinutes);
  }

  const updateRaceStartTime = setRaceStartTime.bind(null, locale);
  const updateHeatGapMinutes = setHeatGapMinutes.bind(null, locale);

  // Derive overall event window.
  let eventStart: Date | null = null;
  let eventEnd: Date | null = null;
  if (startsByBlock) {
    for (let i = 0; i < blocks.length; i++) {
      const starts = startsByBlock[i];
      if (starts.length === 0) continue;
      if (!eventStart || starts[0] < eventStart) eventStart = starts[0];
      const lastStart = starts[starts.length - 1];
      const lastEnd = new Date(lastStart.getTime() + blocks[i].estDurationMinutes * 60_000);
      if (!eventEnd || lastEnd > eventEnd) eventEnd = lastEnd;
    }
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t('preliminaryScheduleTitle')}</h2>
        <span className="text-sm text-ink-light">{t('preliminaryScheduleHint')}</span>
      </div>

      {/* Race settings */}
      <div className="flex flex-wrap gap-6 text-sm border-b border-ink/5 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-ink-light">{t('raceStartTimeLabel')}:</span>
          <form action={updateRaceStartTime} className="flex items-center gap-2">
            <input
              name="iso"
              type="datetime-local"
              defaultValue={formatDateTimeInputValue(settings.raceStartTime).slice(0, 16)}
              className="rounded-lg border border-ink/20 px-2 py-1 text-xs"
            />
            <button type="submit" className="text-xs font-semibold underline">{t('save')}</button>
          </form>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-light">{t('heatGapLabel')}:</span>
          <form action={updateHeatGapMinutes} className="flex items-center gap-2">
            <input
              name="minutes"
              type="number"
              min={0}
              max={30}
              defaultValue={settings.heatGapMinutes}
              className="w-16 rounded-lg border border-ink/20 px-2 py-1 text-xs"
            />
            <span className="text-xs text-ink-light">{t('heatGapUnit')}</span>
            <button type="submit" className="text-xs font-semibold underline">{t('save')}</button>
          </form>
        </div>
        {eventStart && eventEnd && (
          <div className="flex items-center gap-2">
            <span className="text-ink-light">{t('estimatedWindow')}:</span>
            <span className="font-semibold tabular-nums">
              {formatClockHM(eventStart, locale)} – {formatClockHM(eventEnd, locale)}
            </span>
          </div>
        )}
      </div>

      {/* Per-category breakdown */}
      {totalHeats === 0 ? (
        <p className="text-sm text-ink-light">{t('noRegistrantsYet')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-light text-xs border-b border-ink/10">
                <th className="py-2 text-start font-medium">{t('category')}</th>
                <th className="py-2 px-3 text-end font-medium">{t('prelim_registrants')}</th>
                <th className="py-2 px-3 text-end font-medium">{t('prelim_heats')}</th>
                <th className="py-2 px-3 text-start font-medium">{t('prelim_timeWindow')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => {
                const block = blocks[i];
                const entries = countMap.get(cat.id) ?? 0;
                const starts = startsByBlock?.[i];
                const firstStart = starts?.[0];
                const lastStart = starts?.[block.heatCount - 1];
                const lastEnd = lastStart
                  ? new Date(lastStart.getTime() + block.estDurationMinutes * 60_000)
                  : null;
                return (
                  <tr key={cat.id} className="border-b border-ink/5 last:border-0">
                    <td className="py-2 font-medium">{locale === 'he' ? cat.nameHe : cat.nameEn}</td>
                    <td className="py-2 px-3 text-end tabular-nums">{entries}</td>
                    <td className="py-2 px-3 text-end tabular-nums">{block.heatCount}</td>
                    <td className="py-2 px-3 tabular-nums text-ink-light">
                      {firstStart && lastEnd
                        ? `${formatClockHM(firstStart, locale)} – ${formatClockHM(lastEnd, locale)}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink/10 font-semibold">
                <td className="py-2">{t('totalHeats')}</td>
                <td />
                <td className="py-2 px-3 text-end tabular-nums">{totalHeats}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
