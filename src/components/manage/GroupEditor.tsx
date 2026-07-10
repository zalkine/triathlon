'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { clearGroupLeg, assignGroupLeg, addNewMemberToGroupLeg, deleteGroup } from '@/actions/groups';
import { updateRegistrantName } from '@/actions/registrants';

type Leg = 'SWIM' | 'BIKE' | 'RUN';
type Slot = { registrantId: string; name: string } | null;
type Group = { id: string; SWIM: Slot; BIKE: Slot; RUN: Slot };
type PoolMember = { id: string; name: string };

const LEGS: Leg[] = ['SWIM', 'BIKE', 'RUN'];

export default function GroupEditor({ group, pool }: { group: Group; pool: PoolMember[] }) {
  const t = useTranslations('manage');
  const tc = useTranslations('competitors');
  const tr = useTranslations('register');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const legLabel = (leg: Leg) => (leg === 'SWIM' ? tc('roleSwim') : leg === 'BIKE' ? tc('roleBike') : tc('roleRun'));

  const run = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); router.refresh(); });

  const renameMember = (registrantId: string) => {
    const name = drafts[registrantId];
    if (name == null) return;
    const fd = new FormData();
    fd.set('name', name);
    run(() => updateRegistrantName(registrantId, fd));
  };

  const openLegs = LEGS.filter((leg) => !group[leg]);

  if (!editing) {
    return (
      <li className="rounded-xl bg-cream/60 p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGS.map((leg) => (
              <span key={leg}>
                <span className="text-ink-light">{legLabel(leg)}:</span>{' '}
                {group[leg] ? group[leg]!.name : <span className="italic text-run-dark">{tc('openSlot')}</span>}
              </span>
            ))}
          </div>
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-xs text-ink-light underline">
            {t('edit')}
          </button>
        </div>
        {openLegs.length > 0 && (
          <p className="mt-1 text-xs font-medium text-run-dark">
            ⚠ {openLegs.includes('RUN') ? t('groupNoRunner') : t('groupIncomplete')}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-xl border border-ink/20 bg-white/80 p-3 text-sm">
      {LEGS.map((leg) => {
        const slot = group[leg];
        return (
          <div key={leg} className="flex flex-wrap items-center gap-2 border-b border-ink/5 pb-2 last:border-0 last:pb-0">
            <span className="w-16 shrink-0 text-xs text-ink-light">{legLabel(leg)}</span>
            {slot ? (
              <>
                <input
                  defaultValue={slot.name}
                  onChange={(e) => setDrafts((d) => ({ ...d, [slot.registrantId]: e.target.value }))}
                  className="min-w-0 flex-1 rounded border border-ink/20 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => renameMember(slot.registrantId)}
                  className="text-xs font-semibold text-swim-dark disabled:opacity-60"
                >
                  {t('save')}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => clearGroupLeg(group.id, leg))}
                  className="text-xs text-run-dark underline"
                >
                  {t('legClear')}
                </button>
              </>
            ) : (
              <OpenLegControls
                leg={leg}
                pool={pool}
                pending={isPending}
                onAssign={(id) => run(() => assignGroupLeg(group.id, leg, id))}
                onAddNew={(name) => run(() => addNewMemberToGroupLeg(group.id, leg, name))}
                assignLabel={t('assign')}
                addLabel={tr('roleNew')}
                addPlaceholder={tr('teammateNamePlaceholder')}
                openLabel={tc('openSlot')}
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold underline">
          {t('doneEditingGroup')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (window.confirm(t('confirmDeleteGroup'))) run(() => deleteGroup(group.id));
          }}
          className="text-xs text-run-dark underline"
        >
          {t('groupDelete')}
        </button>
      </div>
    </li>
  );
}

function OpenLegControls({
  pool,
  pending,
  onAssign,
  onAddNew,
  assignLabel,
  addLabel,
  addPlaceholder,
  openLabel,
}: {
  leg: Leg;
  pool: PoolMember[];
  pending: boolean;
  onAssign: (id: string) => void;
  onAddNew: (name: string) => void;
  assignLabel: string;
  addLabel: string;
  addPlaceholder: string;
  openLabel: string;
}) {
  const [pick, setPick] = useState('');
  const [newName, setNewName] = useState('');
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <span className="text-xs italic text-ink-light">{openLabel}</span>
      {pool.length > 0 && (
        <>
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded border border-ink/20 px-2 py-1 text-xs">
            <option value="">—</option>
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !pick}
            onClick={() => pick && onAssign(pick)}
            className="text-xs font-semibold text-swim-dark disabled:opacity-40"
          >
            {assignLabel}
          </button>
        </>
      )}
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder={addPlaceholder}
        className="min-w-0 flex-1 rounded border border-ink/20 px-2 py-1 text-xs"
      />
      <button
        type="button"
        disabled={pending || !newName.trim()}
        onClick={() => onAddNew(newName)}
        className="text-xs font-semibold text-swim-dark disabled:opacity-40"
        title={addLabel}
      >
        +
      </button>
    </div>
  );
}
