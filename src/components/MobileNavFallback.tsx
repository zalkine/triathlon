import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { publicNavLinks } from './publicNavLinks';

/**
 * Mobile-only echo of the header hamburger menu. Some visitors won't think to
 * tap the ☰, so on small screens we repeat the same nav links as a compact
 * wrapped row of small buttons below the hero. Hidden from `md` up, where the
 * full header nav is always visible. (Staff login and the language toggle
 * stay in the header itself, so they're not repeated here.)
 */
export default async function MobileNavFallback() {
  const t = await getTranslations('nav');
  const links = publicNavLinks(t);

  return (
    <nav
      aria-label={t('home')}
      className="mt-8 flex w-full max-w-md flex-wrap items-center justify-center gap-2 md:hidden"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-full border border-ink/20 bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink/5"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
