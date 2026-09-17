import { prisma } from './db';
import { HEAT_CAPACITY } from './constants';

// Shared helpers for reasoning about what is actually in the pool at one time.
//
// A heat normally uses the pool on its own, but heats the admin combined into a
// single start (same waveId) all enter the water together — so "how full is this
// heat" and "how full is the pool when this heat goes" are different questions,
// and every capacity decision has to ask the second one.

/** Ids of every heat that starts together with this one, itself included. */
export async function waveHeatIds(heat: { id: string; waveId: string | null }): Promise<string[]> {
  if (!heat.waveId) return [heat.id];
  const siblings = await prisma.heat.findMany({ where: { waveId: heat.waveId }, select: { id: true } });
  return siblings.length > 0 ? siblings.map((h) => h.id) : [heat.id];
}

/**
 * How many competitors would be in the water when `heatId` goes off, counting
 * every heat combined into its start and ignoring anyone scratched (a no-show
 * doesn't take a lane). Returns null if the heat no longer exists.
 */
export async function poolLoad(heatId: string): Promise<{ heatIds: string[]; live: number } | null> {
  const heat = await prisma.heat.findUnique({ where: { id: heatId }, select: { id: true, waveId: true } });
  if (!heat) return null;
  const heatIds = await waveHeatIds(heat);
  const live = await prisma.entry.count({ where: { heatId: { in: heatIds }, scratched: false } });
  return { heatIds, live };
}

/**
 * Guard for placing `adding` more competitors into `heatId`. The pool's lane
 * count is a physical limit, not a rule the app should quietly enforce: the
 * person at the pool may know two children will share a lane, or that half the
 * heat won't turn up. So this never blocks outright — it reports that the move
 * would overfill the pool, and the caller confirms and retries with `force`.
 * Returns null when the placement is within capacity or has been confirmed.
 */
export async function checkCapacity(
  heatId: string,
  adding: number,
  force: boolean
): Promise<{ error: 'over-capacity'; total: number; capacity: number } | null> {
  if (force) return null;
  const load = await poolLoad(heatId);
  if (!load) return null;
  const total = load.live + adding;
  if (total <= HEAT_CAPACITY) return null;
  return { error: 'over-capacity', total, capacity: HEAT_CAPACITY };
}
