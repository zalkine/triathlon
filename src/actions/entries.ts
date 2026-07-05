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
export async function stampEntryTime(entryId: string, station: Exclude<Station, 'start'>) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const field = STATION_FIELD[station];
  const entry = await prisma.entry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error('Entry not found');
  if (entry[field]) return { error: 'already-stamped' as const };

  await prisma.entry.update({ where: { id: entryId }, data: { [field]: new Date() } });
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
