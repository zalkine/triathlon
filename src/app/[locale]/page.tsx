import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import PublicHeader from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tb = await getTranslations('brand');
  const tn = await getTranslations('nav');

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

            {/* Primary CTAs — Register Now and Hall of Fame, always visible */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2.5 rounded-full bg-swim px-11 py-5 text-2xl font-extrabold text-ink shadow-lg transition hover:brightness-95 sm:text-3xl"
              >
                📝 {t('registerCta')}
              </Link>
              <Link
                href="/hall-of-fame"
                className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-run to-run-dark px-11 py-5 text-2xl font-extrabold text-white shadow-lg transition hover:brightness-95 sm:text-3xl"
              >
                🏆 {tn('hallOfFame')}
              </Link>
            </div>
          </div>

          {/* three-color accent bar echoing the logo */}
          <div className="flex h-2 w-full">
            <div className="flex-1 bg-run" />
            <div className="flex-1 bg-bike" />
            <div className="flex-1 bg-swim" />
          </div>
        </section>
      </main>
    </div>
  );
}
