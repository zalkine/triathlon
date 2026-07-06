import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Groups in a category that still have at least one open leg ("will be added
// later"), so a registering teammate can join one and fill an open leg.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryKey = searchParams.get('category') || '';

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return NextResponse.json({ groups: [] });

  const [groups, registrants] = await Promise.all([
    prisma.group.findMany({
      where: {
        categoryId: category.id,
        entryId: null,
        OR: [{ swimRegistrantId: null }, { bikeRegistrantId: null }, { runRegistrantId: null }],
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.registrant.findMany({ where: { categoryId: category.id } }),
  ]);
  const nameOf = new Map(registrants.map((r) => [r.id, r.name]));
  const nameFor = (id: string | null) => (id ? nameOf.get(id) ?? '?' : null);

  return NextResponse.json({
    groups: groups.map((g) => {
      const swim = nameFor(g.swimRegistrantId);
      const bike = nameFor(g.bikeRegistrantId);
      const run = nameFor(g.runRegistrantId);
      const openLegs = [
        g.swimRegistrantId ? null : 'SWIM',
        g.bikeRegistrantId ? null : 'BIKE',
        g.runRegistrantId ? null : 'RUN',
      ].filter((l): l is string => l != null);
      return { id: g.id, swim, bike, run, openLegs };
    }),
  });
}
