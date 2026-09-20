'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { fixArchivedLegTime } from '@/actions/competition';
import { formatHms } from '@/lib/hallOfFame';
import { LEGS, type Leg } from '@/lib/constants';
import type { ArchiveShape, ArchivedResult, Correction } from '@/lib/archiveFix';

/**
 * Correcting a leg time in a closed year, from the admin screen.
 *
 * The result is chosen from that year's own results and the leg from that
 * result's own legs, so nothing has to be spelled and nothing can be mistyped.
 * Each leg is offered with the time it currently holds, which is also how the
 * admin sees at a glance which leg is the wrong one.
 *
 * Then two presses. The first only works out what would change and shows it;
 * nothing is written until the admin has read the before-and-after and pressed
 * again. These are published results, and the usual reason to be here is a
 * number someone is reading off a photograph — so the check belongs in front of
 * the change, not after it.
 */
export default function ArchivedTimeFixForm({
  results,
  shapes = [],
}: {
  results: Record<string, ArchivedResult[]>;
  shapes?: ArchiveShape[];
}) {
  const t = useTranslations('manage');
  const locale = useLocale();
  const router = useRouter();

  const years = useMemo(
    () => Object.keys(results).map(Number).sort((a, b) => b - a),
    [results]
  );
  const [year, setYear] = useState(String(years[0] ?? ''));
  const [entryId, setEntryId] = useState('');
  const [leg, setLeg] = useState('');
  const [split, setSplit] = useState('');

  const [preview, setPreview] = useState<Correction | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Correction | null>(null);
  // How many results the re-publish actually wrote. Zero means the archive was
  // corrected but the Hall of Fame was not rebuilt, which must be said rather
  // than dressed up as success.
  const [imported, setImported] = useState(0);
  const [isPending, startTransition] = useTransition();

  const yearResults = results[year] ?? [];
  const chosen = yearResults.find((r) => r.entryId === entryId) ?? null;
  // Nothing to pick: say what that year's archive actually holds rather than
  // show an empty box. A blank list is a fact about the data, and the admin
  // cannot see the data.
  const shape = shapes.find((s) => String(s.year) === year) ?? null;

  const time = (seconds: number | null | undefined) => (seconds == null ? '—' : formatHms(seconds));
  const legLabel = (l: Leg) => (l === 'SWIM' ? t('legSwim') : l === 'BIKE' ? t('legBike') : t('legRun'));

  // The results of one field, together, so the list reads like the results page.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, ArchivedResult[]>();
    for (const r of yearResults) byCategory.set(r.categoryHe, [...(byCategory.get(r.categoryHe) ?? []), r]);
    return [...byCategory.entries()];
  }, [yearResults]);

  const message = (code: string) =>
    ({
      'no-archive': t('fixErrorNoArchive'),
      'not-found': t('fixErrorNotFound'),
      'no-stamp': t('fixErrorNoStamp'),
      'no-previous': t('fixErrorNoPrevious'),
      split: t('fixErrorSplit'),
      entry: t('fixErrorEntry'),
      leg: t('fixErrorLeg'),
      year: t('fixErrorYear'),
    })[code] ?? t('fixErrorSplit');

  const run = (apply: boolean) => {
    setError('');
    startTransition(async () => {
      const fd = new FormData();
      fd.set('year', year);
      fd.set('entryId', entryId);
      fd.set('leg', leg);
      fd.set('split', split);
      fd.set('apply', String(apply));

      const outcome = await fixArchivedLegTime(locale, fd);
      if ('error' in outcome) {
        setError(message(outcome.error));
        setPreview(null);
        return;
      }
      if (apply) {
        setImported(outcome.imported);
        setDone(outcome.correction);
        setPreview(null);
        router.refresh();
      } else {
        setPreview(outcome.correction);
      }
    });
  };

  if (done) {
    return (
      <div className="space-y-2">
        <p className={`text-sm font-semibold ${imported > 0 ? 'text-swim-dark' : 'text-ink'}`}>
          {imported > 0 ? '✓ ' : ''}
          {imported > 0 ? t('fixApplied', { entry: done.name }) : t('fixAppliedArchiveOnly', { entry: done.name })}
        </p>
        <p className="text-sm text-ink-light">
          {t('fixAppliedTotals', { before: time(done.before.total), after: time(done.after.total) })}
        </p>
        {imported === 0 && <p className="text-sm font-semibold text-run-dark">{t('fixNotRepublished')}</p>}
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setEntryId('');
            setLeg('');
            setSplit('');
          }}
          className="text-sm font-semibold underline"
        >
          {t('fixAnother')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-ink-light">{t('fixYear')}</span>
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setEntryId('');
              setLeg('');
              setPreview(null);
            }}
            className="mt-0.5 rounded-lg border border-ink/20 bg-surface px-3 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className={`text-sm ${yearResults.length === 0 ? 'hidden' : ''}`}>
          <span className="block text-xs text-ink-light">{t('fixResult')}</span>
          <select
            value={entryId}
            onChange={(e) => {
              setEntryId(e.target.value);
              setLeg('');
              setPreview(null);
            }}
            className="mt-0.5 w-full max-w-md rounded-lg border border-ink/20 bg-surface px-3 py-1.5 text-sm sm:w-80"
          >
            <option value="">{t('fixResultPick')}</option>
            {grouped.map(([categoryHe, rows]) => (
              <optgroup key={categoryHe} label={categoryHe}>
                {rows.map((r) => (
                  <option key={r.entryId} value={r.entryId}>
                    {time(r.splits.total)} · {r.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {chosen && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-ink-light">{t('fixLeg')}</span>
            <select
              value={leg}
              onChange={(e) => {
                setLeg(e.target.value);
                setPreview(null);
              }}
              className="mt-0.5 rounded-lg border border-ink/20 bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">{t('fixLegPick')}</option>
              {LEGS.map((l) => (
                <option key={l} value={l}>
                  {legLabel(l)} · {time(chosen.splits[l.toLowerCase() as 'swim' | 'bike' | 'run'])}
                  {chosen.legNames[l] ? ` · ${chosen.legNames[l]}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-xs text-ink-light">{t('fixSplit')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={split}
              onChange={(e) => {
                setSplit(e.target.value);
                setPreview(null);
              }}
              placeholder="7:10"
              className="mt-0.5 w-24 rounded-lg border border-ink/20 px-3 py-1.5 text-sm tabular-nums"
            />
          </label>

          <button
            type="button"
            onClick={() => run(false)}
            disabled={isPending || !leg || !split}
            className="rounded-full border border-ink/20 bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:opacity-40"
          >
            {t('fixPreview')}
          </button>
        </div>
      )}

      {yearResults.length === 0 && (
        <p className="text-sm text-ink-light">
          {shape
            ? t('fixNothingToList', {
                year: String(shape.year),
                heats: shape.heats,
                entries: shape.entries,
                categories: shape.categories,
              })
            : t('fixErrorNoArchive')}
        </p>
      )}

      {error && <p className="text-sm font-semibold text-run-dark">{error}</p>}

      {preview && (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm font-semibold">{preview.name}</p>
          <p className="mb-2 text-xs text-ink-light">
            {t('fixPreviewHint', {
              leg: legLabel(preview.leg),
              who: preview.legName ?? preview.name,
              time: time(preview.newSplitSeconds),
            })}
          </p>
          <table className="text-sm">
            <thead>
              <tr className="text-xs text-ink-light">
                <th className="pe-6 text-start font-medium"></th>
                <th className="pe-6 text-start font-medium">{t('fixBefore')}</th>
                <th className="text-start font-medium">{t('fixAfter')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {LEGS.map((l) => {
                const key = l.toLowerCase() as 'swim' | 'bike' | 'run';
                return (
                  <tr key={l} className={l === preview.leg ? 'font-semibold' : ''}>
                    <td className="pe-6 text-ink-light">{legLabel(l)}</td>
                    <td className="pe-6">{time(preview.before[key])}</td>
                    <td>
                      {time(preview.after[key])}
                      {l === preview.leg ? ' ←' : ''}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-ink/10 font-semibold">
                <td className="pe-6 text-ink-light">{t('fixTotal')}</td>
                <td className="pe-6">{time(preview.before.total)}</td>
                <td>{time(preview.after.total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => run(true)}
              disabled={isPending}
              className="rounded-full bg-run-dark px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {t('fixApply')}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="text-sm text-ink-light underline">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
