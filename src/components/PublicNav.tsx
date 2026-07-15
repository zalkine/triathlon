'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import type { NavLink } from './publicNavLinks';

/**
 * Public navigation. `PublicHeader` (a server component) resolves the session,
 * links and labels and hands them down; this client component owns the mobile
 * open/close state.
 *
 * Layout:
 * - `md+`  — one horizontal row of framed links + auth control + language
 *            toggle. No hamburger.
 * - `<md`  — staff login and the language toggle stay visible in the header
 *            next to a ☰ button; the ☰ toggles a dropdown holding the nav
 *            links.
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

  const frame =
    'rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink/5';

  // Staff login when signed out; the way back to the staff area + logout when
  // signed in. Rendered in both the desktop row and the mobile header cluster.
  const authControls = (onClick?: () => void) =>
    session ? (
      <>
        <Link
          href={session.role === 'ADMIN' ? '/staff/manage' : '/staff/stations'}
          onClick={onClick}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:brightness-110"
        >
          {session.role === 'ADMIN' ? labels.manage : labels.stations}
        </Link>
        <form action={logout}>
          <button type="submit" className={frame}>
            {labels.logout}
          </button>
        </form>
      </>
    ) : (
      <Link href="/login" onClick={onClick} className={frame}>
        {labels.login}
      </Link>
    );

  return (
    <>
      {/* Desktop: full nav row */}
      <nav className="hidden md:flex md:flex-wrap md:items-center md:gap-2.5">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={frame}>
            {l.label}
          </Link>
        ))}
        {authControls()}
        <LanguageSwitcher />
      </nav>

      {/* Mobile: staff login + language toggle + hamburger, always visible */}
      <div className="flex flex-wrap items-center justify-end gap-2 md:hidden">
        {authControls(close)}
        <LanguageSwitcher />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="menu"
          aria-expanded={open}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-ink/20 bg-white text-2xl leading-none text-ink"
        >
          ☰
        </button>
      </div>

      {/* Mobile: dropdown holding the nav links */}
      {open && (
        <nav className="absolute inset-x-0 top-full z-20 flex flex-col gap-2.5 border-b border-ink/10 bg-cream px-6 py-4 shadow-lg md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={close}
              className={`${frame} block w-full text-center`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
