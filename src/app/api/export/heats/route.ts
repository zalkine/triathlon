import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { racingCategories } from '@/lib/categories';
import { toCsv, csvResponse } from '@/lib/csv';
import { formatClock } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('ADMIN');
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  // Export by racing field: merged age brackets are one race, so their heats
  // appear once under the merged name rather than split across two blocks.
  const fields = await racingCategories();
  const heatRows = await prisma.heat.findMany({
    orderBy: [{ estimatedStart: 'asc' }, { createdAt: 'asc' }],
    include: { entries: { orderBy: { createdAt: 'asc' }, include: { members: true } } },
  });
  const categories = fields.map((f) => ({
    ...f,
    heats: heatRows.filter((h) => f.memberIds.includes(h.categoryId)),
  }));

  // Number the combined starts so the sheet shows which heats leave together;
  // an uncombined heat leaves the column blank.
  const waveNumbers = new Map<string, number>();
  for (const cat of categories) {
    for (const heat of cat.heats) {
      if (heat.waveId && !waveNumbers.has(heat.waveId)) waveNumbers.set(heat.waveId, waveNumbers.size + 1);
    }
  }

  const rows: (string | number | null)[][] = [
    ['Category', 'Heat', 'Combined start', 'Estimated start', 'Actual start', 'Entry', 'Swim', 'Bike', 'Run', 'Scratched'],
  ];

  for (const cat of categories) {
    for (const heat of cat.heats) {
      for (const entry of heat.entries) {
        const member = (leg: string) => entry.members.find((m) => m.leg === leg)?.name ?? '';
        rows.push([
          cat.nameEn,
          heat.name,
          heat.waveId ? `Combined ${waveNumbers.get(heat.waveId)}` : '',
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
