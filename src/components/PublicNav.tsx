'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';

type NavLink = { href: string; label: string };

/**
 * Client-side public navigation. `PublicHeader` (a server component) fetches
 * the session + translations and hands the resolved links/labels down as
 * props; this component owns the mobile open/close state. On `md+` the nav is
 * a horizontal row of framed links; below that it collapses behind a ☰ button
 * into an absolute dropdown panel.
 */
export default function PublicNav({
  links,
  session,
  labels,
  logout,
}: {
  links: NavLink[];
  session: { role: string } | null;
  labels: { login: string; logout: string; manage: string; stations: string };
  logout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Framed button look shared by every nav link. `w-full text-center` makes
  // the links fill the mobile dropdown; `md:w-auto` lets them size to content
  // in the horizontal desktop row.
  const linkClass =
    'block w-full rounded-full border border-ink/20 bg-white px-4 py-2 text-center text-sm font-medium text-ink transition hover:bg-ink/5 md:w-auto';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="menu"
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-ink/20 bg-white text-2xl leading-none text-ink md:hidden"
      >
        ☰
      </button>
      <nav
        className={`${
          open ? 'flex' : 'hidden'
        } absolute inset-x-0 top-full z-20 flex-col gap-2.5 border-b border-ink/10 bg-cream px-6 py-4 shadow-lg md:static md:flex md:flex-row md:flex-wrap md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={close} className={linkClass}>
            {l.label}
          </Link>
        ))}
        {session ? (
          // A logged-in staff member browsing the public pages keeps their
          // session — show the way back to their area and a logout button
          // instead of a "log in" link, so navigating here never feels like
          // being signed out.
          <>
            <Link
              href={session.role === 'ADMIN' ? '/staff/manage' : '/staff/stations'}
              onClick={close}
              className="block w-full rounded-full bg-ink px-4 py-2 text-center text-sm font-medium text-cream transition hover:brightness-110 md:w-auto"
            >
              {session.role === 'ADMIN' ? labels.manage : labels.stations}
            </Link>
            <form action={logout} className="w-full md:w-auto">
              <button
                type="submit"
                className="block w-full rounded-full border border-ink/20 bg-white px-4 py-2 text-center text-sm font-medium text-ink transition hover:bg-ink/5 md:w-auto"
              >
                {labels.logout}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" onClick={close} className={linkClass}>
            {labels.login}
          </Link>
        )}
        <div className="flex justify-center md:block">
          <LanguageSwitcher />
        </div>
      </nav>
    </>
  );
}
