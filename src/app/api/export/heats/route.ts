import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { toCsv, csvResponse } from '@/lib/csv';
import { formatClock } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      heats: {
        orderBy: [{ estimatedStart: 'asc' }, { createdAt: 'asc' }],
        include: { entries: { orderBy: { createdAt: 'asc' }, include: { members: true } } },
      },
    },
  });

  const rows: (string | number | null)[][] = [
    ['Category', 'Heat', 'Estimated start', 'Actual start', 'Entry', 'Swim', 'Bike', 'Run', 'Scratched'],
  ];

  for (const cat of categories) {
    for (const heat of cat.heats) {
      for (const entry of heat.entries) {
        const member = (leg: string) => entry.members.find((m) => m.leg === leg)?.name ?? '';
        rows.push([
          cat.nameEn,
          heat.name,
          heat.estimatedStart ? formatClock(heat.estimatedStart, 'en') : '',
          heat.startTime ? formatClock(heat.startTime, 'en') : '',
          entry.name,
          cat.type === 'TEAM' ? member('SWIM') : '',
          cat.type === 'TEAM' ? member('BIKE') : '',
          cat.type === 'TEAM' ? member('RUN') : '',
          entry.scratched ? 'Y' : '',
        ]);
      }
    }
  }

  return csvResponse('heats.csv', toCsv(rows));
}
