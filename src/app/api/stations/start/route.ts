import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { racingCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.competitionActive) {
    return NextResponse.json({ active: false, serverNow: new Date().toISOString(), heats: [] });
  }

  const [heats, categories] = await Promise.all([
    prisma.heat.findMany({
      include: { category: true, entries: { include: { members: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ estimatedStart: 'asc' }, { createdAt: 'asc' }],
    }),
    racingCategories(),
  ]);

  // Keep a heat on the board while it's actionable: not started yet (roster + GO),
  // or started but not every live competitor has finished (running stopwatch).
  const actionable = (h: (typeof heats)[number]) => {
    if (!h.startTime) return true;
    const live = h.entries.filter((e) => !e.scratched);
    return live.length === 0 || live.some((e) => !e.runTime);
  };

  // Heats combined into one start stay on the board as long as *any* of them is
  // actionable, so the station always shows a wave whole. Letting one half drop
  // off early would leave the timekeeper cancelling a start whose confirmation
  // counted only the times it could still see.
  const liveWaves = new Set(heats.filter((h) => h.waveId && actionable(h)).map((h) => h.waveId));
  const board = heats.filter((h) => actionable(h) || (h.waveId && liveWaves.has(h.waveId)));

  // Name every heat by the field it races in. When an admin has merged age
  // brackets, the heat belongs to the leading bracket but the race is the merged
  // one — so the start line reads "Children – Singles", not "Children – Singles
  // 6-9" over a heat that also holds 9-12s.
  const fieldName = new Map<string, { nameEn: string; nameHe: string }>();
  for (const f of categories) {
    for (const id of f.memberIds) fieldName.set(id, { nameEn: f.nameEn, nameHe: f.nameHe });
  }
  const nameOfHeat = (h: (typeof heats)[number]) =>
    fieldName.get(h.categoryId) ?? { nameEn: h.category.nameEn, nameHe: h.category.nameHe };

  return NextResponse.json({
    active: true,
    serverNow: new Date().toISOString(),
    // Every heat (any category) — targets for moving a competitor between heats.
    allHeats: heats.map((h) => ({
      id: h.id,
      name: h.name,
      categoryNameEn: nameOfHeat(h).nameEn,
      categoryNameHe: nameOfHeat(h).nameHe,
    })),
    // Fields a new heat can be created in on the spot. Age brackets merged by
    // the admin appear once, under the merged name — a heat belongs to the field
    // that races, never to a bracket that has been absorbed into one.
    categories: categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameHe: c.nameHe })),
    heats: board.map((h) => ({
      id: h.id,
      name: h.name,
      categoryNameEn: nameOfHeat(h).nameEn,
      categoryNameHe: nameOfHeat(h).nameHe,
      // Heats the admin combined into one start share a waveId; the station
      // groups them into a single card with one GO, so they take one gun time.
      waveId: h.waveId,
      startTime: h.startTime ? h.startTime.toISOString() : null,
      entries: h.entries.map((e) => ({
        id: e.id,
        name: e.name,
        scratched: e.scratched,
        done: !!e.runTime,
        // How many leg times are already recorded for this competitor — summed
        // per heat so "cancel start" can say what it would reset.
        stamps: (e.swimTime ? 1 : 0) + (e.bikeTime ? 1 : 0) + (e.runTime ? 1 : 0),
        members: e.members.filter((m) => m.leg).map((m) => ({ id: m.id, name: m.name, leg: m.leg })),
      })),
    })),
  });
}
