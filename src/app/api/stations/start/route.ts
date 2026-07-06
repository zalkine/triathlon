import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.competitionActive) {
    return NextResponse.json({ active: false, heats: [] });
  }

  const heats = await prisma.heat.findMany({
    where: { startTime: null },
    include: { category: true },
    orderBy: { estimatedStart: 'asc' },
  });

  return NextResponse.json({
    active: true,
    heats: heats.map((h) => ({
      id: h.id,
      name: h.name,
      categoryNameEn: h.category.nameEn,
      categoryNameHe: h.category.nameHe,
    })),
  });
}
