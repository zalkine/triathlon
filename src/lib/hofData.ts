import { prisma } from './db';
import type { Family, HofResult } from './hallOfFame';

// One HOF row with its DB id (the admin editor needs the id; the public
// computations ignore it).
export type HofRow = HofResult & { id: string };

// Load every Hall of Fame result from the database, mapped to the shape the
// pure hallOfFame computations expect. Ordered newest-year first, then by time.
export async function loadHofResults(): Promise<HofRow[]> {
  const rows = await prisma.historicalResult.findMany({
    orderBy: [{ year: 'desc' }, { seconds: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    categoryHe: r.categoryHe,
    family: r.family as Family,
    isTeam: r.isTeam,
    rank: r.rank,
    name: r.name,
    seconds: r.seconds,
    members: r.members,
  }));
}
