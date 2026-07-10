import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Flat, per-person view for the admin's competitor screen, annotated with the
// flags the filter bar needs: checked-in state, whether a relay registrant has
// a team, and whether they've been placed in more than one team (an anomaly the
// admin should notice). Admin-only.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { registrants: { orderBy: { createdAt: 'asc' } }, groups: true },
  });

  const competitors = categories.flatMap((c) =>
    c.registrants.map((r) => {
      const teamCount =
        c.type === 'TEAM'
          ? c.groups.filter(
              (g) => g.swimRegistrantId === r.id || g.bikeRegistrantId === r.id || g.runRegistrantId === r.id
            ).length
          : 0;
      const isTeamMode = c.type === 'TEAM';
      const noTeam = isTeamMode && teamCount === 0;
      const multiTeam = teamCount > 1;
      return {
        id: r.id,
        name: r.name,
        categoryNameEn: c.nameEn,
        categoryNameHe: c.nameHe,
        mode: c.type,
        checkedIn: r.checkedIn,
        teamCount,
        noTeam,
        multiTeam,
        anomaly: noTeam || multiTeam,
      };
    })
  );

  return NextResponse.json({ competitors });
}
