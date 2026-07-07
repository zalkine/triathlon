'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { medalTable } from '@/lib/hallOfFame';

export default function MedalTable() {
  const t = useTranslations('hof');
  const [includeGroups, setIncludeGroups] = useState(false);

  const personal = useMemo(() => medalTable(false), []);
  const withGroups = useMemo(() => medalTable(true), []);
  const rows = includeGroups ? withGroups : personal;

  const Tab = ({ on, label }: { on: boolean; label: string }) => (
    <button
      type="button"
      onClick={() => setIncludeGroups(on)}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        includeGroups === on ? 'bg-ink text-cream' : 'text-ink-light hover:bg-ink/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">🏅 {t('medalists')}</h2>
        <div className="inline-flex rounded-full border border-ink/15 p-0.5">
          <Tab on={false} label={t('medalsPersonal')} />
          <Tab on={true} label={t('medalsWithGroups')} />
        </div>
      </div>
      <p className="text-sm text-ink-light">{includeGroups ? t('medalsWithGroupsNote') : t('medalsNote')}</p>

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/70 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-ink-light">
              <th className="px-4 py-2 text-start font-medium">{t('athlete')}</th>
              <th className="px-3 py-2 text-center font-medium">🥇</th>
              <th className="px-3 py-2 text-center font-medium">🥈</th>
              <th className="px-3 py-2 text-center font-medium">🥉</th>
              <th className="px-4 py-2 text-center font-medium">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.name} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 text-center tabular-nums">{m.gold || ''}</td>
                <td className="px-3 py-2 text-center tabular-nums">{m.silver || ''}</td>
                <td className="px-3 py-2 text-center tabular-nums">{m.bronze || ''}</td>
                <td className="px-4 py-2 text-center font-semibold tabular-nums">{m.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
