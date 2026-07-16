import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import PublicHeader from '@/components/PublicHeader';
import MobileNavFallback from '@/components/MobileNavFallback';
import LandingSplash from '@/components/LandingSplash';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tb = await getTranslations('brand');
  const tn = await getTranslations('nav');

  return (
    <div className="flex min-h-screen flex-col">
      <LandingSplash />
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center px-6 py-6 sm:py-10">
        {/* Save-the-date hero. Sizes and spacing are tightened on mobile so
            both CTAs stay above the fold on a phone; the sm: values restore
            the full-size desktop layout. */}
        <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-b from-cream to-surface shadow-sm">
          <div className="flex flex-col items-center gap-3 px-6 py-6 text-center sm:gap-5 sm:py-14">
            {/* Baked lockup in light mode; its wordmark is dark navy, so on
                dark-mode phones we swap to the icon mark + readable text name
                (same approach as the header logo). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-lockup.png"
              alt={tb('name')}
              className="h-20 w-auto sm:h-36 dark:hidden"
            />
            <div className="hidden flex-col items-center gap-2 dark:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="" className="h-14 w-auto sm:h-24" />
              <span className="text-2xl font-bold text-ink sm:text-4xl">{tb('name')}</span>
            </div>

            <span className="rounded-lg border-2 border-bike-dark/50 bg-bike/15 px-4 py-1 text-base font-extrabold tracking-[0.2em] text-bike-dark sm:px-5 sm:py-1.5 sm:text-xl">
              {t('saveTheDate')}
            </span>

            <p className="text-base font-medium text-ink sm:text-xl">{t('tagline1')}</p>

            <span className="block bg-gradient-to-b from-run to-run-dark bg-clip-text text-7xl font-black leading-none text-transparent sm:text-9xl">
              {t('date')}
            </span>

            {/* Primary CTAs — full-width stacked on mobile, side by side on sm+ */}
            <div className="mt-1 flex w-full flex-col items-stretch gap-3 sm:mt-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-swim px-8 py-4 text-xl font-extrabold text-ink shadow-lg transition hover:brightness-95 sm:px-11 sm:py-5 sm:text-3xl"
              >
                📝 {t('registerCta')}
              </Link>
              <Link
                href="/hall-of-fame"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-run to-run-dark px-8 py-4 text-xl font-extrabold text-white shadow-lg transition hover:brightness-95 sm:px-11 sm:py-5 sm:text-3xl"
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

        {/* Mobile-only fallback nav — repeats the hamburger links as small
            buttons for visitors who don't open the ☰ menu. */}
        <MobileNavFallback />
      </main>
    </div>
  );
}
