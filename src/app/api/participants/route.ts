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
        // Headcount of real people in this category (matches the check-in list).
        // A relay team is several people, so this is *not* singles+groups+available.
        count: c.registrants.length,
        // SINGLE categories: every registrant is a solo competitor.
        singles:
          c.type === 'SINGLE'
            ? c.registrants.map((r) => ({ name: r.name, age: r.age, checkedIn: r.checkedIn }))
            : [],
        // TEAM categories: formed groups (self-formed or lottery) with role
        // names; an open leg ("will be added later") comes back as null.
        groups: c.groups.map((g) => ({
          id: g.id,
          swim: g.swimRegistrantId ? nameOf.get(g.swimRegistrantId) ?? '?' : null,
          bike: g.bikeRegistrantId ? nameOf.get(g.bikeRegistrantId) ?? '?' : null,
          run: g.runRegistrantId ? nameOf.get(g.runRegistrantId) ?? '?' : null,
        })),
        // TEAM categories: people available to join a group, not yet in any
        // group. Anyone who isn't a self-formed-group captain counts here,
        // including legacy rows with a null groupPref (never hide a registrant).
        available:
          c.type === 'TEAM'
            ? c.registrants
                .filter((r) => r.groupPref !== 'HAS_GROUP' && !inGroup.has(r.id))
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
