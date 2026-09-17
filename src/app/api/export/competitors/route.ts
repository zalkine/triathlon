import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { racingCategories } from '@/lib/categories';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const [categories, fields] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { registrants: { orderBy: { createdAt: 'asc' } } },
    }),
    racingCategories(),
  ]);

  // The roster keeps the bracket each person actually registered in — the admin
  // needs it to manage age groups — and names the field they race in beside it,
  // which differs only where brackets have been merged.
  const fieldName = new Map<string, string>();
  for (const f of fields) for (const id of f.memberIds) fieldName.set(id, f.nameEn);

  const rows: (string | number | null)[][] = [
    ['Category', 'Races as', 'Name', 'Age', 'Type', 'Group preference', 'Swim', 'Bike', 'Run', 'Checked in', 'Registered at'],
  ];

  for (const cat of categories) {
    for (const r of cat.registrants) {
      rows.push([
        cat.nameEn,
        fieldName.get(cat.id) ?? cat.nameEn,
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
