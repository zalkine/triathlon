'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { fixArchivedLegTime } from '@/actions/competition';
import { formatHms } from '@/lib/hallOfFame';
import type { Correction } from '@/lib/archiveFix';

/**
 * Correcting a leg time in a closed year, from the admin screen.
 *
 * Deliberately two presses. The first only works out what would change and
 * shows it; nothing is written until the admin has read the before-and-after and
 * pressed again. These are published results, and the usual reason to be here is
 * a number someone is reading off a photograph — so the check belongs in front
 * of the change, not after it.
 */
export default function ArchivedTimeFixForm({ years }: { years: number[] }) {
  const t = useTranslations('manage');
  const locale = useLocale();
  const router = useRouter();

  const [year, setYear] = useState(String(years[0] ?? ''));
  const [competitor, setCompetitor] = useState('');
  const [split, setSplit] = useState('');
  const [leg, setLeg] = useState('');
  const [team, setTeam] = useState('');

  const [preview, setPreview] = useState<Correction | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Correction | null>(null);
  const [isPending, startTransition] = useTransition();

  const message = (code: string) =>
    ({
      'no-archive': t('fixErrorNoArchive'),
      'not-found': t('fixErrorNotFound'),
      ambiguous: t('fixErrorAmbiguous'),
      'no-leg': t('fixErrorNoLeg'),
      'no-stamp': t('fixErrorNoStamp'),
      'no-previous': t('fixErrorNoPrevious'),
      split: t('fixErrorSplit'),
      competitor: t('fixErrorCompetitor'),
      year: t('fixErrorYear'),
    })[code] ?? t('fixErrorSplit');

  const run = (apply: boolean) => {
    setError('');
    setCandidates([]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('year', year);
      fd.set('competitor', competitor);
      fd.set('split', split);
      fd.set('leg', leg);
      fd.set('team', team);
      fd.set('apply', String(apply));

      const outcome = await fixArchivedLegTime(locale, fd);
      if ('error' in outcome) {
        setError(message(outcome.error));
        if (outcome.error === 'ambiguous') setCandidates(outcome.candidates);
        setPreview(null);
        return;
      }
      if (apply) {
        setDone(outcome.correction);
        setPreview(null);
        router.refresh();
      } else {
        setPreview(outcome.correction);
      }
    });
  };

  const time = (seconds: number | null) => (seconds == null ? '—' : formatHms(seconds));

  if (done) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-swim-dark">
          ✓ {t('fixApplied', { competitor: done.competitor, entry: done.entryName })}
        </p>
        <p className="text-sm text-ink-light">
          {t('fixAppliedTotals', { before: time(done.before.total), after: time(done.after.total) })}
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setCompetitor('');
            setSplit('');
            setLeg('');
            setTeam('');
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
            onChange={(e) => setYear(e.target.value)}
            className="mt-0.5 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-xs text-ink-light">{t('fixCompetitor')}</span>
          <input
            type="text"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder={t('fixCompetitorPlaceholder')}
            className="mt-0.5 w-56 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="block text-xs text-ink-light">{t('fixLeg')}</span>
          <select
            value={leg}
            onChange={(e) => setLeg(e.target.value)}
            className="mt-0.5 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
          >
            <option value="">{t('fixLegAuto')}</option>
            <option value="SWIM">{t('legSwim')}</option>
            <option value="BIKE">{t('legBike')}</option>
            <option value="RUN">{t('legRun')}</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-xs text-ink-light">{t('fixSplit')}</span>
          <input
            type="text"
            value={split}
            onChange={(e) => setSplit(e.target.value)}
            placeholder="7:10"
            className="mt-0.5 w-24 rounded-lg border border-ink/20 px-3 py-1.5 text-sm tabular-nums"
          />
        </label>

        <button
          type="button"
          onClick={() => run(false)}
          disabled={isPending}
          className="rounded-full border border-ink/20 bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:opacity-40"
        >
          {t('fixPreview')}
        </button>
      </div>

      {candidates.length > 0 && (
        <div className="text-sm">
          <p className="text-ink-light">{t('fixPickTeam')}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setTeam(c);
                  setCandidates([]);
                }}
                className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-ink/5"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {team && (
        <p className="text-xs text-ink-light">
          {t('fixTeamChosen', { team })}{' '}
          <button type="button" onClick={() => setTeam('')} className="underline">
            {t('clearSelection')}
          </button>
        </p>
      )}

      {error && <p className="text-sm font-semibold text-run-dark">{error}</p>}

      {preview && (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm font-semibold">{preview.entryName}</p>
          <p className="mb-2 text-xs text-ink-light">
            {t('fixPreviewHint', { competitor: preview.competitor, time: time(preview.newSplitSeconds) })}
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
              {(
                [
                  ['SWIM', t('legSwim'), preview.before.swim, preview.after.swim],
                  ['BIKE', t('legBike'), preview.before.bike, preview.after.bike],
                  ['RUN', t('legRun'), preview.before.run, preview.after.run],
                ] as const
              ).map(([key, label, was, now]) => (
                <tr key={key} className={key === preview.leg ? 'font-semibold' : ''}>
                  <td className="pe-6 text-ink-light">{label}</td>
                  <td className="pe-6">{time(was)}</td>
                  <td>
                    {time(now)}
                    {key === preview.leg ? ' ←' : ''}
                  </td>
                </tr>
              ))}
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
