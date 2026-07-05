import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const heats = await prisma.heat.findMany({
    where: { startTime: null },
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    heats: heats.map((h) => ({
      id: h.id,
      name: h.name,
      categoryNameEn: h.category.nameEn,
      categoryNameHe: h.category.nameHe,
    })),
  });
}
