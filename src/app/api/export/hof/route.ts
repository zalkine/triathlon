import { requireRole } from '@/lib/auth';
import { toCsv, csvResponse } from '@/lib/csv';
import { loadHofResults } from '@/lib/hofData';
import { formatHms } from '@/lib/hallOfFame';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const results = await loadHofResults();

  const rows: (string | number | null)[][] = [
    ['Year', 'Category', 'Family', 'Type', 'Rank', 'Name', 'Members', 'Time', 'Seconds'],
  ];

  for (const r of results) {
    rows.push([
      r.year,
      r.categoryHe,
      r.family,
      r.isTeam ? 'Team' : 'Individual',
      r.rank ?? '',
      r.name,
      (r.members ?? []).join(' / '),
      formatHms(r.seconds),
      r.seconds,
    ]);
  }

  return csvResponse('hall-of-fame.csv', toCsv(rows));
}
