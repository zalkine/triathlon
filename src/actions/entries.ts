'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { STATION_FIELD, type Station, type Leg } from '@/lib/constants';

export async function createEntry(locale: string, heatId: string, formData: FormData) {
  await requireRole('ADMIN');
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('name is required');
  await prisma.entry.create({ data: { heatId, name } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
}

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
export async function moveEntry(entryId: string, targetHeatId: string) {
  await requireStaff();
  const target = await prisma.heat.findUnique({ where: { id: targetHeatId } });
  if (!target) return { error: 'no-heat' as const };
  await prisma.entry.update({
    where: { id: entryId },
    data: { heatId: targetHeatId, swimTime: null, bikeTime: null, runTime: null },
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Add a competitor/team to a heat on the spot (name only). Members can be added
// afterwards from the admin heat page for a relay.
export async function addRaceEntry(heatId: string, name: string) {
  await requireStaff();
  const trimmed = name.trim();
  if (!trimmed) return { error: 'empty' as const };
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
