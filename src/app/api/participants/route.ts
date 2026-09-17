import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { allCategories, toRacingCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Listed by the field each competitor races in, not by the bracket they filled
  // in at registration: once an admin has merged two age brackets they are one
  // category with one ranking, so the public list shows them as one group under
  // the merged name. Registration-only categories (the toddlers fun run) are
  // never merged and simply appear as themselves.
  const [rows, categories] = await Promise.all([
    allCategories(),
    prisma.category.findMany({
      include: { registrants: { orderBy: { createdAt: 'asc' } }, groups: { orderBy: { createdAt: 'asc' } } },
    }),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const fields = toRacingCategories(rows);

  return NextResponse.json({
    categories: fields.map((field) => {
      const members = field.memberIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
      const registrants = members.flatMap((c) => c.registrants);
      const groups = members.flatMap((c) => c.groups);

      const nameOf = new Map(registrants.map((r) => [r.id, r.name]));
      // Group membership is checked across the whole field, so a merged
      // bracket's relay never makes its own members look unattached.
      const inGroup = new Set(groups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId]));

      return {
        id: field.id,
        nameEn: field.nameEn,
        nameHe: field.nameHe,
        type: field.type,
        // Headcount of real people in this field (matches the check-in list).
        // A relay team is several people, so this is *not* singles+groups+available.
        count: registrants.length,
        // SINGLE fields: every registrant is a solo competitor.
        singles:
          field.type === 'SINGLE' ? registrants.map((r) => ({ name: r.name, checkedIn: r.checkedIn })) : [],
        // TEAM fields: formed groups (self-formed or lottery) with role names;
        // an open leg ("will be added later") comes back as null.
        groups: groups.map((g) => ({
          id: g.id,
          swim: g.swimRegistrantId ? nameOf.get(g.swimRegistrantId) ?? '?' : null,
          bike: g.bikeRegistrantId ? nameOf.get(g.bikeRegistrantId) ?? '?' : null,
          run: g.runRegistrantId ? nameOf.get(g.runRegistrantId) ?? '?' : null,
        })),
        // TEAM fields: people not currently holding a leg in any group, so
        // available to join one. Keyed off actual group membership (not the
        // registration-time groupPref) so nobody is hidden after an admin
        // clears or reassigns their leg — never hide a registrant.
        available:
          field.type === 'TEAM'
            ? registrants
                .filter((r) => !inGroup.has(r.id))
                .map((r) => ({
                  name: r.name,
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
