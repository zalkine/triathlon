import { prisma } from './db';
import { racingGroupIds } from './categories';

export type EntryStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';

/**
 * Whether the public may see the rankings. Publishing results takes two
 * deliberate steps — the admin signs off on the timekeepers' numbers
 * (`resultsApproved`) and then puts them in front of the public
 * (`publicResultsVisible`) — because rankings are provisional until reviewed,
 * and a late substitution or a mis-stamped time is corrected before, not after,
 * the village reads it. Shared by the results API, the admin's review panel and
 * the home page, so all three agree on what "published" means.
 */
export function resultsPubliclyVisible(
  settings: { publicResultsVisible: boolean; resultsApproved: boolean } | null
): boolean {
  return !!settings?.publicResultsVisible && !!settings?.resultsApproved;
}

export type RankedEntry = {
  id: string;
  name: string;
  heatId: string;
  heatName: string;
  startTime: Date | null;
  swimTime: Date | null;
  bikeTime: Date | null;
  runTime: Date | null;
  totalMs: number | null;
  status: EntryStatus;
  rank: number | null;
};

type EntryInput = {
  id: string;
  name: string;
  heatId: string;
  heatName: string;
  startTime: Date | null;
  swimTime: Date | null;
  bikeTime: Date | null;
  runTime: Date | null;
};

export function computeStatus(startTime: Date | null, runTime: Date | null): EntryStatus {
  if (!startTime) return 'NOT_STARTED';
  if (!runTime) return 'IN_PROGRESS';
  return 'FINISHED';
}

export function rankEntries(entries: EntryInput[]): RankedEntry[] {
  const withStatus = entries.map((e) => {
    const totalMs = e.startTime && e.runTime ? e.runTime.getTime() - e.startTime.getTime() : null;
    return { ...e, totalMs, status: computeStatus(e.startTime, e.runTime) };
  });

  const finished = withStatus
    .filter((e) => e.totalMs !== null)
    .sort((a, b) => a.totalMs! - b.totalMs!);

  const statusOrder: Record<EntryStatus, number> = { IN_PROGRESS: 0, NOT_STARTED: 1, FINISHED: 2 };
  const unfinished = withStatus
    .filter((e) => e.totalMs === null)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));

  let rank = 1;
  const ranked: RankedEntry[] = finished.map((e) => ({ ...e, rank: rank++ }));
  const rest: RankedEntry[] = unfinished.map((e) => ({ ...e, rank: null }));

  return [...ranked, ...rest];
}

/**
 * Ranks a category's field. When an admin has merged age brackets into one
 * racing category, everyone in the merged field is ranked together in a single
 * list — that is what merging means. Heats are gathered from every bracket in
 * the group rather than only the primary's, so the ranking is right even before
 * the schedule has been regenerated to pack them into shared heats.
 */
export async function getCategoryResults(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return null;

  const memberIds = await racingGroupIds(categoryId);
  const heats = await prisma.heat.findMany({
    where: { categoryId: { in: memberIds } },
    include: { entries: { where: { scratched: false } } },
  });

  const entries: EntryInput[] = heats.flatMap((heat) =>
    heat.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      heatId: heat.id,
      heatName: heat.name,
      startTime: heat.startTime,
      swimTime: entry.swimTime,
      bikeTime: entry.bikeTime,
      runTime: entry.runTime,
    }))
  );

  return { category, ranked: rankEntries(entries) };
}
