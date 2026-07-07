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
// `atMs` is the moment the timekeeper actually pressed GO (captured on their
// device). Passing it means a retry after a network blip still records the real
// gun time, not the retry time — so no timing data is lost if the connection
// drops at the instant of the start. It's ignored unless it's within a sane
// window (2 min) of the server clock, guarding against a wrong device clock.
export async function stampHeatStart(heatId: string, atMs?: number) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.competitionActive) return { error: 'not-active' as const };

  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat) throw new Error('Heat not found');
  if (heat.startTime) {
    // Idempotent: if a retried GO actually landed the first time, report success
    // (with the stored time) so the client stops retrying instead of erroring.
    return { ok: true as const, startTime: heat.startTime.toISOString() };
  }

  const now = Date.now();
  const startTime =
    atMs && Number.isFinite(atMs) && Math.abs(now - atMs) <= 120_000 ? new Date(atMs) : new Date(now);

  await prisma.heat.update({ where: { id: heatId }, data: { startTime } });
  revalidatePath('/', 'layout');
  return { ok: true as const, startTime: startTime.toISOString() };
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
