import { NextResponse } from 'next/server';
import { getCategoryResults } from '@/lib/ranking';
import { resultsPubliclyVisible } from '@/lib/season';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { racingCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;

  // Staff always see results; the public sees them only once the admin has both
  // approved the timekeepers' results and made them visible (rankings are
  // sensitive while timing is provisional).
  const [settings, session] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: 'singleton' } }),
    getSession(),
  ]);
  const publiclyVisible = resultsPubliclyVisible(settings);
  if (!publiclyVisible && !session) {
    return NextResponse.json({ hidden: true, entries: [] });
  }

  const result = await getCategoryResults(categoryId);
  if (!result) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  // A merged field is ranked and named as one, so report the merged name rather
  // than the leading bracket's.
  const fields = await racingCategories();
  const field = fields.find((f) => f.id === result.category.id);

  return NextResponse.json({
    category: {
      id: result.category.id,
      nameEn: field?.nameEn ?? result.category.nameEn,
      nameHe: field?.nameHe ?? result.category.nameHe,
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
