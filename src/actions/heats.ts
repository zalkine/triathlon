'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';

export async function createHeat(locale: string, formData: FormData) {
  await requireRole('ADMIN');

  const categoryId = String(formData.get('categoryId') || '');
  const name = String(formData.get('name') || '').trim();
  if (!categoryId || !name) throw new Error('categoryId and name are required');

  const heat = await prisma.heat.create({ data: { categoryId, name } });
  revalidatePath(`/${locale}/staff/manage`);
  redirect(`/${locale}/staff/manage/heats/${heat.id}`);
}

export async function deleteHeat(locale: string, heatId: string) {
  await requireRole('ADMIN');
  await prisma.heat.delete({ where: { id: heatId } });
  revalidatePath(`/${locale}/staff/manage`);
  redirect(`/${locale}/staff/manage`);
}

// Used by the "Start" timing station: only succeeds if the heat hasn't started yet.
export async function stampHeatStart(heatId: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.competitionActive) return { error: 'not-active' as const };

  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat) throw new Error('Heat not found');
  if (heat.startTime) return { error: 'already-started' as const };

  await prisma.heat.update({ where: { id: heatId }, data: { startTime: new Date() } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Quick self-undo for a timekeeper's misclick — only within a short window.
export async function undoHeatStart(heatId: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat?.startTime) return { error: 'not-started' as const };
  if (Date.now() - heat.startTime.getTime() > 15_000) return { error: 'too-late' as const };

  await prisma.heat.update({ where: { id: heatId }, data: { startTime: null } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Admin-only manual correction of a heat's start time (set, change, or clear).
export async function setHeatStartTime(locale: string, heatId: string, isoValue: string) {
  await requireRole('ADMIN');
  const startTime = isoValue ? new Date(isoValue) : null;
  await prisma.heat.update({ where: { id: heatId }, data: { startTime } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
  revalidatePath('/', 'layout');
}
