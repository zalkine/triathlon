import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { logoutAction } from '@/actions/auth';
import Logo from './Logo';
import PublicNav from './PublicNav';

export default async function PublicHeader() {
  const t = await getTranslations('nav');
  const locale = await getLocale();
  const session = await getSession();
  const logout = logoutAction.bind(null, locale);

  const links = [
    { href: '/register', label: t('register') },
    { href: '/competitors', label: t('competitors') },
    { href: '/schedule', label: t('schedule') },
    { href: '/results', label: t('results') },
    { href: '/competition-info', label: t('competitionInfo') },
    { href: '/trails', label: t('trails') },
    { href: '/hall-of-fame', label: t('hallOfFame') },
    { href: '/info', label: t('info') },
  ];

  return (
    <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-6 py-4">
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <PublicNav
        links={links}
        session={session ? { role: session.role } : null}
        labels={{
          login: t('login'),
          logout: t('logout'),
          manage: t('manage'),
          stations: t('stations'),
        }}
        logout={logout}
      />
    </header>
  );
}
