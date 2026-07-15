'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Theme = 'light' | 'dark';

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Apply a resolved theme to the document. Kept in sync with the pre-paint
// script in the layout so the toggle and the initial load agree.
function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f1a1f' : '#eef4f4');
}

/**
 * Light/dark theme toggle for the header. The default follows the phone's
 * `prefers-color-scheme`; once the visitor picks a side we persist it in
 * localStorage and stop following the OS. Sits next to the language switcher.
 */
export default function ThemeToggle() {
  const t = useTranslations('theme');
  // `null` until mounted so SSR markup matches the client (the real theme is
  // only known in the browser). We render a neutral placeholder meanwhile.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    setTheme(stored === 'dark' || stored === 'light' ? stored : systemPrefersDark() ? 'dark' : 'light');

    // While the visitor hasn't chosen, keep following the OS setting live.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const next: Theme = e.matches ? 'dark' : 'light';
        apply(next);
        setTheme(next);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    apply(next);
    setTheme(next);
  };

  const isDark = theme === 'dark';
  const label = isDark ? t('toLight') : t('toDark');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={theme === null ? t('label') : label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-surface/60 text-lg text-ink transition hover:bg-ink/10"
    >
      {/* Show the icon of the mode you'd switch TO. Neutral until mounted. */}
      <span aria-hidden>{theme === null ? '◐' : isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
