'use client';

import { useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { moveGroupMember, clearGroupLeg, createEmptyGroup, deleteGroup, lotteryCategory } from '@/actions/groups';
import { updateRegistrant, deleteRegistrant, undoCheckIn } from '@/actions/registrants';

type Leg = 'SWIM' | 'BIKE' | 'RUN';
const LEGS: Leg[] = ['SWIM', 'BIKE', 'RUN'];

type Slot = { id: string; name: string; checkedIn: boolean } | null;
type BoardGroup = { id: string; SWIM: Slot; BIKE: Slot; RUN: Slot };
type Unassigned = {
  id: string;
  name: string;
  checkedIn: boolean;
  legSwim: boolean;
  legBike: boolean;
  legRun: boolean;
};
type CategoryInfo = { key: string; nameEn: string; nameHe: string; type: string };

type Origin = { groupId: string; leg: Leg } | null;
type Payload = { registrantId: string; name: string; source: Origin };

// Admin group organiser as a drag-and-drop table (one row per group, columns
// Swim / Bike / Run) plus an "unassigned" tray. Two ways to move a competitor:
//   • drag their chip onto a cell (desktop), or
//   • tap the chip to pick it up, then tap the destination cell (touch).
// Dropping onto a taken cell replaces the occupant, who is bumped back to the
// tray with their original leg preferences. Groups can be created and deleted,
// and an unassigned competitor can be renamed, re-categorised or removed.
export default function GroupsBoard({
  categoryId,
  categoryKey,
  groups,
  unassigned,
  categories,
}: {
  categoryId: string;
  categoryKey: string;
  groups: BoardGroup[];
  unassigned: Unassigned[];
  categories: CategoryInfo[];
}) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const tc = useTranslations('competitors');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState<Payload | null>(null); // tap-to-move selection
  const [dropCell, setDropCell] = useState<string | null>(null);
  const [dropTray, setDropTray] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [lotteryMsg, setLotteryMsg] = useState<string | null>(null);
  const dragRef = useRef<Payload | null>(null);

  const run = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); router.refresh(); });

  const samePlace = (a: Origin, b: Origin) =>
    (a === null && b === null) || (!!a && !!b && a.groupId === b.groupId && a.leg === b.leg);

  // Shared move: place `p` into (groupId, leg). No-op if it's already there.
  const place = (p: Payload, groupId: string, leg: Leg) => {
    if (p.source && p.source.groupId === groupId && p.source.leg === leg) return;
    run(() => moveGroupMember(p.registrantId, { groupId, leg }, p.source));
  };

  // --- drag (desktop) ---
  const startDrag = (e: React.DragEvent, p: Payload) => {
    dragRef.current = p;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', p.registrantId);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDropCell(null);
    setDropTray(false);
  };

  // --- tap (touch): pick up, then tap a destination ---
  const tapChip = (p: Payload) => {
    setPicked((cur) => (cur && cur.registrantId === p.registrantId && samePlace(cur.source, p.source) ? null : p));
  };
  const tapCell = (groupId: string, leg: Leg, slot: Slot) => {
    if (picked) {
      place(picked, groupId, leg);
      setPicked(null);
    } else if (slot) {
      tapChip({ registrantId: slot.id, name: slot.name, source: { groupId, leg } });
    }
  };

  const removeToTray = (p: Payload) => {
    if (p.source) run(() => clearGroupLeg(p.source!.groupId, p.source!.leg));
    setPicked(null);
  };

  const changeCategory = (id: string, name: string, key: string) => {
    if (key === categoryKey) return;
    const fd = new FormData();
    fd.set('name', name);
    fd.set('categoryKey', key);
    run(() => updateRegistrant(id, fd));
  };

  const rename = (id: string, current: string) => {
    const name = window.prompt(t('renamePrompt'), current);
    if (name == null || !name.trim()) return;
    const fd = new FormData();
    fd.set('name', name.trim());
    fd.set('categoryKey', categoryKey);
    run(() => updateRegistrant(id, fd));
  };

  const isPicked = (id: string, source: Origin) =>
    !!picked && picked.registrantId === id && samePlace(picked.source, source);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink-light">{tc('groups')}</h4>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(t('lotteryConfirm'))) return;
              startTransition(async () => {
                const r = await lotteryCategory(categoryId);
                setLotteryMsg(t('lotteryDone', { count: r.formed }));
                router.refresh();
              });
            }}
            disabled={isPending || unassigned.length === 0}
            className="rounded-full border border-ink/30 px-3 py-1.5 text-xs font-semibold hover:bg-ink/5 disabled:opacity-50"
            title={t('lotteryHint')}
          >
            🎲 {t('lottery')}
          </button>
          <button
            type="button"
            onClick={() => run(() => createEmptyGroup(categoryId))}
            disabled={isPending}
            className="rounded-full border border-ink/30 px-3 py-1.5 text-xs font-semibold hover:bg-ink/5 disabled:opacity-50"
          >
            + {t('createGroup')}
          </button>
        </div>
      </div>
      {lotteryMsg && <p className="text-xs font-semibold text-swim-dark">{lotteryMsg}</p>}
      <p className="text-xs text-ink-light">{t('groupsBoardHint')}</p>

      {/* Pick-up banner (touch) */}
      {picked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-ink px-3 py-2 text-xs text-cream">
          <span>{t('pickedHint', { name: picked.name })}</span>
          {picked.source && (
            <button type="button" onClick={() => removeToTray(picked)} className="font-semibold underline">
              {t('removeFromGroup')}
            </button>
          )}
          <button type="button" onClick={() => setPicked(null)} className="opacity-80 underline">
            {t('cancel')}
          </button>
        </div>
      )}

      {groups.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-start">
            <thead>
              <tr className="text-xs text-ink-light">
                <th className="border border-ink/10 px-2 py-1.5 text-center font-medium">{tc('roleSwim')}</th>
                <th className="border border-ink/10 px-2 py-1.5 text-center font-medium">{tc('roleBike')}</th>
                <th className="border border-ink/10 px-2 py-1.5 text-center font-medium">{tc('roleRun')}</th>
                <th className="w-8 border border-ink/10 px-1 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const openLegs = LEGS.filter((leg) => !g[leg]);
                return (
                  <tr key={g.id}>
                    {LEGS.map((leg) => {
                      const slot = g[leg];
                      const key = `${g.id}:${leg}`;
                      return (
                        <td
                          key={leg}
                          onClick={() => tapCell(g.id, leg, slot)}
                          onDragOver={(e) => {
                            if (dragRef.current) {
                              e.preventDefault();
                              setDropCell(key);
                            }
                          }}
                          onDragLeave={() => setDropCell((c) => (c === key ? null : c))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const p = dragRef.current;
                            endDrag();
                            if (p) place(p, g.id, leg);
                          }}
                          className={`cursor-pointer border border-ink/10 p-1.5 align-middle transition ${
                            dropCell === key ? 'bg-swim/20' : ''
                          }`}
                        >
                          {slot ? (
                            <div
                              draggable
                              onDragStart={(e) => startDrag(e, { registrantId: slot.id, name: slot.name, source: { groupId: g.id, leg } })}
                              onDragEnd={endDrag}
                              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-sm shadow-sm ${
                                isPicked(slot.id, { groupId: g.id, leg })
                                  ? 'border-ink bg-ink/10 ring-2 ring-ink'
                                  : 'border-ink/10 bg-white'
                              } ${isPending ? '' : 'cursor-grab active:cursor-grabbing'}`}
                              title={slot.name}
                            >
                              {slot.checkedIn && <span className="text-swim-dark" title={tc('arrived')}>✓</span>}
                              <span className="min-w-0 flex-1 truncate">{slot.name}</span>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-ink/20 px-2 py-2 text-center text-xs text-ink-light">
                              {t('dropHere')}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-ink/10 p-1 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('confirmDeleteGroup'))) run(() => deleteGroup(g.id));
                        }}
                        disabled={isPending}
                        className="text-xs text-run-dark hover:underline disabled:opacity-50"
                        title={t('groupDelete')}
                        aria-label={t('groupDelete')}
                      >
                        ✕
                      </button>
                      {openLegs.length > 0 && (
                        <div
                          className="mt-0.5 text-[10px] leading-tight text-run-dark"
                          title={openLegs.includes('RUN') ? t('groupNoRunner') : t('groupIncomplete')}
                        >
                          ⚠
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unassigned tray — drop or tap-place here to remove from a group */}
      <div
        onDragOver={(e) => {
          if (dragRef.current?.source) {
            e.preventDefault();
            setDropTray(true);
          }
        }}
        onDragLeave={() => setDropTray(false)}
        onDrop={(e) => {
          e.preventDefault();
          const p = dragRef.current;
          endDrag();
          if (p?.source) removeToTray(p);
        }}
        className={`rounded-xl border border-dashed p-3 transition ${
          dropTray ? 'border-run-dark bg-run/10' : 'border-ink/20'
        }`}
      >
        <p className="mb-2 text-xs font-semibold text-ink-light">
          ⚠ {tc('availableTitle')} <span className="font-normal">({unassigned.length})</span>
        </p>
        {unassigned.length === 0 ? (
          <p className="text-xs text-ink-light">{t('unassignedTrayEmpty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {unassigned.map((u) => {
              const legs = [u.legSwim && tc('legSwim'), u.legBike && tc('legBike'), u.legRun && tc('legRun')]
                .filter(Boolean)
                .join(' · ');
              const editing = editId === u.id;
              return (
                <li
                  key={u.id}
                  draggable={!editing}
                  onDragStart={(e) => startDrag(e, { registrantId: u.id, name: u.name, source: null })}
                  onDragEnd={endDrag}
                  className={`rounded-lg border bg-white px-2 py-1 text-sm shadow-sm ${
                    isPicked(u.id, null) ? 'border-ink ring-2 ring-ink' : 'border-bike/40'
                  } ${isPending ? '' : 'cursor-grab active:cursor-grabbing'}`}
                >
                  <div className="flex items-center gap-1.5">
                    {u.checkedIn && <span className="text-swim-dark" title={tc('arrived')}>✓</span>}
                    <button type="button" onClick={() => tapChip({ registrantId: u.id, name: u.name, source: null })} className="font-medium">
                      {u.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId((id) => (id === u.id ? null : u.id))}
                      className="text-xs text-ink-light hover:underline"
                      title={t('edit')}
                    >
                      ✎
                    </button>
                  </div>
                  {legs && <div className="text-[11px] text-ink-light">{legs}</div>}
                  {editing && (
                    <div className="mt-1 space-y-1 border-t border-ink/10 pt-1" draggable={false}>
                      <button type="button" onClick={() => rename(u.id, u.name)} className="block text-xs text-swim-dark hover:underline">
                        {t('renameAction')}
                      </button>
                      <select
                        value={categoryKey}
                        onChange={(e) => changeCategory(u.id, u.name, e.target.value)}
                        className="w-full rounded border border-ink/20 px-1 py-0.5 text-xs"
                        title={t('category')}
                      >
                        {categories.map((c) => (
                          <option key={c.key} value={c.key}>
                            {locale === 'he' ? c.nameHe : c.nameEn}
                          </option>
                        ))}
                      </select>
                      {u.checkedIn && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('undoCheckinConfirm'))) run(() => undoCheckIn(u.id));
                          }}
                          className="block text-xs text-run-dark hover:underline"
                        >
                          {t('undoCheckin')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('confirmDeleteRegistrant'))) run(() => deleteRegistrant(u.id, new FormData()));
                        }}
                        className="block text-xs text-run-dark hover:underline"
                      >
                        {t('deleteRegistrant')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
