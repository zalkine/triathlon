import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { racingCategories } from '@/lib/categories';
import { LEGS, type Leg } from '@/lib/constants';
import { getCategoryResults, resultsPubliclyVisible } from '@/lib/ranking';
import { formatClock, formatDuration, formatHeatName } from '@/lib/time';
import { setPublicResultsVisible, setResultsApproved } from '@/actions/event';
import { addResultsToHof } from '@/actions/hof';
import ConfirmForm from '@/components/ConfirmForm';
import TimeFieldEditor from '@/components/TimeFieldEditor';
import HeatStartTimeEditor from '@/components/HeatStartTimeEditor';
import SubstituteNameEditor from './SubstituteNameEditor';
import ResultInclusionToggle from './ResultInclusionToggle';
import CsvLink from './CsvLink';
import XlsxLink from './XlsxLink';

export default async function ScoresPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const tr = await getTranslations('results');

  // Results are reviewed per racing field, so merged age brackets appear once,
  // ranked together, exactly as the public sees them.
  const [settings, categories] = await Promise.all([
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    racingCategories(),
  ]);

  const results = await Promise.all(categories.map((c) => getCategoryResults(c.id)));

  // Everyone left out of the ranking, per field: a no-show scratched at the
  // start line, or someone the admin took out here. They are shown under their
  // field so the decision can be seen and undone during the review — otherwise
  // a wrongly scratched competitor is invisible on the one screen meant to get
  // the results right.
  const fieldOfCategory = new Map<string, string>();
  categories.forEach((c) => c.memberIds.forEach((id) => fieldOfCategory.set(id, c.id)));
  const scratched = await prisma.entry.findMany({
    where: { scratched: true, heat: { categoryId: { in: [...fieldOfCategory.keys()] } } },
    include: { heat: { select: { id: true, name: true, categoryId: true, startTime: true } } },
    orderBy: { name: 'asc' },
  });
  const scratchedByField = new Map<string, typeof scratched>();
  for (const e of scratched) {
    const field = fieldOfCategory.get(e.heat.categoryId) as string;
    scratchedByField.set(field, [...(scratchedByField.get(field) ?? []), e]);
  }

  // Relay legs for every ranked entry, so a stand-in can be recorded against the
  // leg they actually swam/rode/ran rather than against the team's name. Only
  // the ranked rows need them: a competitor left out of the results is put back
  // before their name is worth correcting.
  const rankedIds = results.flatMap((r) => r?.ranked.map((e) => e.id) ?? []);
  const members =
    rankedIds.length > 0
      ? await prisma.member.findMany({ where: { entryId: { in: rankedIds } } })
      : [];
  const legOrder = (leg: string | null) => (leg ? LEGS.indexOf(leg as Leg) : LEGS.length);
  const membersByEntry = new Map<string, typeof members>();
  for (const m of members) membersByEntry.set(m.entryId, [...(membersByEntry.get(m.entryId) ?? []), m]);
  for (const list of membersByEntry.values()) list.sort((a, b) => legOrder(a.leg) - legOrder(b.leg));
  const legLabel = (leg: string | null) =>
    leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : undefined;

  const toggleApproved = setResultsApproved.bind(null, locale, !settings.resultsApproved);
  const toggleVisible = setPublicResultsVisible.bind(null, locale, !settings.publicResultsVisible);
  const runAddToHof = async (formData: FormData) => {
    'use server';
    await addResultsToHof(locale, formData);
  };
  const publiclyLive = resultsPubliclyVisible(settings);
  const currentYear = new Date().getFullYear();

  const anyResults =
    results.some((r) => r && r.ranked.length > 0) || scratched.length > 0;

  // The name column, shared by the ranked table and the left-out list: a relay
  // is replaced one leg at a time and takes its name from them, a solo
  // competitor is the name itself.
  const nameCell = (entryId: string, entryName: string) => {
    const legs = membersByEntry.get(entryId) ?? [];
    return legs.length > 0 ? (
      <>
        <div>{entryName}</div>
        <ul className="mt-1 space-y-0.5 text-xs">
          {legs.map((m) => (
            <li key={m.id}>
              <SubstituteNameEditor entryId={entryId} memberId={m.id} name={m.name} legLabel={legLabel(m.leg)} />
            </li>
          ))}
        </ul>
      </>
    ) : (
      <SubstituteNameEditor entryId={entryId} name={entryName} />
    );
  };

  const statusLabel = (s: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED') =>
    s === 'NOT_STARTED' ? tr('notStarted') : s === 'IN_PROGRESS' ? tr('inProgress') : tr('finished');

  return (
    <div className="space-y-6">
      {/* Review & publish workflow */}
      <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-4">
        <h2 className="font-semibold">{t('scoresReviewTitle')}</h2>
        <p className="text-sm text-ink-light">{t('scoresReviewHint')}</p>
        <p className="text-sm text-ink-light">{t('substituteReviewHint')}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-ink-light">{t('resultsApprovedLabel')}:</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${settings.resultsApproved ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'}`}>
              {settings.resultsApproved ? t('approved') : t('notApproved')}
            </span>
            <form action={toggleApproved}>
              <button type="submit" className="text-sm font-semibold underline">
                {settings.resultsApproved ? t('revokeApproval') : t('approveResults')}
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ink-light">{t('publicResultsLabel')}:</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${settings.publicResultsVisible ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'}`}>
              {settings.publicResultsVisible ? t('shown') : t('hidden')}
            </span>
            <form action={toggleVisible}>
              <button type="submit" className="text-sm font-semibold underline">
                {settings.publicResultsVisible ? t('hideResults') : t('showResults')}
              </button>
            </form>
          </div>
        </div>

        <p className={`text-sm font-semibold ${publiclyLive ? 'text-swim-dark' : 'text-ink-light'}`}>
          {publiclyLive ? `✓ ${t('resultsLivePublic')}` : t('resultsNotLivePublic')}
        </p>

        {/* Add approved results to the Hall of Fame */}
        <form action={runAddToHof} className="flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4">
          <span className="text-sm text-ink-light">{t('addToHofLabel')}:</span>
          <input
            name="year"
            type="number"
            defaultValue={currentYear}
            min={1900}
            max={2200}
            className="w-24 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:brightness-110">
            {t('addToHof')}
          </button>
          <span className="text-xs text-ink-light">{t('addToHofHint')}</span>
        </form>
      </div>

      {/* Results review — always visible to the admin */}
      {!anyResults ? (
        <p className="text-sm text-ink-light">{t('noResultsYet')}</p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat, i) => {
            const result = results[i];
            const leftOut = scratchedByField.get(cat.id) ?? [];
            if (!result || (result.ranked.length === 0 && leftOut.length === 0)) return null;

            // Every heat on this card, taken from the rows themselves so only
            // heats with someone in them get a start-time editor.
            const heats = new Map<string, { name: string; startTime: Date | null }>();
            for (const e of result.ranked) heats.set(e.heatId, { name: e.heatName, startTime: e.startTime });
            for (const e of leftOut) heats.set(e.heat.id, { name: e.heat.name, startTime: e.heat.startTime });

            return (
              <div key={cat.id} className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
                <h3 className="mb-1 font-semibold">{locale === 'he' ? cat.nameHe : cat.nameEn}</h3>
                <p className="mb-3 text-xs text-ink-light">
                  {t('scoresEditHint')} {t('substituteEditHint')} {t('derivedColumnsHint')}
                </p>

                {/* The heats' start times. A total is a finish minus its heat's
                    start, so this is the other half of correcting a time — and
                    it belongs to the heat, not to one competitor. */}
                <div className="mb-4 rounded-xl bg-ink/[0.03] px-3 py-2">
                  <p className="text-xs font-medium text-ink-light">{t('heatStartsTitle')}</p>
                  <ul className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
                    {[...heats].map(([heatId, heat]) => (
                      <li key={heatId} className="flex items-center gap-2">
                        <span className="text-sm text-ink-light">{formatHeatName(heat.name, locale)}</span>
                        <HeatStartTimeEditor
                          heatId={heatId}
                          value={heat.startTime?.toISOString() ?? null}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-ink-light">{t('heatStartsHint')}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b border-ink/10 text-xs text-ink-light">
                        <th className="px-2 py-2 text-start font-medium">{tr('rank')}</th>
                        <th className="px-2 py-2 text-start font-medium">{tr('name')}</th>
                        <th className="px-2 py-2 text-start font-medium">{tr('start')}</th>
                        <th className="px-2 py-2 text-start font-medium">{t('swimTime')}</th>
                        <th className="px-2 py-2 text-start font-medium">{t('bikeTime')}</th>
                        <th className="px-2 py-2 text-start font-medium">{t('runTime')}</th>
                        <th className="px-2 py-2 text-end font-medium">{tr('total')}</th>
                        <th className="px-2 py-2 text-start font-medium">{tr('status')}</th>
                        <th className="px-2 py-2 text-start font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.ranked.map((e) => (
                        <tr key={e.id} className="border-b border-ink/5 align-top last:border-0">
                          <td className="px-2 py-2 font-semibold">{e.rank ?? '—'}</td>
                          <td className="px-2 py-2">
                            {nameCell(e.id, e.name)}
                            {/* Straight through to the heat for what belongs
                                there: adding a competitor who never made it
                                into a heat, moving one, deleting a row. */}
                            <div className="mt-0.5">
                              <Link
                                href={`/staff/manage/heats/${e.heatId}`}
                                className="text-xs text-ink-light underline decoration-dotted underline-offset-4"
                              >
                                {formatHeatName(e.heatName, locale)}
                              </Link>
                            </div>
                          </td>
                          <td className="px-2 py-2 tabular-nums text-ink-light">{formatClock(e.startTime, locale)}</td>
                          <td className="px-2 py-2">
                            <TimeFieldEditor heatId={e.heatId} entryId={e.id} field="swimTime" value={e.swimTime?.toISOString() ?? null} />
                          </td>
                          <td className="px-2 py-2">
                            <TimeFieldEditor heatId={e.heatId} entryId={e.id} field="bikeTime" value={e.bikeTime?.toISOString() ?? null} />
                          </td>
                          <td className="px-2 py-2">
                            <TimeFieldEditor heatId={e.heatId} entryId={e.id} field="runTime" value={e.runTime?.toISOString() ?? null} />
                          </td>
                          <td className="px-2 py-2 text-end tabular-nums font-medium">
                            {e.totalMs != null ? formatDuration(e.totalMs) : '—'}
                          </td>
                          <td className="px-2 py-2 text-ink-light">{statusLabel(e.status)}</td>
                          <td className="px-2 py-2">
                            <ResultInclusionToggle entryId={e.id} name={e.name} scratched={false} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {leftOut.length > 0 && (
                  <div className="mt-4 border-t border-ink/5 pt-3">
                    <p className="text-xs font-medium text-ink-light">{t('notInResultsTitle')}</p>
                    <p className="text-xs text-ink-light">{t('notInResultsHint')}</p>
                    <ul className="mt-2 space-y-2">
                      {leftOut.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                          <span className="text-ink-light line-through">{e.name}</span>
                          <span className="text-xs text-ink-light">{formatHeatName(e.heat.name, locale)}</span>
                          <ResultInclusionToggle entryId={e.id} name={e.name} scratched={true} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/results" label={t('exportResults')} />
        <XlsxLink label={t('exportWorkbook')} hint={t('exportWorkbookHint')} />
      </div>
    </div>
  );
}
