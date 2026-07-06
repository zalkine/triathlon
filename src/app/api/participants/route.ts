import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { registrants: { orderBy: { createdAt: 'asc' } }, groups: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json({
    categories: categories.map((c) => {
      const nameOf = new Map(c.registrants.map((r) => [r.id, r.name]));
      const inGroup = new Set(c.groups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId]));

      return {
        id: c.id,
        nameEn: c.nameEn,
        nameHe: c.nameHe,
        type: c.type,
        // SINGLE categories: every registrant is a solo competitor.
        singles:
          c.type === 'SINGLE'
            ? c.registrants.map((r) => ({ name: r.name, age: r.age, checkedIn: r.checkedIn }))
            : [],
        // TEAM categories: formed groups (self-formed or lottery) with role names.
        groups: c.groups.map((g) => ({
          id: g.id,
          swim: nameOf.get(g.swimRegistrantId) ?? '?',
          bike: nameOf.get(g.bikeRegistrantId) ?? '?',
          run: nameOf.get(g.runRegistrantId) ?? '?',
        })),
        // TEAM categories: people available to join a group, not yet in any group.
        available:
          c.type === 'TEAM'
            ? c.registrants
                .filter((r) => r.groupPref === 'AVAILABLE' && !inGroup.has(r.id))
                .map((r) => ({
                  name: r.name,
                  age: r.age,
                  legSwim: r.legSwim,
                  legBike: r.legBike,
                  legRun: r.legRun,
                  checkedIn: r.checkedIn,
                }))
            : [],
      };
    }),
  });
}
