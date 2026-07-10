'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createGroupWithLegs } from '@/actions/groups';

type Leg = 'SWIM' | 'BIKE' | 'RUN';
type PoolMember = { id: string; name: string };

const LEGS: Leg[] = ['SWIM', 'BIKE', 'RUN'];

// Admin group builder: pick who swims, bikes and runs from the available pool,
// then create a complete group in one step. Every leg must be filled so the
// runner is unambiguous at the finish line — but the same person can be chosen
// for two legs (e.g. one competitor swims *and* bikes while a teammate runs).
export default function CreateGroupForm({ categoryId, pool }: { categoryId: string; pool: PoolMember[] }) {
  const t = useTranslations('manage');
  const tc = useTranslations('competitors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<Leg, string>>({ SWIM: '', BIKE: '', RUN: '' });
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const legLabel = (leg: Leg) => (leg === 'SWIM' ? tc('roleSwim') : leg === 'BIKE' ? tc('roleBike') : tc('roleRun'));
  const complete = LEGS.every((leg) => picks[leg]);

  const reset = () => {
    setPicks({ SWIM: '', BIKE: '', RUN: '' });
    setError('');
    setOpen(false);
  };

  const submit = () => {
    if (!complete) {
      setError(t('createGroupIncomplete'));
      return;
    }
    setError('');
    startTransition(async () => {
      const result = await createGroupWithLegs(categoryId, picks);
      if (result.error) {
        setError(t('createGroupFailed'));
      } else {
        reset();
        router.refresh();
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-ink/30 px-3 py-1.5 text-xs font-semibold hover:bg-ink/5"
      >
        + {t('createGroup')}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-ink/20 bg-white/80 p-3 text-sm">
      <p className="text-xs text-ink-light">{t('createGroupHint')}</p>
      {LEGS.map((leg) => (
        <div key={leg} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-ink-light">{legLabel(leg)}</span>
          <select
            value={picks[leg]}
            onChange={(e) => setPicks((p) => ({ ...p, [leg]: e.target.value }))}
            className="min-w-0 flex-1 rounded border border-ink/20 px-2 py-1 text-sm"
          >
            <option value="">{t('createGroupPick')}</option>
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      {error && <p className="text-xs text-run-dark">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          disabled={isPending || !complete}
          onClick={submit}
          className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream disabled:opacity-40"
        >
          {t('createGroup')}
        </button>
        <button type="button" onClick={reset} className="text-xs text-ink-light underline">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
