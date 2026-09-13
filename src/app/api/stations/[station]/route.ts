import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { STATION_FIELD, STATIONS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ station: string }> }) {
  const { station } = await params;
  if (!STATIONS.includes(station as (typeof STATIONS)[number]) || station === 'start') {
    return NextResponse.json({ error: 'invalid-station' }, { status: 400 });
  }
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.competitionActive) {
    return NextResponse.json({ active: false, entries: [] });
  }

  const field = STATION_FIELD[station as Exclude<(typeof STATIONS)[number], 'start'>];
  const isFinish = station === 'run';

  const entries = await prisma.entry.findMany({
    where: {
      scratched: false,
      heat: { startTime: { not: null } },
      // The swim and bike stations keep their short working list: a competitor
      // drops off it the moment they're stamped. The finish line keeps everyone
      // on screen instead — already-finished competitors stay in place, greyed
      // out — so the buttons never shift under the timekeeper's thumb and they
      // can see who they've already recorded.
      ...(isFinish ? {} : { [field]: null }),
    },
    include: { heat: { include: { category: true } }, members: true },
    // At the finish line the list is long-lived, so it's grouped by category
    // (matching the colour coding and the category filter) and then by heat.
    // The order never depends on who has been stamped, so nobody moves.
    orderBy: isFinish
      ? [{ heat: { category: { sortOrder: 'asc' } } }, { heat: { createdAt: 'asc' } }, { createdAt: 'asc' }]
      : { createdAt: 'asc' },
  });

  return NextResponse.json({
    active: true,
    serverNow: new Date().toISOString(),
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      heatName: e.heat.name,
      heatStartTime: e.heat.startTime ? e.heat.startTime.toISOString() : null,
      categoryId: e.heat.categoryId,
      // Drives this competitor's colour and their category's filter chip.
      categoryKey: e.heat.category.key,
      categoryNameEn: e.heat.category.nameEn,
      categoryNameHe: e.heat.category.nameHe,
      // This station's time, once recorded. Only ever set at the finish line,
      // where stamped competitors stay on the list.
      stampedAt: e[field] ? (e[field] as Date).toISOString() : null,
      // Only the run (finish) station renders these — runner vs. the other legs
      // — but they're small and harmless for the other stations.
      members: e.members.filter((m) => m.leg).map((m) => ({ id: m.id, name: m.name, leg: m.leg })),
    })),
  });
}
