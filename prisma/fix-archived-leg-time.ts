/**
 * Correct one leg time in a closed competition.
 *
 * A timing mistake usually surfaces long after the year was closed — from the
 * finish-line photos, or from a competitor who knows what they ran. By then the
 * live heats are gone and the season lives in its `CompetitionArchive` snapshot,
 * which is what the Hall of Fame is rebuilt from. So the correction belongs in
 * the archive: fix it there and re-import, and the leg split, the total, the
 * ranking, the all-time records and the medal table all fall into line together.
 * Editing the Hall of Fame row directly would fix the one number on screen and
 * be silently undone by the next re-import.
 *
 * Only the named leg's finishing stamp moves. The other legs keep the durations
 * they were measured at — the later stamps shift by the same amount — so the
 * total changes by exactly the correction and nothing else is touched.
 *
 * Usage (DATABASE_URL must point at the database being corrected):
 *
 *   npx tsx prisma/fix-archived-leg-time.ts --year 2026 --name "סהר רחמוט" --split 7:10
 *
 * That is a dry run: it prints what it would change and writes nothing. Check
 * the before/after, then repeat it with --apply. Add --leg SWIM|BIKE|RUN to name
 * the leg explicitly; by default it uses the leg the archive has that person on.
 */

import { PrismaClient } from '@prisma/client';
import { importResultsToHof } from '../src/lib/hofImport';

const prisma = new PrismaClient();

const LEGS = ['SWIM', 'BIKE', 'RUN'] as const;
type Leg = (typeof LEGS)[number];
const STAMP: Record<Leg, 'swimTime' | 'bikeTime' | 'runTime'> = {
  SWIM: 'swimTime',
  BIKE: 'bikeTime',
  RUN: 'runTime',
};

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

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** "7:10" → 430, "1:02:03" → 3723, "430" → 430. */
function parseSeconds(raw: string): number | null {
  const parts = raw.trim().split(':');
  if (parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) return null;
  return parts.map(Number).reduce((total, n) => total * 60 + n, 0);
}

const clock = (seconds: number | null) => {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

async function main() {
  const year = parseInt(arg('year') ?? '', 10);
  const name = (arg('name') ?? '').trim();
  const splitRaw = arg('split') ?? '';
  const legArg = (arg('leg') ?? '').toUpperCase();
  const apply = process.argv.includes('--apply');

  if (!Number.isInteger(year) || !name || !splitRaw) {
    console.error('Usage: --year <year> --name "<competitor>" --split <m:ss> [--leg SWIM|BIKE|RUN] [--apply]');
    process.exit(1);
  }
  const newSplit = parseSeconds(splitRaw);
  if (newSplit == null || newSplit <= 0) {
    console.error(`Could not read --split "${splitRaw}". Use m:ss (7:10), h:mm:ss, or plain seconds.`);
    process.exit(1);
  }
  if (legArg && !LEGS.includes(legArg as Leg)) {
    console.error(`--leg must be one of ${LEGS.join(', ')}.`);
    process.exit(1);
  }

  const archive = await prisma.competitionArchive.findUnique({ where: { year } });
  if (!archive) {
    console.error(`No archived competition for ${year}. Closed years only — a live season is corrected on the Scores tab.`);
    process.exit(1);
  }

  const season = archive.data as ArchivedSeason;
  const heats = season.heats ?? [];

  // Find them: a relay leg carrying the name, or a solo competitor of that name.
  const matches = heats.flatMap((heat) =>
    (heat.entries ?? [])
      .filter((entry) => entry.name.trim() === name || (entry.members ?? []).some((m) => m.name.trim() === name))
      .map((entry) => ({ heat, entry }))
  );

  if (matches.length === 0) {
    console.error(`No one named "${name}" in the ${year} archive. Check the spelling against the results.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`"${name}" appears in ${matches.length} entries in ${year}; this script corrects one:`);
    for (const m of matches) console.error(`  - ${m.entry.name} (${m.heat.name})`);
    process.exit(1);
  }

  const { heat, entry } = matches[0];
  const member = (entry.members ?? []).find((m) => m.name.trim() === name);
  const leg = (legArg || member?.leg || '') as Leg;
  if (!LEGS.includes(leg)) {
    console.error(`"${name}" has no leg recorded, so name one with --leg SWIM|BIKE|RUN.`);
    process.exit(1);
  }
  if (legArg && member?.leg && member.leg !== legArg) {
    console.warn(`⚠ The archive has ${name} on the ${member.leg} leg, but --leg says ${legArg}. Using ${legArg}.`);
  }

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
  if (previous == null) {
    console.error(`The ${LEGS[legIndex - 1] ?? 'start'} time this leg is measured from was never recorded, so its split can't be set.`);
    process.exit(1);
  }
  if (stamps[leg] == null) {
    console.error(`No ${leg} time was recorded for ${name}, so there is no split to correct.`);
    process.exit(1);
  }

  // Move this leg's stamp so its split is the corrected one, and carry every
  // later stamp with it so the legs after it keep the durations they were
  // measured at. The total moves by exactly this much and nothing else does.
  const corrected = previous + newSplit * 1000;
  const shiftMs = corrected - (stamps[leg] as number);
  stamps[leg] = corrected;
  for (const later of LEGS.slice(legIndex + 1)) {
    if (stamps[later] != null) stamps[later] = (stamps[later] as number) + shiftMs;
  }

  const splitsOf = (s: Record<Leg, number | null>) => ({
    SWIM: start != null && s.SWIM != null ? Math.round((s.SWIM - start) / 1000) : null,
    BIKE: s.SWIM != null && s.BIKE != null ? Math.round((s.BIKE - s.SWIM) / 1000) : null,
    RUN: s.BIKE != null && s.RUN != null ? Math.round((s.RUN - s.BIKE) / 1000) : null,
  });
  const totalOf = (s: Record<Leg, number | null>) =>
    start != null && s.RUN != null ? Math.round((s.RUN - start) / 1000) : null;

  const wasSplits = splitsOf(before);
  const nowSplits = splitsOf(stamps);

  console.log(`\n${year} · ${heat.name} · ${entry.name}`);
  console.log(`Correcting ${name}'s ${leg} leg to ${clock(newSplit)}\n`);
  console.log('           before     after');
  for (const l of LEGS) {
    const mark = l === leg ? ' ←' : '';
    console.log(`  ${l.padEnd(6)} ${clock(wasSplits[l]).padStart(8)}  ${clock(nowSplits[l]).padStart(8)}${mark}`);
  }
  console.log(`  ${'TOTAL'.padEnd(6)} ${clock(totalOf(before)).padStart(8)}  ${clock(totalOf(stamps)).padStart(8)}`);

  if (!apply) {
    console.log('\nDry run — nothing was changed. Re-run with --apply once the numbers above are right.');
    return;
  }

  const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
  entry.swimTime = iso(stamps.SWIM);
  entry.bikeTime = iso(stamps.BIKE);
  entry.runTime = iso(stamps.RUN);

  await prisma.competitionArchive.update({
    where: { year },
    data: { data: season as object },
  });
  console.log('\n✓ Archive updated.');

  // Rebuild the Hall of Fame from the corrected archive, so the split, the
  // total, the ranking, the records and the medal table all move together.
  const { added } = await importResultsToHof(year);
  console.log(`✓ Hall of Fame re-imported: ${added} results for ${year}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
