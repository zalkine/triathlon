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
// The result to correct is chosen from a list of the year's results rather than
// by typing a name. A typed name has to match what the archive happens to hold,
// which is not always what the results page displays — a relay entered by hand
// has no roster behind its name at all — and a mismatch leaves whoever is trying
// to fix a published time guessing at spellings. Picking from the year's own
// results cannot miss.
//
// A plain module rather than a server action, for the same reason as
// `hofImport`: it rewrites published results, so it must only be reachable
// through a caller that has already checked who is asking.

import { prisma } from './db';
import { LEGS, isRegistrationOnlyCategory, type Leg } from './constants';
import { toRacingCategories, type CategoryRow } from './categories';
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
type ArchivedHeat = { id: string; name: string; categoryId: string; startTime: string | null; entries?: ArchivedEntry[] };
type ArchivedSeason = { categories?: CategoryRow[]; heats?: ArchivedHeat[] };

/** The legs and the total, in seconds, as the results pages show them. */
export type SplitsView = {
  swim: number | null;
  bike: number | null;
  run: number | null;
  total: number | null;
};

/** One result of a closed year, as the admin picks it off a list. */
export type ArchivedResult = {
  entryId: string;
  /** The name as the Hall of Fame publishes it: a team's roster, or a competitor. */
  name: string;
  /** The field it raced in, e.g. "עממי - קבוצות". */
  categoryHe: string;
  heatName: string;
  splits: SplitsView;
  /** Who did each leg, where the archive knows. */
  legNames: Record<Leg, string | null>;
};

export type Correction = {
  year: number;
  entryId: string;
  name: string;
  categoryHe: string;
  leg: Leg;
  /** The person on that leg, when the archive knows them. */
  legName: string | null;
  newSplitSeconds: number;
  before: SplitsView;
  after: SplitsView;
};

export type CorrectionOutcome =
  | { ok: true; correction: Correction; applied: boolean; imported: number }
  | { error: 'no-archive' | 'not-found' | 'no-stamp' | 'no-previous' };

/** "7:10" → 430, "1:02:03" → 3723, "430" → 430. Null when it isn't a time. */
export function parseSplitSeconds(raw: string): number | null {
  const parts = raw.trim().split(':');
  if (parts.length === 0 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.map(Number).reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 ? seconds : null;
}

const at = (value: string | null) => (value ? new Date(value).getTime() : null);

function splitsOf(start: number | null, stamps: Record<Leg, number | null>): SplitsView {
  const between = (from: number | null, to: number | null) =>
    from != null && to != null ? Math.round((to - from) / 1000) : null;
  return {
    swim: between(start, stamps.SWIM),
    bike: between(stamps.SWIM, stamps.BIKE),
    run: between(stamps.BIKE, stamps.RUN),
    total: between(start, stamps.RUN),
  };
}

async function loadSeason(year: number): Promise<ArchivedSeason | null> {
  const archive = await prisma.competitionArchive.findUnique({ where: { year } });
  return archive ? (archive.data as ArchivedSeason) : null;
}

/**
 * Every result a closed year holds, in the order the Hall of Fame lists them:
 * by field, fastest first. This is what the admin picks from, so it deliberately
 * includes results with legs that were never timed — seeing that a leg is blank
 * is part of understanding what can be corrected.
 */
export async function listArchivedResults(year: number): Promise<ArchivedResult[]> {
  const season = await loadSeason(year);
  if (!season) return [];
  const categories = season.categories ?? [];
  const heats = season.heats ?? [];

  const fields = toRacingCategories(categories.filter((c) => !isRegistrationOnlyCategory(c.key)));
  const fieldOfCategory = new Map<string, { id: string; nameHe: string; order: number }>();
  fields.forEach((f, order) => f.memberIds.forEach((id) => fieldOfCategory.set(id, { id: f.id, nameHe: f.nameHe, order })));

  const results: (ArchivedResult & { order: number })[] = [];
  for (const heat of heats) {
    const field = fieldOfCategory.get(heat.categoryId);
    if (!field) continue;
    const start = at(heat.startTime);
    for (const entry of heat.entries ?? []) {
      if (entry.scratched) continue;
      const stamps: Record<Leg, number | null> = {
        SWIM: at(entry.swimTime),
        BIKE: at(entry.bikeTime),
        RUN: at(entry.runTime),
      };
      const legNames = { SWIM: null, BIKE: null, RUN: null } as Record<Leg, string | null>;
      for (const m of entry.members ?? []) {
        if (m.leg && (LEGS as readonly string[]).includes(m.leg) && m.name && m.name !== '—') {
          legNames[m.leg as Leg] = m.name;
        }
      }
      results.push({
        entryId: entry.id,
        name: entry.name,
        categoryHe: field.nameHe,
        heatName: heat.name,
        splits: splitsOf(start, stamps),
        legNames,
        order: field.order,
      });
    }
  }

  return results
    .sort(
      (a, b) =>
        a.order - b.order ||
        (a.splits.total ?? Number.MAX_SAFE_INTEGER) - (b.splits.total ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, 'he')
    )
    .map(({ order: _order, ...r }) => r);
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
  entryId: string;
  leg: Leg;
  newSplitSeconds: number;
  apply: boolean;
}): Promise<CorrectionOutcome> {
  const { year, entryId, leg, newSplitSeconds, apply } = options;

  const season = await loadSeason(year);
  if (!season) return { error: 'no-archive' };

  const categories = season.categories ?? [];
  const heats = season.heats ?? [];
  const found = heats
    .flatMap((heat) => (heat.entries ?? []).map((entry) => ({ heat, entry })))
    .find(({ entry }) => entry.id === entryId);
  if (!found) return { error: 'not-found' };

  const { heat, entry } = found;
  const fields = toRacingCategories(categories.filter((c) => !isRegistrationOnlyCategory(c.key)));
  const categoryHe = fields.find((f) => f.memberIds.includes(heat.categoryId))?.nameHe ?? '';

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

  const legName =
    (entry.members ?? []).find((m) => m.leg === leg && m.name && m.name !== '—')?.name ?? null;

  const correction: Correction = {
    year,
    entryId,
    name: entry.name,
    categoryHe,
    leg,
    legName,
    newSplitSeconds,
    before: splitsOf(start, before),
    after: splitsOf(start, stamps),
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
