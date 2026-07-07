import { NextResponse } from 'next/server';
import { getCategoryResults } from '@/lib/ranking';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;

  // Staff always see results; the public sees them only when the admin has made
  // them visible (rankings can be sensitive while timing is provisional).
  const [settings, session] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: 'singleton' } }),
    getSession(),
  ]);
  if (settings && !settings.publicResultsVisible && !session) {
    return NextResponse.json({ hidden: true, entries: [] });
  }

  const result = await getCategoryResults(categoryId);
  if (!result) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  return NextResponse.json({
    category: {
      id: result.category.id,
      nameEn: result.category.nameEn,
      nameHe: result.category.nameHe,
    },
    entries: result.ranked.map((e) => ({
      id: e.id,
      name: e.name,
      heatName: e.heatName,
      startTime: e.startTime?.toISOString() ?? null,
      runTime: e.runTime?.toISOString() ?? null,
      totalMs: e.totalMs,
      status: e.status,
      rank: e.rank,
    })),
  });
}
