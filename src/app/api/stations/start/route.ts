import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  // Keep a heat on the board while it's actionable: not started yet (roster + GO),
  // or started but not every live competitor has finished (running stopwatch).
  const board = heats.filter((h) => {
    if (!h.startTime) return true;
    const live = h.entries.filter((e) => !e.scratched);
    return live.length === 0 || live.some((e) => !e.runTime);
  });

  return NextResponse.json({
    active: true,
    serverNow: new Date().toISOString(),
    // Every heat (any category) — targets for moving a competitor between heats.
    allHeats: heats.map((h) => ({
      id: h.id,
      name: h.name,
      categoryNameEn: h.category.nameEn,
      categoryNameHe: h.category.nameHe,
    })),
    // Categories — for creating a new heat on the spot.
    categories: categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameHe: c.nameHe })),
    heats: board.map((h) => ({
      id: h.id,
      name: h.name,
      categoryNameEn: h.category.nameEn,
      categoryNameHe: h.category.nameHe,
      startTime: h.startTime ? h.startTime.toISOString() : null,
      entries: h.entries.map((e) => ({
        id: e.id,
        name: e.name,
        scratched: e.scratched,
        done: !!e.runTime,
        members: e.members.filter((m) => m.leg).map((m) => ({ id: m.id, name: m.name, leg: m.leg })),
      })),
    })),
  });
}
