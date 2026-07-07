import { getTranslations } from 'next-intl/server';
import PublicHeader from '@/components/PublicHeader';
import {
  buckets,
  championsFor,
  courseRecords,
  familyLabel,
  formatHms,
  kindLabel,
  resultsFor,
  years,
} from '@/lib/hallOfFame';

export default async function HallOfFamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('hof');

  const records = courseRecords();
  const allYears = years();
  const bucketList = buckets();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-10 px-6 py-10">
        <header>
          <h1 className="text-3xl font-black">{t('title')}</h1>
          <p className="text-ink-light">{t('subtitle')}</p>
        </header>

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
                {championsFor(year).map((c) => (
                  <li key={`${c.family}-${c.isTeam}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink-light">
                      {familyLabel(c.family, locale)} · {kindLabel(c.isTeam, locale)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-end font-semibold">{c.name}</span>
                    <span className="font-mono tabular-nums text-swim-dark">{formatHms(c.seconds)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Full results, browsable */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">📜 {t('allResults')}</h2>
          {allYears.map((year) => (
            <details key={year} className="rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-sm">
              <summary className="cursor-pointer text-lg font-bold">{year}</summary>
              <div className="mt-3 space-y-5">
                {bucketList.map(({ family, isTeam }) => {
                  const rows = resultsFor(year, family, isTeam);
                  if (rows.length === 0) return null;
                  return (
                    <div key={`${family}-${isTeam}`}>
                      <h4 className="mb-1 text-sm font-semibold text-ink-light">
                        {familyLabel(family, locale)} · {kindLabel(isTeam, locale)}
                      </h4>
                      <ol className="divide-y divide-ink/5">
                        {rows.map((r, i) => (
                          <li key={i} className="flex items-baseline gap-3 py-1.5 text-sm">
                            <span className="w-6 text-end font-mono text-ink-light">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                            <span className="font-mono tabular-nums text-ink-light">{formatHms(r.seconds)}</span>
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
