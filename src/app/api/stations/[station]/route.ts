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

  const entries = await prisma.entry.findMany({
    where: { [field]: null, scratched: false, heat: { startTime: { not: null } } },
    include: { heat: { include: { category: true } }, members: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    active: true,
    serverNow: new Date().toISOString(),
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      heatName: e.heat.name,
      heatStartTime: e.heat.startTime ? e.heat.startTime.toISOString() : null,
      categoryNameEn: e.heat.category.nameEn,
      categoryNameHe: e.heat.category.nameHe,
      // Only the run (finish) station renders these — runner vs. the other legs
      // — but they're small and harmless for the other stations.
      members: e.members.filter((m) => m.leg).map((m) => ({ id: m.id, name: m.name, leg: m.leg })),
    })),
  });
}
