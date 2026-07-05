export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export type ScheduleBlock = {
  categoryId: string;
  estDurationMinutes: number;
  heatCount: number;
};

/**
 * Returns, per input block (categories in race order), one estimated start
 * Date per heat in that block. Heats within a category run back-to-back;
 * each heat is assumed to take estDurationMinutes plus a fixed gap before
 * the next one starts (the gap covers the pool clearing for the next wave).
 */
export function computeEstimatedStarts(blocks: ScheduleBlock[], raceStartTime: Date, gapMinutes: number): Date[][] {
  let cursor = raceStartTime.getTime();
  const gapMs = gapMinutes * 60_000;

  return blocks.map((block) => {
    const starts: Date[] = [];
    for (let i = 0; i < block.heatCount; i++) {
      starts.push(new Date(cursor));
      cursor += block.estDurationMinutes * 60_000 + gapMs;
    }
    return starts;
  });
}
