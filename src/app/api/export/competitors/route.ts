import { requireRole } from '@/lib/auth';
import { toCsv, csvResponse } from '@/lib/csv';
import { competitorRows } from '@/lib/exports';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
  return csvResponse('competitors.csv', toCsv(await competitorRows()));
}
