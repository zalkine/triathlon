/**
 * Correct one leg time in a closed competition, from a terminal.
 *
 * The same correction the admin's Hall of Fame tab offers — that screen is the
 * normal way to do this, and needs no terminal. This exists for a correction
 * being scripted, or made against a database directly.
 *
 * Usage (DATABASE_URL must point at the database being corrected):
 *
 *   npx tsx prisma/fix-archived-leg-time.ts --year 2026                      # list that year's results
 *   npx tsx prisma/fix-archived-leg-time.ts --year 2026 --entry <id> --leg RUN --split 7:10
 *
 * Without --apply it prints what it would change and writes nothing.
 */

import { PrismaClient } from '@prisma/client';
import { correctArchivedLegTime, listArchivedResults, parseSplitSeconds } from '../src/lib/archiveFix';
import { LEGS, type Leg } from '../src/lib/constants';

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const clock = (seconds: number | null) =>
  seconds == null ? '—' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const REASONS: Record<string, string> = {
  'no-archive': 'That year has not been closed and archived. A competition still running is corrected on the Scores tab.',
  'not-found': 'No result with that id in that year. Run with --year alone to list them.',
  'no-stamp': 'That leg was never timed for them, so there is no time to correct.',
  'no-previous': 'The time this leg is measured from was never recorded, so this leg cannot be worked out.',
};

async function main() {
  const year = parseInt(arg('year') ?? '', 10);
  if (!Number.isInteger(year)) {
    console.error('Usage: --year <year> [--entry <id> --leg SWIM|BIKE|RUN --split <m:ss> [--apply]]');
    process.exit(1);
  }

  const entryId = arg('entry');
  if (!entryId) {
    // No result named: list the year so an id can be picked.
    const results = await listArchivedResults(year);
    if (results.length === 0) {
      console.error(REASONS['no-archive']);
      process.exit(1);
    }
    let category = '';
    for (const r of results) {
      if (r.categoryHe !== category) {
        category = r.categoryHe;
        console.log(`\n${category}`);
      }
      const legs = LEGS.map((l) => `${l} ${clock(r.splits[l.toLowerCase() as 'swim' | 'bike' | 'run'])}`).join('  ');
      console.log(`  ${clock(r.splits.total).padStart(7)}  ${r.name}`);
      console.log(`           ${legs}   id=${r.entryId}`);
    }
    return;
  }

  const legRaw = (arg('leg') ?? '').toUpperCase();
  const newSplitSeconds = parseSplitSeconds(arg('split') ?? '');
  if (!(LEGS as readonly string[]).includes(legRaw) || newSplitSeconds == null) {
    console.error(`--leg must be one of ${LEGS.join(', ')} and --split a time like 7:10.`);
    process.exit(1);
  }

  const outcome = await correctArchivedLegTime({
    year,
    entryId,
    leg: legRaw as Leg,
    newSplitSeconds,
    apply: process.argv.includes('--apply'),
  });
  if ('error' in outcome) {
    console.error(REASONS[outcome.error] ?? outcome.error);
    process.exit(1);
  }

  const c = outcome.correction;
  console.log(`\n${year} · ${c.categoryHe} · ${c.name}`);
  console.log(`Correcting the ${c.leg} leg${c.legName ? ` (${c.legName})` : ''} to ${clock(newSplitSeconds)}\n`);
  console.log('           before     after');
  for (const l of LEGS) {
    const key = l.toLowerCase() as 'swim' | 'bike' | 'run';
    const mark = l === c.leg ? ' ←' : '';
    console.log(`  ${l.padEnd(6)} ${clock(c.before[key]).padStart(8)}  ${clock(c.after[key]).padStart(8)}${mark}`);
  }
  console.log(`  ${'TOTAL'.padEnd(6)} ${clock(c.before.total).padStart(8)}  ${clock(c.after.total).padStart(8)}`);

  if (!outcome.applied) {
    console.log('\nDry run — nothing was changed. Re-run with --apply once the numbers above are right.');
    return;
  }
  console.log(`\n✓ Archive updated and ${year} re-published: ${outcome.imported} results.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
