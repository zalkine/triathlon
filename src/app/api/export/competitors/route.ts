import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { registrants: { orderBy: { createdAt: 'asc' } } },
  });

  const rows: (string | number | null)[][] = [
    ['Category', 'Name', 'Age', 'Type', 'Group preference', 'Swim', 'Bike', 'Run', 'Checked in', 'Registered at'],
  ];

  for (const cat of categories) {
    for (const r of cat.registrants) {
      rows.push([
        cat.nameEn,
        r.name,
        r.age ?? '',
        r.mode,
        r.groupPref ?? '',
        r.legSwim ? 'Y' : '',
        r.legBike ? 'Y' : '',
        r.legRun ? 'Y' : '',
        r.checkedIn ? 'Y' : '',
        r.createdAt.toISOString(),
      ]);
    }
  }

  return csvResponse('competitors.csv', toCsv(rows));
}
