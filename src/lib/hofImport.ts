// Copying a season's finished results into the Hall of Fame.
//
// Deliberately a plain module rather than part of `src/actions/hof.ts`: every
// export of a 'use server' file is a callable endpoint, and this one clears rows
// before it writes them, so it must only ever be reachable through a caller that
// has already checked who is asking.

import { prisma } from './db';
import { getCategoryResults, legSplits, rankEntries } from './ranking';
import { resultsPubliclyVisible, competitionYear } from './season';
import { allCategories, racingCategories, toRacingCategories, type CategoryRow, type RacingCategory } from './categories';
import { isRegistrationOnlyCategory, mergeFamilyOf, mergedCategoryName } from './constants';
import type { Family } from './hallOfFame';

// Map a competition category to a Hall of Fame "family" bucket.
function familyForCategoryKey(key: string): Family {
  if (key.startsWith('PRO_')) return 'Elite';
  if (key.startsWith('INTER_')) return 'Amateur';
  if (key.startsWith('KIDS_')) return 'Kids';
  return 'Open';
}

type Row = {
  year: number;
  categoryHe: string;
  family: string;
  isTeam: boolean;
  rank: number | null;
  name: string;
  seconds: number;
  members: string[];
  swimSeconds: number | null;
  bikeSeconds: number | null;
  runSeconds: number | null;
};

/** One finished competitor as the Hall of Fame stores them, splits included. */
function toRow(
  year: number,
  field: { nameHe: string; key: string; type: string },
  e: {
    rank: number | null;
    name: string;
    totalMs: number | null;
    startTime: Date | null;
    swimTime: Date | null;
    bikeTime: Date | null;
    runTime: Date | null;
  },
  members: string[]
): Row {
  return {
    year,
    categoryHe: field.nameHe,
    family: familyForCategoryKey(field.key),
    isTeam: field.type === 'TEAM',
    rank: e.rank,
    name: e.name,
    seconds: Math.round((e.totalMs as number) / 1000),
    members: field.type === 'TEAM' ? members : [],
    ...legSplits(e),
  };
}

/** This year's finished results, read from the live competition tables. */
async function rowsFromLiveSeason(year: number, fields: RacingCategory[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const field of fields) {
    const result = await getCategoryResults(field.id);
    if (!result) continue;
    const finished = result.ranked.filter((e) => e.totalMs != null);
    if (finished.length === 0) continue;

    // Members for team entries, to populate the split roster.
    const membersByEntry = new Map<string, string[]>();
    if (field.type === 'TEAM') {
      const entries = await prisma.entry.findMany({
        where: { id: { in: finished.map((e) => e.id) } },
        include: { members: true },
      });
      for (const e of entries) {
        membersByEntry.set(
          e.id,
          e.members.map((m) => m.name).filter((n) => n && n !== '—')
        );
      }
    }

    for (const e of finished) rows.push(toRow(year, field, e, membersByEntry.get(e.id) ?? []));
  }
  return rows;
}

// The shape the close-the-competition snapshot stores. Only the parts this
// reconstruction needs are named; the rest of the archive is ignored here.
type ArchivedSeason = {
  categories?: CategoryRow[];
  heats?: {
    id: string;
    categoryId: string;
    name: string;
    startTime: string | null;
    entries?: {
      id: string;
      name: string;
      scratched: boolean;
      swimTime: string | null;
      bikeTime: string | null;
      runTime: string | null;
      members?: { name: string }[];
    }[];
  }[];
};

/**
 * The same results, rebuilt from a closed season's archive.
 *
 * Once a competition is closed its heats and entries are gone from the live
 * tables, so re-importing that year — to pick up a column the Hall of Fame
 * gained since, or simply to re-run it — has to read the snapshot instead. It
 * is ranked with the same function the live race uses, over the same rows the
 * archive copied at closing time, so it reproduces exactly what was published.
 */
async function rowsFromArchive(year: number): Promise<Row[]> {
  const archive = await prisma.competitionArchive.findUnique({ where: { year } });
  if (!archive) return [];
  const season = archive.data as ArchivedSeason;
  const categories = season.categories ?? [];
  const heats = season.heats ?? [];
  if (categories.length === 0 || heats.length === 0) return [];

  const fields = toRacingCategories(categories.filter((c) => !isRegistrationOnlyCategory(c.key)));
  const fieldOfCategory = new Map<string, string>();
  fields.forEach((f) => f.memberIds.forEach((id) => fieldOfCategory.set(id, f.id)));
  const date = (value: string | null) => (value ? new Date(value) : null);

  const rows: Row[] = [];
  for (const field of fields) {
    const membersByEntry = new Map<string, string[]>();
    const entries = heats
      .filter((h) => fieldOfCategory.get(h.categoryId) === field.id)
      .flatMap((h) =>
        (h.entries ?? [])
          .filter((e) => !e.scratched)
          .map((e) => {
            membersByEntry.set(
              e.id,
              (e.members ?? []).map((m) => m.name).filter((n) => n && n !== '—')
            );
            return {
              id: e.id,
              name: e.name,
              heatId: h.id,
              heatName: h.name,
              startTime: date(h.startTime),
              swimTime: date(e.swimTime),
              bikeTime: date(e.bikeTime),
              runTime: date(e.runTime),
            };
          })
      );

    for (const e of rankEntries(entries).filter((e) => e.totalMs != null)) {
      rows.push(toRow(year, field, e, membersByEntry.get(e.id) ?? []));
    }
  }
  return rows;
}

/**
 * Copy a year's finished results into the Hall of Fame, where they join every
 * previous year and are read exactly the same way — this is what makes 2026 look
 * like 2023 to a visitor.
 *
 * Imported per *racing field* rather than per stored category, so age brackets
 * the admin merged arrive once, under the merged name, ranked as they actually
 * raced. Re-running is safe and is how a late correction reaches the Hall of
 * Fame: every row this year's categories could have written is cleared first —
 * the merged names and the individual bracket names alike, so flipping a merge
 * on or off between runs can't leave a stale copy behind. Rows an admin added by
 * hand under some other label are left alone.
 *
 * A closed year is rebuilt from its archive, so re-importing one still works
 * after its live tables were emptied. And an import that finds nothing to write
 * changes nothing at all: clearing a year and putting nothing back would turn a
 * mistimed re-run into the silent loss of a whole competition.
 */
export async function importResultsToHof(year: number): Promise<{ added: number }> {
  const fields = await racingCategories();
  const live = await rowsFromLiveSeason(year, fields);
  const rows = live.length > 0 ? live : await rowsFromArchive(year);
  if (rows.length === 0) return { added: 0 };

  // Every label this year's racing could be filed under. A bracket raced on its
  // own is filed under its own name and a merged pair under the merged one, so
  // both are cleared — and so is the merged label of every mergeable family,
  // because a merge undone between two imports would otherwise leave the copy it
  // wrote behind next to the copy this one writes. (The label a family reduces
  // to is the same whichever of its brackets were joined, so one per family is
  // enough.) Rows an admin added by hand under any other label are left alone.
  const categories = await allCategories();
  const ownedLabels = new Set<string>();
  for (const c of categories) ownedLabels.add(c.nameHe);
  for (const f of fields) ownedLabels.add(f.nameHe);
  for (const r of rows) ownedLabels.add(r.categoryHe);
  const namesByFamily = new Map<string, string[]>();
  for (const c of categories) {
    const family = mergeFamilyOf(c.key);
    if (family) namesByFamily.set(family, [...(namesByFamily.get(family) ?? []), c.nameHe]);
  }
  for (const names of namesByFamily.values()) ownedLabels.add(mergedCategoryName(names));

  await prisma.$transaction([
    prisma.historicalResult.deleteMany({ where: { year, categoryHe: { in: [...ownedLabels] } } }),
    prisma.historicalResult.createMany({ data: rows }),
  ]);

  return { added: rows.length };
}

/**
 * Keep the Hall of Fame in step with published results.
 *
 * Publishing the results is what puts them in the Hall of Fame, so any later
 * correction — a time, a stand-in, someone taken out of the ranking — has to
 * reach it too, or the two would quietly disagree. Called from the handful of
 * places that change a published result; a no-op (one settings read) while the
 * results are still under review, which is the usual case.
 */
export async function syncPublishedResultsToHof(): Promise<void> {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!resultsPubliclyVisible(settings)) return;
  await importResultsToHof(competitionYear(settings?.raceStartTime ?? null));
}
