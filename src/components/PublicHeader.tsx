import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { logoutAction } from '@/actions/auth';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';

export default async function PublicHeader() {
  const t = await getTranslations('nav');
  const locale = await getLocale();
  const session = await getSession();
  const logout = logoutAction.bind(null, locale);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-6 py-4">
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
        <Link href="/register" className="hover:underline">
          {t('register')}
        </Link>
        <Link href="/competitors" className="hover:underline">
          {t('competitors')}
        </Link>
        <Link href="/schedule" className="hover:underline">
          {t('schedule')}
        </Link>
        <Link href="/results" className="hover:underline">
          {t('results')}
        </Link>
        <Link href="/hall-of-fame" className="hover:underline">
          {t('hallOfFame')}
        </Link>
        <Link href="/info" className="hover:underline">
          {t('info')}
        </Link>
        {session ? (
          // A logged-in staff member browsing the public pages keeps their
          // session — show the way back to their area and a logout button
          // instead of a "log in" link, so navigating here never feels like
          // being signed out.
          <>
            <Link
              href={session.role === 'ADMIN' ? '/staff/manage' : '/staff/stations'}
              className="rounded-full bg-ink px-4 py-1.5 text-cream hover:brightness-110"
            >
              {session.role === 'ADMIN' ? t('manage') : t('stations')}
            </Link>
            <form action={logout}>
              <button type="submit" className="rounded-full border border-ink/20 px-4 py-1.5 hover:bg-ink/5">
                {t('logout')}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="hover:underline">
            {t('login')}
          </Link>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
