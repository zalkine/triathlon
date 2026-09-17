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
 * One slot in the race timetable: a single trip through the pool. Normally that
 * is one heat, but a combined start (several heats sharing a waveId) is also one
 * slot — the heats enter the water together, so they occupy the pool once and
 * take as long as the slowest category in the wave.
 */
export type ScheduleSlot = { estDurationMinutes: number };

/**
 * Walks the slots in race order and returns the estimated start of each. A slot
 * is assumed to take its estDurationMinutes plus a fixed gap before the next one
 * starts (the gap covers the pool clearing for the next wave).
 */
export function computeSlotStarts(slots: ScheduleSlot[], raceStartTime: Date, gapMinutes: number): Date[] {
  let cursor = raceStartTime.getTime();
  const gapMs = gapMinutes * 60_000;

  return slots.map((slot) => {
    const start = new Date(cursor);
    cursor += slot.estDurationMinutes * 60_000 + gapMs;
    return start;
  });
}

/**
 * Returns, per input block (categories in race order), one estimated start
 * Date per heat in that block — each heat taking a slot of its own. Used for
 * the admin's pre-lottery estimate, where heats (and so combined starts) don't
 * exist yet; the generated schedule itself goes through `computeSlotStarts`.
 */
export function computeEstimatedStarts(blocks: ScheduleBlock[], raceStartTime: Date, gapMinutes: number): Date[][] {
  const slots: ScheduleSlot[] = blocks.flatMap((block) =>
    Array.from({ length: block.heatCount }, () => ({ estDurationMinutes: block.estDurationMinutes }))
  );
  const starts = computeSlotStarts(slots, raceStartTime, gapMinutes);

  let i = 0;
  return blocks.map((block) => starts.slice(i, (i += block.heatCount)));
}
