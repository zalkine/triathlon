import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import CompetitorSearch from '@/components/CompetitorSearch';
import MedalTable from '@/components/MedalTable';
import { SPECIAL_AWARDS } from '@/data/historical';
import { loadHofResults } from '@/lib/hofData';
import {
  annotatedResults,
  buckets,
  championsFor,
  courseRecords,
  familyLabel,
  formatHms,
  kindLabel,
  medalTable,
  resultsFor,
  years,
} from '@/lib/hallOfFame';

export const dynamic = 'force-dynamic';

export default async function HallOfFamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('hof');

  const results = await loadHofResults();
  const records = courseRecords(results);
  const allYears = years(results);
  const bucketList = buckets(results);
  const annotated = annotatedResults(results);
  const medalsPersonal = medalTable(results, false);
  const medalsWithGroups = medalTable(results, true);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-10 px-6 py-10">
        <header>
          <h1 className="text-3xl font-black">{t('title')}</h1>
          <p className="text-ink-light">{t('subtitle')}</p>
        </header>

        {/* Search any competitor's full history (solo and team) */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">🔎 {t('findCompetitor')}</h2>
          <CompetitorSearch results={annotated} />
        </section>

        {/* All-time course records */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">🏆 {t('records')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {records.map((r) => (
              <div
                key={`${r.family}-${r.isTeam}`}
                className="rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-sm"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-ink-light">
                  {familyLabel(r.family, locale)} · {kindLabel(r.isTeam, locale)}
                </div>
                <div className="mt-1 font-mono text-3xl font-black tabular-nums text-run-dark">
                  {formatHms(r.seconds)}
                </div>
                <div className="mt-1 font-semibold">{r.name}</div>
                <div className="text-sm text-ink-light">{r.year}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Champions by year */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">🥇 {t('champions')}</h2>
          {allYears.map((year) => (
            <div key={year} className="rounded-2xl border border-ink/10 bg-white/70 p-5 shadow-sm">
              <h3 className="mb-3 text-lg font-bold">{year}</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {championsFor(results, year).map((c) => (
                  <li key={`${c.family}-${c.isTeam}`} className="text-sm">
                    <div className="text-xs text-ink-light">
                      {familyLabel(c.family, locale)} · {kindLabel(c.isTeam, locale)}
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="break-words font-semibold">{c.name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-swim-dark">{formatHms(c.seconds)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Special trophies (eldest / youngest / etc.) — only when we have data */}
        {SPECIAL_AWARDS.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold">🏆 {t('specialAwards')}</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...SPECIAL_AWARDS]
                .sort((a, b) => b.year - a.year)
                .map((a, i) => (
                  <div key={i} className="rounded-xl border border-ink/10 bg-white/70 p-3 text-sm shadow-sm">
                    <div className="text-xs text-ink-light">
                      {a.year} · {locale === 'he' ? a.titleHe : a.titleEn}
                    </div>
                    <div className="font-semibold">{a.name}</div>
                    {a.note && <div className="text-xs text-ink-light">{a.note}</div>}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Medal table (Personal / including group medals) */}
        <MedalTable personal={medalsPersonal} withGroups={medalsWithGroups} />

        {/* Full results, browsable */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">📜 {t('allResults')}</h2>
          {allYears.map((year) => (
            <details key={year} className="rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-sm">
              <summary className="cursor-pointer text-lg font-bold">{year}</summary>
              <div className="mt-3 space-y-5">
                {bucketList.map(({ family, isTeam }) => {
                  const rows = resultsFor(results, year, family, isTeam);
                  if (rows.length === 0) return null;
                  return (
                    <div key={`${family}-${isTeam}`}>
                      <h4 className="mb-1 text-sm font-semibold text-ink-light">
                        {familyLabel(family, locale)} · {kindLabel(isTeam, locale)}
                      </h4>
                      <ol className="divide-y divide-ink/5">
                        {rows.map((r, i) => (
                          <li key={i} className="flex items-baseline gap-3 py-1.5 text-sm">
                            <span className="w-6 shrink-0 text-end font-mono text-ink-light">{i + 1}</span>
                            <span className="min-w-0 flex-1 break-words font-medium">{r.name}</span>
                            <span className="shrink-0 font-mono tabular-nums text-ink-light">{formatHms(r.seconds)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </section>

        <p className="text-xs text-ink-light">{t('sourceNote')}</p>
      </main>
    </div>
  );
}
