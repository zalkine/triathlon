import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import PublicHeader from '@/components/PublicHeader';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tb = await getTranslations('brand');

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lockup.png" alt={tb('name')} className="h-36 w-auto sm:h-48" />
        <div className="space-y-3">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('welcome')}</h1>
          <p className="mx-auto max-w-md text-ink-light">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-swim px-8 py-3 text-lg font-semibold text-ink shadow-sm transition hover:brightness-95"
          >
            {t('registerCta')}
          </Link>
          <Link
            href="/results"
            className="rounded-full bg-run px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:brightness-95"
          >
            {t('viewResults')}
          </Link>
          <Link
            href="/schedule"
            className="rounded-full bg-bike px-8 py-3 text-lg font-semibold text-ink shadow-sm transition hover:brightness-95"
          >
            {t('scheduleCta')}
          </Link>
          <Link
            href="/login"
            className="rounded-full border-2 border-ink/20 px-8 py-3 text-lg font-semibold text-ink transition hover:bg-ink/5"
          >
            {t('staffLogin')}
          </Link>
        </div>
      </main>
    </div>
  );
}
