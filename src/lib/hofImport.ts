// Copying a season's finished results into the Hall of Fame.
//
// Deliberately a plain module rather than part of `src/actions/hof.ts`: every
// export of a 'use server' file is a callable endpoint, and this one clears rows
// before it writes them, so it must only ever be reachable through a caller that
// has already checked who is asking.

import { prisma } from './db';
import { getCategoryResults } from './ranking';
import { resultsPubliclyVisible, competitionYear } from './season';
import { allCategories, racingCategories } from './categories';
import { mergeFamilyOf, mergedCategoryName } from './constants';
import type { Family } from './hallOfFame';

// Map a competition category to a Hall of Fame "family" bucket.
function familyForCategoryKey(key: string): Family {
  if (key.startsWith('PRO_')) return 'Elite';
  if (key.startsWith('INTER_')) return 'Amateur';
  if (key.startsWith('KIDS_')) return 'Kids';
  return 'Open';
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
 */
export async function importResultsToHof(year: number): Promise<{ added: number }> {
  const fields = await racingCategories();

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
  const namesByFamily = new Map<string, string[]>();
  for (const c of categories) {
    const family = mergeFamilyOf(c.key);
    if (family) namesByFamily.set(family, [...(namesByFamily.get(family) ?? []), c.nameHe]);
  }
  for (const names of namesByFamily.values()) ownedLabels.add(mergedCategoryName(names));

  type Row = {
    year: number;
    categoryHe: string;
    family: string;
    isTeam: boolean;
    rank: number | null;
    name: string;
    seconds: number;
    members: string[];
  };
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

    for (const e of finished) {
      rows.push({
        year,
        categoryHe: field.nameHe,
        family: familyForCategoryKey(field.key),
        isTeam: field.type === 'TEAM',
        rank: e.rank,
        name: e.name,
        seconds: Math.round((e.totalMs as number) / 1000),
        members: field.type === 'TEAM' ? membersByEntry.get(e.id) ?? [] : [],
      });
    }
  }

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

