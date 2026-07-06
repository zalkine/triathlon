'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

const FIRST = [
  'נועה', 'איתי', 'יעל', 'דניאל', 'מאיה', 'עומר', 'שירה', 'יונתן', 'טל', 'רוני',
  'ליאור', 'אורי', 'גיל', 'עדן', 'אלון', 'מור', 'שחר', 'נגה', 'איל', 'הדר',
  'עידו', 'רותם', 'אמיר', 'ליהי', 'גל', 'תמר', 'איתמר', 'אביב', 'נוי', 'ארז',
];
const LAST = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'אזולאי', 'חדד',
  'שרון', 'גבאי', 'אוחיון', 'ברק', 'סגל', 'רון', 'נחום', 'אשכנזי', 'בן דוד', 'מלכה',
];

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function ageFor(key: string): number {
  if (key.startsWith('KIDS_6_9')) return randInt(6, 8);
  if (key.startsWith('KIDS_9_12')) return randInt(9, 12);
  return randInt(18, 55);
}

// Adds `count` random competitors spread across all categories. TEAM entrants
// are created as "available to join a group" with random willing legs.
export async function generateTestCompetitors(locale: string, count = 100) {
  await requireRole('ADMIN');
  const categories = await prisma.category.findMany();
  if (categories.length === 0) return { ok: false as const };

  const data = Array.from({ length: count }, () => {
    const cat = pick(categories);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const age = ageFor(cat.key);
    if (cat.type === 'SINGLE') {
      return { name, age, categoryId: cat.id, mode: 'SINGLE' as const };
    }
    // pick 1-3 willing legs, at least one
    const legs = { legSwim: Math.random() < 0.6, legBike: Math.random() < 0.6, legRun: Math.random() < 0.6 };
    if (!legs.legSwim && !legs.legBike && !legs.legRun) legs.legSwim = true;
    return { name, age, categoryId: cat.id, mode: 'TEAM' as const, groupPref: 'AVAILABLE', ...legs };
  });

  await prisma.registrant.createMany({ data });
  revalidatePath('/', 'layout');
  return { ok: true as const, count };
}

// Wipes all competition data (registrants, groups, heats, entries) but keeps
// categories, staff accounts, and resets the event flags. For clearing test
// data before opening real registration.
export async function resetCompetitionData(locale: string) {
  await requireRole('ADMIN');
  await prisma.$transaction([
    prisma.registrant.deleteMany(),
    prisma.member.deleteMany(),
    prisma.entry.deleteMany(),
    prisma.heat.deleteMany(),
    prisma.group.deleteMany(),
  ]);
  await prisma.eventSettings.update({
    where: { id: 'singleton' },
    data: { competitionActive: false, scheduleGeneratedAt: null, raceStartTime: null },
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
