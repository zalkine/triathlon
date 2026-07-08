'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MANAGE_TABS, type ManageTabKey } from './tabs';

// Horizontally-scrollable tab bar following the competition sequence. Works on
// phone, tablet and desktop; the active tab is driven by the ?tab= query param.
export default function ManageTabs({ active }: { active: ManageTabKey }) {
  const t = useTranslations('manage');
  const params = useSearchParams();

  // Preserve any other query params (none today, but keeps links robust).
  const hrefFor = (key: ManageTabKey) => {
    const sp = new URLSearchParams(params.toString());
    sp.set('tab', key);
    return `/staff/manage?${sp.toString()}`;
  };

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <nav className="flex w-max min-w-full gap-1 rounded-full border border-ink/10 bg-white/60 p-1">
        {MANAGE_TABS.map((tab, i) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={hrefFor(tab.key)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-ink text-cream shadow-sm' : 'text-ink-light hover:bg-ink/5'
              }`}
            >
              <span className="tabular-nums opacity-70">{i + 1}</span>
              <span aria-hidden>{tab.icon}</span>
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
