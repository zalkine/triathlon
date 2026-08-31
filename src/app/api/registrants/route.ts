import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { REGISTRATION_ONLY_CATEGORY_KEYS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Powers the check-in station. Registration-only categories (the toddlers fun
  // run) don't take part in race day, so they never appear here.
  const registrants = await prisma.registrant.findMany({
    where: { category: { key: { notIn: [...REGISTRATION_ONLY_CATEGORY_KEYS] } } },
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
