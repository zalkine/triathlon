import { NextResponse } from 'next/server';
import { getCategoryResults } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
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
