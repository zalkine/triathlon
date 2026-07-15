'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 rounded-full border border-ink/15 bg-surface/60 p-1 text-sm">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={`rounded-full px-2.5 py-1 font-medium transition sm:px-3 ${
            l === locale ? 'bg-ink text-cream' : 'text-ink/70 hover:bg-ink/10'
          }`}
          aria-current={l === locale}
          aria-label={l === 'he' ? 'עברית' : 'English'}
        >
          {/* Abbreviated on mobile to keep the header controls on one row; the
              full name shows once there's room (sm+). */}
          <span className="sm:hidden">{l === 'he' ? 'עב' : 'En'}</span>
          <span className="hidden sm:inline">{l === 'he' ? 'עברית' : 'English'}</span>
        </button>
      ))}
    </div>
  );
}
