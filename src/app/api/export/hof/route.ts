import { requireRole } from '@/lib/auth';
import { toCsv, csvResponse } from '@/lib/csv';
import { hofRows } from '@/lib/exports';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
  return csvResponse('hall-of-fame.csv', toCsv(await hofRows()));
}
