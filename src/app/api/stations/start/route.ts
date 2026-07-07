import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.competitionActive) {
    return NextResponse.json({ active: false, serverNow: new Date().toISOString(), heats: [] });
  }

  const heats = await prisma.heat.findMany({
    include: { category: true, entries: { include: { members: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: [{ estimatedStart: 'asc' }, { createdAt: 'asc' }],
  });

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
