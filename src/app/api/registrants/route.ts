import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { REGISTRATION_ONLY_CATEGORY_KEYS } from '@/lib/constants';
import { racingCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Powers the check-in station. Registration-only categories (the toddlers fun
  // run) don't take part in race day, so they never appear here.
  const [registrants, fields] = await Promise.all([
    prisma.registrant.findMany({
      where: { category: { key: { notIn: [...REGISTRATION_ONLY_CATEGORY_KEYS] } } },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    }),
    racingCategories(),
  ]);

  // Show the race each person is actually in. Age brackets an admin merged race
  // as one category, so check-in names that one rather than the bracket on the
  // registration form (their age is listed beside it either way).
  const fieldName = new Map<string, { nameEn: string; nameHe: string }>();
  for (const f of fields) for (const id of f.memberIds) fieldName.set(id, { nameEn: f.nameEn, nameHe: f.nameHe });

  return NextResponse.json({
    registrants: registrants.map((r) => ({
      id: r.id,
      name: r.name,
      age: r.age,
      mode: r.mode,
      categoryNameEn: fieldName.get(r.categoryId)?.nameEn ?? r.category.nameEn,
      categoryNameHe: fieldName.get(r.categoryId)?.nameHe ?? r.category.nameHe,
      checkedIn: r.checkedIn,
      hasEntry: !!r.entryId,
    })),
  });
}
