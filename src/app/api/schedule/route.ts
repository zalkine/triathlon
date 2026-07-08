import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });

  // Staff (internal) requests bypass the published gate by passing ?staff=1.
  const url = new URL(request.url);
  const isStaff = url.searchParams.get('staff') === '1';

  if (!isStaff && !settings.schedulePublished) {
    return NextResponse.json({ published: false, categories: [] });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      heats: {
        include: { _count: { select: { entries: true } } },
        orderBy: [{ estimatedStart: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  return NextResponse.json({
    published: true,
    categories: categories.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameHe: c.nameHe,
      heats: c.heats.map((h) => ({
        id: h.id,
        name: h.name,
        entryCount: h._count.entries,
        estimatedStart: h.estimatedStart?.toISOString() ?? null,
        startTime: h.startTime?.toISOString() ?? null,
      })),
    })),
  });
}
