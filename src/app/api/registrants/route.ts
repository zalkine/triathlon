import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registrants = await prisma.registrant.findMany({
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    registrants: registrants.map((r) => ({
      id: r.id,
      name: r.name,
      age: r.age,
      mode: r.mode,
      categoryNameEn: r.category.nameEn,
      categoryNameHe: r.category.nameHe,
      checkedIn: r.checkedIn,
      hasEntry: !!r.entryId,
    })),
  });
}
