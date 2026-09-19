'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { GROUP_LEG_FIELD, LEGS, STATION_FIELD, type Station, type Leg } from '@/lib/constants';
import { checkCapacity } from '@/lib/heats';

export async function deleteEntry(locale: string, heatId: string, entryId: string) {
  await requireRole('ADMIN');
  await prisma.entry.delete({ where: { id: entryId } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
}

export async function addMember(locale: string, heatId: string, entryId: string, formData: FormData) {
  await requireRole('ADMIN');
  const name = String(formData.get('name') || '').trim();
  const leg = (String(formData.get('leg') || '') || null) as Leg | null;
  if (!name) throw new Error('name is required');
  await prisma.member.create({ data: { entryId, name, leg: leg ?? undefined } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
}

export async function removeMember(locale: string, heatId: string, memberId: string) {
  await requireRole('ADMIN');
  await prisma.member.delete({ where: { id: memberId } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
}

// Timing-station stamp: only succeeds if this leg's time isn't already set,
// so a station can't accidentally overwrite an existing time.
// `atMs` lets the finish-line timekeeper "fill in later" — record an arrival
// that already happened (read off the clock) instead of the moment of tapping.
// It must fall between the heat's start and now (small future skew allowed);
// otherwise the tap time is used.
export async function stampEntryTime(entryId: string, station: Exclude<Station, 'start'>, atMs?: number) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const field = STATION_FIELD[station];
  const entry = await prisma.entry.findUnique({ where: { id: entryId }, include: { heat: true } });
  if (!entry) throw new Error('Entry not found');
  if (entry[field]) return { error: 'already-stamped' as const };

  const now = Date.now();
  const startMs = entry.heat.startTime?.getTime() ?? 0;
  const stampAt =
    atMs && Number.isFinite(atMs) && atMs >= startMs && atMs <= now + 5_000 ? new Date(atMs) : new Date(now);

  await prisma.entry.update({ where: { id: entryId }, data: { [field]: stampAt } });
  revalidatePath('/', 'layout');
  return { ok: true as const, at: stampAt.toISOString() };
}

// Start-line timekeeper: scratch (or un-scratch) a competitor/team from a heat —
// a no-show or last-minute drop. Scratched entries are skipped by the timing
// stations and left out of results.
export async function setEntryScratched(entryId: string, scratched: boolean) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');
  await prisma.entry.update({ where: { id: entryId }, data: { scratched } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Start-line timekeeper: fix a name for a last-minute replacement.
export async function renameEntry(entryId: string, name: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');
  const trimmed = name.trim();
  if (!trimmed) return { error: 'empty' as const };
  await prisma.entry.update({ where: { id: entryId }, data: { name: trimmed } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

export async function renameMember(memberId: string, name: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');
  const trimmed = name.trim();
  if (!trimmed) return { error: 'empty' as const };
  await prisma.member.update({ where: { id: memberId }, data: { name: trimmed } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// --- Last-minute substitutions ---------------------------------------------
// Someone drops out on the morning of the race — illness, an injury — and a
// volunteer takes their place. Correcting only the heat entry's name isn't
// enough: the roster is the source of truth, so `syncHeatsWithRoster` would
// rebuild the entry from the group it belongs to and quietly put the person who
// never raced back on the result. A substitution therefore moves the roster with
// it — the stand-in takes over the group leg (or the solo place), so results,
// the exports and the Hall of Fame all credit whoever actually raced.
//
// The registration itself is left alone. The competitor who fell ill keeps their
// row; they are simply unlinked from the race, exactly as if they had never been
// placed in a heat, so the record of who signed up stays true.

// Same rule the registration form applies, so a stand-in's name can't arrive in
// a shape no other name in the system could have.
const NAME_PATTERN = /^[\p{L}\s\-']+$/u;

/**
 * The roster row for a stand-in. A volunteer already on this field's roster —
 * they registered themselves, or they are covering a second leg — keeps their
 * single row rather than gaining a duplicate; for a solo race only an unplaced
 * row can be reused, since a registrant holds at most one heat entry.
 */
async function standInRegistrant(name: string, categoryId: string, mode: 'SINGLE' | 'TEAM', age: number | null) {
  const existing = await prisma.registrant.findFirst({
    where: { name, categoryId, mode, ...(mode === 'SINGLE' ? { entryId: null } : {}) },
  });
  if (existing) return existing;
  return prisma.registrant.create({
    data: {
      name,
      // A stand-in races in the bracket they are standing in for, so a
      // children's bracket keeps an age that matches it.
      age,
      categoryId,
      mode,
      groupPref: mode === 'TEAM' ? 'HAS_GROUP' : null,
      // They were at the race and ran it, so the roster shows them as arrived.
      checkedIn: true,
      checkedInAt: new Date(),
    },
  });
}

/**
 * Re-derive a relay entry's display name from its legs. A group-linked entry is
 * named after its assigned legs — in race order, exactly as `createGroupEntry`
 * and `syncHeatsWithRoster` build it, so reconciling afterwards is a no-op. An
 * entry typed in by hand has no registrant links, so every named leg counts
 * instead.
 */
async function renameEntryFromMembers(entryId: string) {
  const members = await prisma.member.findMany({ where: { entryId } });
  const linked = members.filter((m) => m.registrantId);
  const source = [...(linked.length > 0 ? linked : members)].sort(
    (a, b) => LEGS.indexOf(a.leg as Leg) - LEGS.indexOf(b.leg as Leg)
  );
  const name = [...new Set(source.map((m) => m.name).filter((n) => n && n !== '—'))].join(' / ');
  if (name) await prisma.entry.update({ where: { id: entryId }, data: { name } });
}

/**
 * Record a stand-in for a competitor who didn't race. `memberId` names the relay
 * leg being replaced; pass null for a solo competitor (the entry itself).
 * Times are deliberately untouched — the clock measured the race that was run,
 * whoever ran it — so this is safe to use while reviewing results, which is when
 * a last-minute swap usually surfaces.
 */
export async function substituteCompetitor(entryId: string, memberId: string | null, name: string) {
  await requireRole('ADMIN');
  const standIn = name.trim();
  if (!standIn) return { error: 'empty' as const };
  if (!NAME_PATTERN.test(standIn)) return { error: 'name-letters-only' as const };

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { members: true },
  });
  if (!entry) return { error: 'no-entry' as const };

  if (memberId) {
    const member = entry.members.find((m) => m.id === memberId);
    if (!member) return { error: 'no-member' as const };
    // Re-saving the same name is not a substitution — nobody was replaced — and
    // going through with it would put a second row for them on the roster.
    if (member.name === standIn) return { ok: true as const };
    const group = member.leg ? await prisma.group.findFirst({ where: { entryId } }) : null;

    if (group) {
      const outgoing = member.registrantId
        ? await prisma.registrant.findUnique({ where: { id: member.registrantId } })
        : null;
      const replacement = await standInRegistrant(
        standIn,
        outgoing?.categoryId ?? group.categoryId,
        'TEAM',
        outgoing?.age ?? null
      );
      await prisma.group.update({
        where: { id: group.id },
        data: { [GROUP_LEG_FIELD[member.leg as Leg]]: replacement.id },
      });
      await prisma.member.update({
        where: { id: member.id },
        data: { name: standIn, registrantId: replacement.id },
      });
      // Free the competitor who didn't race, unless they are still doing another
      // leg of this very team.
      if (outgoing && outgoing.entryId === entryId) {
        await prisma.registrant.update({ where: { id: outgoing.id }, data: { entryId: null } });
      }
    } else {
      // A heat entry typed in by hand has no roster behind it: the member's name
      // is the whole record, so correcting it is the substitution.
      await prisma.member.update({ where: { id: member.id }, data: { name: standIn } });
    }
    await renameEntryFromMembers(entryId);
  } else {
    if (entry.name === standIn) return { ok: true as const };
    const outgoing = await prisma.registrant.findFirst({ where: { entryId, mode: 'SINGLE' } });
    if (outgoing) {
      const replacement = await standInRegistrant(standIn, outgoing.categoryId, 'SINGLE', outgoing.age);
      await prisma.registrant.update({ where: { id: outgoing.id }, data: { entryId: null } });
      await prisma.registrant.update({ where: { id: replacement.id }, data: { entryId } });
    }
    await prisma.entry.update({ where: { id: entryId }, data: { name: standIn } });
  }

  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Quick self-undo for a timekeeper's misclick — only within a short window.
export async function undoEntryTime(entryId: string, station: Exclude<Station, 'start'>) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const field = STATION_FIELD[station];
  const entry = await prisma.entry.findUnique({ where: { id: entryId } });
  const stamped = entry?.[field] as Date | null | undefined;
  if (!stamped) return { error: 'not-stamped' as const };
  if (Date.now() - stamped.getTime() > 15_000) return { error: 'too-late' as const };

  await prisma.entry.update({ where: { id: entryId }, data: { [field]: null } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Admin-only manual correction of any stamped time (set, change, or clear).
export async function setEntryTime(
  locale: string,
  heatId: string,
  entryId: string,
  field: 'swimTime' | 'bikeTime' | 'runTime',
  isoValue: string
) {
  await requireRole('ADMIN');
  const value = isoValue ? new Date(isoValue) : null;
  await prisma.entry.update({ where: { id: entryId }, data: { [field]: value } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
  revalidatePath('/', 'layout');
}

// --- On-the-spot roster edits (admin or start-line timekeeper) --------------
// Race-day fixups that override the registration/lottery: move a competitor to a
// different heat (even a different race type), add someone who isn't placed, or
// remove one. Available to ADMIN and TIMEKEEPER.

async function requireStaff() {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');
}

// Move an entry to another heat — including a heat in a different category, e.g.
// a competitor who registered as Pro but is actually running Intermediate. Leg
// times are cleared: they belonged to the old heat's clock, so the competitor
// starts fresh in the new heat.
//
// If the move would put more competitors in the water than the pool has lanes
// (counting every heat combined into the target's start), it is reported back
// instead of being carried out, and the caller confirms before retrying with
// `force`. Nine in a heat is allowed — someone at the pool may be sharing a lane
// — but never by accident.
export async function moveEntry(entryId: string, targetHeatId: string, force = false) {
  await requireStaff();
  const target = await prisma.heat.findUnique({ where: { id: targetHeatId } });
  if (!target) return { error: 'no-heat' as const };

  const entry = await prisma.entry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: 'no-entry' as const };
  if (entry.heatId !== targetHeatId) {
    // A scratched competitor isn't taking a lane, so they don't count against it.
    const over = await checkCapacity(targetHeatId, entry.scratched ? 0 : 1, force);
    if (over) return over;
  }

  await prisma.entry.update({
    where: { id: entryId },
    data: { heatId: targetHeatId, swimTime: null, bikeTime: null, runTime: null },
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Add a competitor/team to a heat on the spot (name only). Members can be added
// afterwards from the admin heat page for a relay. Overfilling the pool takes a
// confirmation, exactly as moving someone in does.
export async function addRaceEntry(heatId: string, name: string, force = false) {
  await requireStaff();
  const trimmed = name.trim();
  if (!trimmed) return { error: 'empty' as const };
  const over = await checkCapacity(heatId, 1, force);
  if (over) return over;
  const entry = await prisma.entry.create({ data: { heatId, name: trimmed } });
  revalidatePath('/', 'layout');
  return { ok: true as const, entryId: entry.id };
}

// Permanently remove an entry from the race (harder than "scratch").
export async function removeRaceEntry(entryId: string) {
  await requireStaff();
  await prisma.entry.delete({ where: { id: entryId } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
