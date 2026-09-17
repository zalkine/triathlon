import { requireRole } from '@/lib/auth';
import { racingCategories } from '@/lib/categories';
import { toCsv, csvResponse } from '@/lib/csv';
import { getCategoryResults } from '@/lib/ranking';
import { formatClock, formatDuration } from '@/lib/time';

export const dynamic = 'force-dynamic';

const splitMs = (from: Date | null, to: Date | null): string =>
  from && to ? formatDuration(to.getTime() - from.getTime()) : '';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  // Merged age brackets are one ranked field, so they export as one block under
  // the merged name rather than twice with two sets of places.
  const categories = await racingCategories();

  const rows: (string | number | null)[][] = [
    [
      'Category', 'Heat', 'Rank', 'Name', 'Status',
      'Start', 'Swim finish', 'Bike finish', 'Run finish',
      'Swim split', 'Bike split', 'Run split', 'Total',
    ],
  ];

  for (const cat of categories) {
    const result = await getCategoryResults(cat.id);
    if (!result) continue;
    for (const e of result.ranked) {
      rows.push([
        cat.nameEn,
        e.heatName,
        e.rank ?? '',
        e.name,
        e.status,
        e.startTime ? formatClock(e.startTime, 'en') : '',
        e.swimTime ? formatClock(e.swimTime, 'en') : '',
        e.bikeTime ? formatClock(e.bikeTime, 'en') : '',
        e.runTime ? formatClock(e.runTime, 'en') : '',
        splitMs(e.startTime, e.swimTime),
        splitMs(e.swimTime, e.bikeTime),
        splitMs(e.bikeTime, e.runTime),
        e.totalMs != null ? formatDuration(e.totalMs) : '',
      ]);
    }
  }

  return csvResponse('results.csv', toCsv(rows));
}
