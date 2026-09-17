'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { HEAT_CAPACITY } from '@/lib/constants';

// --- Combined starts (waves) ----------------------------------------------
// Heats sharing a `waveId` are one wave: they are shown as a single card at the
// start station, sent off by one GO, and stopped/cancelled together. This is how
// two thin categories (say three Pro singles and four Intermediate singles) fill
// the eight-lane pool in one start while each competitor is still ranked inside
// their own category — the heats, and therefore the categories, stay separate.
//
// Every start-line operation below works on the whole wave, so a wave can never
// end up with two different gun times. A heat with no waveId is simply a wave of
// one, which keeps the uncombined path identical to what it always was.
async function waveHeatIds(heat: { id: string; waveId: string | null }): Promise<string[]> {
  if (!heat.waveId) return [heat.id];
  const siblings = await prisma.heat.findMany({ where: { waveId: heat.waveId }, select: { id: true } });
  return siblings.length > 0 ? siblings.map((h) => h.id) : [heat.id];
}

// A wave needs at least two heats to mean anything. Once one is deleted out of a
// pair, clear the leftover id so the survivor goes back to being a plain heat
// instead of showing a "combined start" badge with nothing to combine with.
async function dissolveWaveOfOne(waveId: string) {
  const remaining = await prisma.heat.count({ where: { waveId } });
  if (remaining < 2) await prisma.heat.updateMany({ where: { waveId }, data: { waveId: null } });
}

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
  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  await prisma.heat.delete({ where: { id: heatId } });
  if (heat?.waveId) await dissolveWaveOfOne(heat.waveId);
  revalidatePath(`/${locale}/staff/manage`);
  redirect(`/${locale}/staff/manage`);
}

// Create an extra heat in a category on the spot (admin or start-line timekeeper),
// e.g. when moving competitors around needs somewhere to put them. Auto-named
// "Heat N". Returns the id so the caller can drop competitors into it.
export async function createHeatForCategory(categoryId: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return { error: 'no-category' as const };
  const count = await prisma.heat.count({ where: { categoryId } });
  const heat = await prisma.heat.create({ data: { categoryId, name: `Heat ${count + 1}` } });
  revalidatePath('/', 'layout');
  return { ok: true as const, heatId: heat.id };
}

// Delete a heat from the admin heats board (client-invoked, so no redirect —
// the caller refreshes the board). Cascades to its entries.
export async function removeHeat(heatId: string) {
  await requireRole('ADMIN');
  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  await prisma.heat.delete({ where: { id: heatId } });
  if (heat?.waveId) await dissolveWaveOfOne(heat.waveId);
  revalidatePath('/', 'layout');
  return { ok: true as const };
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

  // One gun, one time: a combined wave's heats all take this exact instant, so
  // competitors who entered the water together are timed from the same start.
  // Any heat of the wave already on the clock is left alone (see above).
  const ids = await waveHeatIds(heat);
  await prisma.heat.updateMany({ where: { id: { in: ids }, startTime: null }, data: { startTime } });
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

  // A combined wave started as one, so it un-starts as one.
  const ids = await waveHeatIds(heat);
  await prisma.heat.updateMany({ where: { id: { in: ids } }, data: { startTime: null } });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

// Cancel a start that shouldn't stand: a false start, a heat sent off by
// mistake, or anything on the course that forces the heat to be run again.
// Available to the admin and to the start-line timekeeper — unlike the 15-second
// `undoHeatStart` misclick window, this stays available for as long as the heat
// is on the clock.
//
// Nothing is deleted: the heat, its roster, every competitor and every
// registration stay exactly as they are. Only this heat's clock is wound back to
// "not started", so the start-line timekeeper can confirm the roster and send it
// off again. Leg times already stamped in this heat are cleared with it, because
// they were measured against the start being cancelled and would otherwise
// produce nonsense results (the same rule `moveEntry` applies). The count of
// cleared stamps is returned so the caller can say what it reset.
export async function cancelHeatStart(heatId: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat) return { error: 'no-heat' as const };
  if (!heat.startTime) return { error: 'not-started' as const };

  // A combined wave ran against one gun, so the whole wave goes back to the
  // start line together — cancelling half of it would leave the rest timed
  // against a start that is being thrown away.
  const ids = await waveHeatIds(heat);
  const entries = await prisma.entry.findMany({ where: { heatId: { in: ids } } });
  const clearedStamps = entries.reduce(
    (n, e) => n + (e.swimTime ? 1 : 0) + (e.bikeTime ? 1 : 0) + (e.runTime ? 1 : 0),
    0
  );

  await prisma.$transaction([
    prisma.entry.updateMany({
      where: { heatId: { in: ids } },
      data: { swimTime: null, bikeTime: null, runTime: null },
    }),
    prisma.heat.updateMany({ where: { id: { in: ids } }, data: { startTime: null } }),
  ]);

  revalidatePath('/', 'layout');
  return { ok: true as const, clearedStamps };
}

// Admin-only manual correction of a heat's start time (set, change, or clear).
// A heat combined into a wave was sent off by a single gun, so the correction
// applies to every heat in that wave — they can't hold different gun times.
export async function setHeatStartTime(locale: string, heatId: string, isoValue: string) {
  await requireRole('ADMIN');
  const startTime = isoValue ? new Date(isoValue) : null;
  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat) return;
  const ids = await waveHeatIds(heat);
  await prisma.heat.updateMany({ where: { id: { in: ids } }, data: { startTime } });
  revalidatePath(`/${locale}/staff/manage/heats/${heatId}`);
  revalidatePath('/', 'layout');
}

// Admin-only: combine two or more heats into a single start, so categories that
// only drew a handful of competitors each go into the water together and fill
// the pool. The heats themselves are untouched — every competitor keeps their
// category and is still ranked only against their own category — they simply
// share a gun from here on.
//
// Selecting one heat of an existing wave pulls that whole wave in, so combining
// can never quietly leave half a wave behind. The combined field is capped at
// the pool's lane count; `force` lets the admin go over it deliberately (a heat
// full of no-shows, or a wave that will share lanes), which is why the count
// is reported back rather than silently clamped. Only heats that haven't been
// sent off yet can be combined.
export async function combineHeats(heatIds: string[], force = false) {
  await requireRole('ADMIN');

  const requested = [...new Set(heatIds.filter(Boolean))];
  if (requested.length < 2) return { error: 'need-two' as const };

  const picked = await prisma.heat.findMany({ where: { id: { in: requested } } });
  if (picked.length !== requested.length) return { error: 'no-heat' as const };

  // Pull in every heat of any wave that was already partly selected.
  const waveIds = [...new Set(picked.map((h) => h.waveId).filter((w): w is string => !!w))];
  const heats =
    waveIds.length > 0
      ? await prisma.heat.findMany({ where: { OR: [{ id: { in: requested } }, { waveId: { in: waveIds } }] } })
      : picked;

  if (heats.some((h) => h.startTime)) return { error: 'already-started' as const };

  const ids = heats.map((h) => h.id);
  const total = await prisma.entry.count({ where: { heatId: { in: ids }, scratched: false } });
  if (total > HEAT_CAPACITY && !force) {
    return { error: 'over-capacity' as const, total, capacity: HEAT_CAPACITY };
  }

  // Keep the existing wave's id when extending one, so nothing that already
  // refers to that wave is invalidated; otherwise mint a fresh one.
  const waveId = waveIds.length === 1 ? waveIds[0] : randomUUID();

  // The wave leaves at one time: take the earliest estimate among its heats so
  // combining never pushes a category later than it was already promised.
  const estimates = heats.map((h) => h.estimatedStart).filter((d): d is Date => !!d);
  const estimatedStart = estimates.length > 0 ? new Date(Math.min(...estimates.map((d) => d.getTime()))) : null;

  await prisma.heat.updateMany({
    where: { id: { in: ids } },
    data: estimatedStart ? { waveId, estimatedStart } : { waveId },
  });

  revalidatePath('/', 'layout');
  return { ok: true as const, waveId, heatCount: ids.length, total };
}

// Admin-only: break a combined start back into separate heats, each starting on
// its own again. Rosters and times are untouched.
export async function splitWave(waveId: string) {
  await requireRole('ADMIN');
  if (!waveId) return { error: 'no-wave' as const };
  const { count } = await prisma.heat.updateMany({ where: { waveId }, data: { waveId: null } });
  if (count === 0) return { error: 'no-wave' as const };
  revalidatePath('/', 'layout');
  return { ok: true as const, heatCount: count };
}

// Admin-only: take a single heat out of a combined start, leaving the rest of
// the wave together (and dissolving the wave entirely if only one heat is left,
// since a wave of one is just an ordinary heat).
export async function removeHeatFromWave(heatId: string) {
  await requireRole('ADMIN');
  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat?.waveId) return { error: 'no-wave' as const };
  const waveId = heat.waveId;

  await prisma.heat.update({ where: { id: heatId }, data: { waveId: null } });
  const remaining = await prisma.heat.findMany({ where: { waveId }, select: { id: true } });
  if (remaining.length < 2) {
    await prisma.heat.updateMany({ where: { waveId }, data: { waveId: null } });
  }

  revalidatePath('/', 'layout');
  return { ok: true as const };
}
