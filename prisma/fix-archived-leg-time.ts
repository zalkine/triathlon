/**
 * Correct one leg time in a closed competition, from a terminal.
 *
 * The same correction the admin's Hall of Fame tab offers — that screen is the
 * normal way to do this, and needs no terminal. This exists for a correction
 * being scripted, or made against a database directly.
 *
 * Usage (DATABASE_URL must point at the database being corrected):
 *
 *   npx tsx prisma/fix-archived-leg-time.ts --year 2026 --name "סהר רחמוט" --split 7:10
 *
 * That is a dry run: it prints what it would change and writes nothing. Check
 * the before/after, then repeat it with --apply. Add --leg SWIM|BIKE|RUN to name
 * the leg explicitly; by default it uses the leg the archive has that person on.
 * If the same person raced more than once that year, add --team to say which.
 */

import { PrismaClient } from '@prisma/client';
import { correctArchivedLegTime, parseSplitSeconds, type SplitsView } from '../src/lib/archiveFix';
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
  'not-found': 'Nobody by that name in that year. Check the spelling against the results.',
  'no-leg': 'No leg is recorded for them, so name one with --leg SWIM|BIKE|RUN.',
  'no-stamp': 'That leg was never timed for them, so there is no time to correct.',
  'no-previous': 'The time this leg is measured from was never recorded, so this leg cannot be worked out.',
};

async function main() {
  const year = parseInt(arg('year') ?? '', 10);
  const competitor = (arg('name') ?? '').trim();
  const newSplitSeconds = parseSplitSeconds(arg('split') ?? '');
  const legArg = (arg('leg') ?? '').toUpperCase();
  const apply = process.argv.includes('--apply');

  if (!Number.isInteger(year) || !competitor || newSplitSeconds == null) {
    console.error(
      'Usage: --year <year> --name "<competitor>" --split <m:ss> [--team "<team name>"] [--leg SWIM|BIKE|RUN] [--apply]'
    );
    process.exit(1);
  }
  if (legArg && !(LEGS as readonly string[]).includes(legArg)) {
    console.error(`--leg must be one of ${LEGS.join(', ')}.`);
    process.exit(1);
  }

  const outcome = await correctArchivedLegTime({
    year,
    competitor,
    newSplitSeconds,
    leg: legArg ? (legArg as Leg) : null,
    team: arg('team') ?? null,
    apply,
  });

  if ('error' in outcome) {
    if (outcome.error === 'ambiguous') {
      console.error(`"${competitor}" raced more than once in ${year}; say which with --team "<part of the name>":`);
      for (const c of outcome.candidates) console.error(`  - ${c}`);
    } else {
      console.error(REASONS[outcome.error] ?? outcome.error);
    }
    process.exit(1);
  }

  const { correction } = outcome;
  const row = (label: string, was: keyof SplitsView, now: keyof SplitsView, mark = '') =>
    `  ${label.padEnd(6)} ${clock(correction.before[was]).padStart(8)}  ${clock(correction.after[now]).padStart(8)}${mark}`;

  console.log(`\n${year} · ${correction.heatName} · ${correction.entryName}`);
  console.log(`Correcting ${competitor}'s ${correction.leg} leg to ${clock(newSplitSeconds)}\n`);
  console.log('           before     after');
  console.log(row('SWIM', 'swim', 'swim', correction.leg === 'SWIM' ? ' ←' : ''));
  console.log(row('BIKE', 'bike', 'bike', correction.leg === 'BIKE' ? ' ←' : ''));
  console.log(row('RUN', 'run', 'run', correction.leg === 'RUN' ? ' ←' : ''));
  console.log(row('TOTAL', 'total', 'total'));

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
