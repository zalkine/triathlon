import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import PublicHeader from '@/components/PublicHeader';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tb = await getTranslations('brand');
  const tn = await getTranslations('nav');

  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  const registrationOpen = settings?.registrationOpen ?? false;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        {/* Save-the-date hero */}
        <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-b from-cream to-white shadow-sm">
          <div className="flex flex-col items-center gap-5 px-6 py-10 text-center sm:py-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-lockup.png" alt={tb('name')} className="h-28 w-auto sm:h-36" />

            <span className="rounded-lg border-2 border-bike-dark/50 bg-bike/15 px-5 py-1.5 text-lg font-extrabold tracking-[0.2em] text-bike-dark sm:text-xl">
              {t('saveTheDate')}
            </span>

            <p className="text-lg font-medium text-ink sm:text-xl">{t('tagline1')}</p>

            <span className="block bg-gradient-to-b from-run to-run-dark bg-clip-text text-8xl font-black leading-none text-transparent sm:text-9xl">
              {t('date')}
            </span>

            <p className="text-2xl font-bold text-swim-dark sm:text-3xl">{t('tagline2')}</p>

            {/* Hall of Fame — primary CTA, always visible */}
            <Link
              href="/hall-of-fame"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-run to-run-dark px-8 py-3 text-lg font-bold text-white shadow-md transition hover:brightness-95"
            >
              🏆 {tn('hallOfFame')}
            </Link>
            <p className="text-xs text-ink-light">{t('hofSubtitle')}</p>
          </div>

          {/* three-color accent bar echoing the logo */}
          <div className="flex h-2 w-full">
            <div className="flex-1 bg-run" />
            <div className="flex-1 bg-bike" />
            <div className="flex-1 bg-swim" />
          </div>
        </section>

        {/* secondary links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {registrationOpen && (
            <Link
              href="/register"
              className="rounded-full bg-swim px-6 py-2.5 font-semibold text-ink shadow-sm transition hover:brightness-95"
            >
              {t('registerCta')}
            </Link>
          )}
          <Link
            href="/schedule"
            className="rounded-full bg-bike px-6 py-2.5 font-semibold text-ink shadow-sm transition hover:brightness-95"
          >
            {t('scheduleCta')}
          </Link>
          <Link
            href="/results"
            className="rounded-full bg-run px-6 py-2.5 font-semibold text-white shadow-sm transition hover:brightness-95"
          >
            {t('viewResults')}
          </Link>
          <Link
            href="/login"
            className="rounded-full border-2 border-ink/20 px-6 py-2.5 font-semibold text-ink transition hover:bg-ink/5"
          >
            {t('staffLogin')}
          </Link>
        </div>
      </main>
    </div>
  );
}
