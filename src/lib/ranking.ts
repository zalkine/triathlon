import { prisma } from './db';

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

export async function getCategoryResults(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { heats: { include: { entries: true } } },
  });
  if (!category) return null;

  const entries: EntryInput[] = category.heats.flatMap((heat) =>
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
