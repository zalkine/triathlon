import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Available pool for a given category: TEAM registrants who marked themselves
// available to join a group. They stay pickable even after being placed in a
// group (a person may compete for several groups).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryKey = searchParams.get('category') || '';

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return NextResponse.json({ available: [] });

  const available = await prisma.registrant.findMany({
    where: { categoryId: category.id, groupPref: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    available: available.map((r) => ({
      id: r.id,
      name: r.name,
      age: r.age,
      legSwim: r.legSwim,
      legBike: r.legBike,
      legRun: r.legRun,
    })),
  });
}
