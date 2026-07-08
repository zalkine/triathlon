import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { logoutAction } from '@/actions/auth';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('nav');
  const session = await getSession();
  const logout = logoutAction.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-6 py-4">
        <Link href="/staff/stations">
          <Logo size="sm" />
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
          <Link href="/staff/stations" className="hover:underline">
            {t('stations')}
          </Link>
          <Link href="/staff/checkin" className="hover:underline">
            {t('checkin')}
          </Link>
          <Link href="/competitors" className="hover:underline">
            {t('competitors')}
          </Link>
          {session?.role === 'ADMIN' && (
            <Link href="/staff/manage" className="hover:underline">
              {t('manage')}
            </Link>
          )}
          <Link href="/results" className="hover:underline">
            {t('results')}
          </Link>
          <LanguageSwitcher />
          <form action={logout}>
            <button type="submit" className="rounded-full border border-ink/20 px-4 py-1.5 hover:bg-ink/5">
              {t('logout')}
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
