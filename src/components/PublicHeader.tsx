import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';

export default async function PublicHeader() {
  const t = await getTranslations('nav');

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-6 py-4">
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
        <Link href="/register" className="hover:underline">
          {t('register')}
        </Link>
        <Link href="/schedule" className="hover:underline">
          {t('schedule')}
        </Link>
        <Link href="/results" className="hover:underline">
          {t('results')}
        </Link>
        <Link href="/login" className="hover:underline">
          {t('login')}
        </Link>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
