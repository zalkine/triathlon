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

  const contacts = await prisma.contact.findMany({ orderBy: { sortOrder: 'asc' } });

  const rows: (string | number | null)[][] = [['Role', 'Name', 'Phone']];
  for (const c of contacts) rows.push([c.role, c.name, c.phone]);

  return csvResponse('contacts.csv', toCsv(rows));
}
