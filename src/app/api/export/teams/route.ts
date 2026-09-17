import { requireRole } from '@/lib/auth';
import { toCsv, csvResponse } from '@/lib/csv';
import { teamRows } from '@/lib/exports';

export const dynamic = 'force-dynamic';

// The relay teams as they stand right now — printable while groups are still
// being arranged, before the lottery has built any heats.
export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
  return csvResponse('teams.csv', toCsv(await teamRows()));
}
