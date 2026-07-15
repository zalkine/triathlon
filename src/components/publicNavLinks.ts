export type NavLink = { href: string; label: string };

/**
 * The public site's primary nav links, in display order. Shared by the header
 * hamburger (`PublicNav`) and the mobile fallback row (`MobileNavFallback`) so
 * the two stay in sync. Pass the `nav` translator from either a server
 * component (`getTranslations`) or a client one (`useTranslations`).
 */
export function publicNavLinks(t: (key: string) => string): NavLink[] {
  return [
    { href: '/register', label: t('register') },
    { href: '/competitors', label: t('competitors') },
    { href: '/schedule', label: t('schedule') },
    { href: '/results', label: t('results') },
    { href: '/competition-info', label: t('competitionInfo') },
    { href: '/trails', label: t('trails') },
    { href: '/hall-of-fame', label: t('hallOfFame') },
    { href: '/info', label: t('info') },
  ];
}
