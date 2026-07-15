'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createHistoricalResult, updateHistoricalResult, deleteHistoricalResult } from '@/actions/hof';
import { familyLabel, formatHms, kindLabel, FAMILY_ORDER, type Family } from '@/lib/hallOfFame';

type Row = {
  id: string;
  year: number;
  categoryHe: string;
  family: Family;
  isTeam: boolean;
  rank: number | null;
  name: string;
  seconds: number;
  members?: string[];
};

const inputCls = 'rounded-lg border border-ink/20 px-2 py-1 text-sm focus:border-ink focus:outline-none';

function RowForm({
  row,
  onSubmit,
  onCancel,
  pending,
}: {
  row?: Row;
  onSubmit: (form: HTMLFormElement) => void;
  onCancel?: () => void;
  pending: boolean;
}) {
  const t = useTranslations('manage');
  const locale = useLocale();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e.currentTarget);
      }}
      className="grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-surface/60 p-3 sm:grid-cols-4"
    >
      <label className="flex flex-col gap-1 text-xs text-ink-light">
        {t('hofYear')}
        <input name="year" type="number" required defaultValue={row?.year ?? new Date().getFullYear()} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-light">
        {t('hofFamily')}
        <select name="family" defaultValue={row?.family ?? 'Elite'} className={inputCls}>
          {FAMILY_ORDER.map((f) => (
            <option key={f} value={f}>
              {familyLabel(f, locale)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-light">
        {t('hofCategory')}
        <input name="categoryHe" defaultValue={row?.categoryHe ?? ''} placeholder={t('hofCategory')} className={inputCls} />
      </label>
      <label className="flex items-center gap-2 self-end text-xs text-ink-light">
        <input name="isTeam" type="checkbox" defaultChecked={row?.isTeam ?? false} />
        {t('hofIsTeam')}
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-light">
        {t('hofName')}
        <input name="name" required defaultValue={row?.name ?? ''} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-light">
        {t('hofRank')}
        <input name="rank" type="number" defaultValue={row?.rank ?? ''} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-light">
        {t('hofTime')}
        <input name="seconds" required defaultValue={row ? formatHms(row.seconds) : ''} placeholder="mm:ss" className={inputCls} />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-light sm:col-span-4">
        {t('hofMembers')}
        <input name="members" defaultValue={(row?.members ?? []).join(', ')} placeholder={t('hofMembersHint')} className={inputCls} />
      </label>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-60">
          {t('save')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-ink-light">
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  );
}

export default function HofEditor({ rows }: { rows: Row[] }) {
  const t = useTranslations('manage');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const doUpdate = (id: string, form: HTMLFormElement) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await updateHistoricalResult(id, fd);
      if (!res.error) {
        setEditingId(null);
        router.refresh();
      } else {
        window.alert(t('hofError'));
      }
    });
  };

  const doCreate = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createHistoricalResult(undefined, fd);
      if (res.success) {
        setAdding(false);
        router.refresh();
      } else {
        window.alert(t('hofError'));
      }
    });
  };

  const doDelete = (id: string) => {
    if (!window.confirm(t('hofConfirmDelete'))) return;
    startTransition(async () => {
      await deleteHistoricalResult(id, new FormData());
      router.refresh();
    });
  };

  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-light">{t('hofHint')}</p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-full border border-ink/20 px-4 py-1.5 text-sm font-semibold hover:bg-ink/5"
        >
          {adding ? t('cancel') : t('hofAdd')}
        </button>
      </div>

      {adding && <RowForm onSubmit={doCreate} onCancel={() => setAdding(false)} pending={isPending} />}

      {years.map((year, yi) => (
        <details key={year} open={yi === 0} className="rounded-2xl border border-ink/10 bg-surface/70 p-4">
          <summary className="cursor-pointer font-bold">{year}</summary>
          <ul className="mt-3 space-y-2">
            {rows
              .filter((r) => r.year === year)
              .map((r) =>
                editingId === r.id ? (
                  <li key={r.id}>
                    <RowForm row={r} onSubmit={(f) => doUpdate(r.id, f)} onCancel={() => setEditingId(null)} pending={isPending} />
                  </li>
                ) : (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 py-1.5 text-sm last:border-0">
                    <div className="min-w-0">
                      <span className="font-medium">{r.name}</span>{' '}
                      <span className="text-xs text-ink-light">
                        · {familyLabel(r.family, locale)} · {kindLabel(r.isTeam, locale)}
                        {r.rank != null && ` · #${r.rank}`}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono tabular-nums text-ink-light">{formatHms(r.seconds)}</span>
                      <button type="button" onClick={() => setEditingId(r.id)} className="text-xs text-ink-light underline">
                        {t('edit')}
                      </button>
                      <button type="button" onClick={() => doDelete(r.id)} className="text-xs text-run-dark underline">
                        {t('deleteRegistrant')}
                      </button>
                    </div>
                  </li>
                )
              )}
          </ul>
        </details>
      ))}
    </div>
  );
}
