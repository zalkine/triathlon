import { prisma } from './db';
import { racingGroupIds } from './categories';

export type EntryStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';

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

/**
 * How long each leg took, in seconds: the swim measured from the heat's start,
 * then each leg from the one before it. A leg whose stamp is missing (only the
 * finish was taken, say) has no split rather than a wrong one, so the ones that
 * were measured can still be shown.
 *
 * The same reading as the results CSV's split columns — a competitor comparing
 * the two must not find them disagreeing.
 */
export type LegSplits = { swimSeconds: number | null; bikeSeconds: number | null; runSeconds: number | null };

export function legSplits(e: {
  startTime: Date | null;
  swimTime: Date | null;
  bikeTime: Date | null;
  runTime: Date | null;
}): LegSplits {
  const between = (from: Date | null, to: Date | null) =>
    from && to ? Math.round((to.getTime() - from.getTime()) / 1000) : null;
  return {
    swimSeconds: between(e.startTime, e.swimTime),
    bikeSeconds: between(e.swimTime, e.bikeTime),
    runSeconds: between(e.bikeTime, e.runTime),
  };
}

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
