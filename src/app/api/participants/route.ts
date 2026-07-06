import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { registrants: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameHe: c.nameHe,
      type: c.type,
      competitors: c.registrants.map((r) => ({
        id: r.id,
        name: r.name,
        age: r.age,
        mode: r.mode,
        legSwim: r.legSwim,
        legBike: r.legBike,
        legRun: r.legRun,
        checkedIn: r.checkedIn,
      })),
    })),
  });
}
