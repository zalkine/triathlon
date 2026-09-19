// Correcting one leg time in a closed competition.
//
// A timing mistake usually surfaces long after the year was closed — from the
// finish-line photos, or from a competitor who knows what they ran. By then the
// live heats are gone and the season lives in its `CompetitionArchive` snapshot,
// which is what the Hall of Fame is rebuilt from. So the correction belongs in
// the archive: fix it there and re-import, and the leg split, the total, the
// ranking, the all-time records and the medal table all fall into line together.
// Editing the Hall of Fame row directly would fix the one number on screen and
// be silently undone by the next re-import.
//
// A plain module rather than a server action, for the same reason as
// `hofImport`: it rewrites published results, so it must only be reachable
// through a caller that has already checked who is asking.

import { prisma } from './db';
import { LEGS, type Leg } from './constants';
import { importResultsToHof } from './hofImport';

type ArchivedMember = { name: string; leg: string | null };
type ArchivedEntry = {
  id: string;
  name: string;
  scratched: boolean;
  swimTime: string | null;
  bikeTime: string | null;
  runTime: string | null;
  members?: ArchivedMember[];
};
type ArchivedHeat = { id: string; name: string; startTime: string | null; entries?: ArchivedEntry[] };
type ArchivedSeason = { heats?: ArchivedHeat[] };

/** The legs and the total, in seconds, as the results pages show them. */
export type SplitsView = {
  swim: number | null;
  bike: number | null;
  run: number | null;
  total: number | null;
};

export type Correction = {
  year: number;
  heatName: string;
  /** The entry as it is published: a team's roster, or a solo competitor. */
  entryName: string;
  competitor: string;
  leg: Leg;
  newSplitSeconds: number;
  before: SplitsView;
  after: SplitsView;
};

export type CorrectionOutcome =
  | { ok: true; correction: Correction; applied: boolean; imported: number }
  | { error: 'no-archive' | 'not-found' | 'no-leg' | 'no-stamp' | 'no-previous'; candidates?: string[] }
  | { error: 'ambiguous'; candidates: string[] };

/** "7:10" → 430, "1:02:03" → 3723, "430" → 430. Null when it isn't a time. */
export function parseSplitSeconds(raw: string): number | null {
  const parts = raw.trim().split(':');
  if (parts.length === 0 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.map(Number).reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 ? seconds : null;
}

/**
 * Move one leg's finishing stamp so its split becomes `newSplitSeconds`.
 *
 * Only that leg changes. The legs after it keep the durations they were
 * measured at — their stamps shift by the same amount — so the total moves by
 * exactly the correction and nothing else is touched.
 *
 * Nothing is written unless `apply` is set, so the same call serves as the
 * preview an admin checks against the photo before anything public changes.
 */
export async function correctArchivedLegTime(options: {
  year: number;
  competitor: string;
  newSplitSeconds: number;
  /** Which leg; by default the one the archive has that person on. */
  leg?: Leg | null;
  /** Narrows the search when the same person raced more than once that year. */
  team?: string | null;
  apply: boolean;
}): Promise<CorrectionOutcome> {
  const { year, newSplitSeconds, apply } = options;
  const competitor = options.competitor.trim();
  const team = (options.team ?? '').trim();

  const archive = await prisma.competitionArchive.findUnique({ where: { year } });
  if (!archive) return { error: 'no-archive' };

  const season = archive.data as ArchivedSeason;
  const heats = season.heats ?? [];

  // A relay leg carrying the name, or a solo competitor of that name.
  const matches = heats.flatMap((heat) =>
    (heat.entries ?? [])
      .filter((e) => e.name.trim() === competitor || (e.members ?? []).some((m) => m.name.trim() === competitor))
      .filter((e) => !team || e.name.includes(team))
      .map((entry) => ({ heat, entry }))
  );
  if (matches.length === 0) return { error: 'not-found' };
  if (matches.length > 1) return { error: 'ambiguous', candidates: matches.map((m) => m.entry.name) };

  const { heat, entry } = matches[0];
  const member = (entry.members ?? []).find((m) => m.name.trim() === competitor);
  const leg = (options.leg || member?.leg || '') as Leg;
  if (!LEGS.includes(leg)) return { error: 'no-leg' };

  const at = (value: string | null) => (value ? new Date(value).getTime() : null);
  const start = at(heat.startTime);
  const stamps: Record<Leg, number | null> = {
    SWIM: at(entry.swimTime),
    BIKE: at(entry.bikeTime),
    RUN: at(entry.runTime),
  };
  const before = { ...stamps };

  const legIndex = LEGS.indexOf(leg);
  const previous = legIndex === 0 ? start : stamps[LEGS[legIndex - 1]];
  if (previous == null) return { error: 'no-previous' };
  if (stamps[leg] == null) return { error: 'no-stamp' };

  const corrected = previous + newSplitSeconds * 1000;
  const shiftMs = corrected - (stamps[leg] as number);
  stamps[leg] = corrected;
  for (const later of LEGS.slice(legIndex + 1)) {
    if (stamps[later] != null) stamps[later] = (stamps[later] as number) + shiftMs;
  }

  const view = (s: Record<Leg, number | null>): SplitsView => {
    const between = (from: number | null, to: number | null) =>
      from != null && to != null ? Math.round((to - from) / 1000) : null;
    return {
      swim: between(start, s.SWIM),
      bike: between(s.SWIM, s.BIKE),
      run: between(s.BIKE, s.RUN),
      total: between(start, s.RUN),
    };
  };

  const correction: Correction = {
    year,
    heatName: heat.name,
    entryName: entry.name,
    competitor,
    leg,
    newSplitSeconds,
    before: view(before),
    after: view(stamps),
  };

  if (!apply) return { ok: true, correction, applied: false, imported: 0 };

  const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
  entry.swimTime = iso(stamps.SWIM);
  entry.bikeTime = iso(stamps.BIKE);
  entry.runTime = iso(stamps.RUN);

  await prisma.competitionArchive.update({ where: { year }, data: { data: season as object } });
  // Rebuild the Hall of Fame from the corrected archive, so the split, the
  // total, the ranking, the records and the medal table all move together.
  const { added } = await importResultsToHof(year);

  return { ok: true, correction, applied: true, imported: added };
}
