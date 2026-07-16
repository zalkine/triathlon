'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// Test competitors are always seeded with these three named entrants so a
// known set of names is present in every batch.
const REQUIRED_NAMES = ['מתי מתיתיהו', 'מתניה מתניהו', 'מתנשאל מתיסיהו'];

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function ageFor(key: string): number {
  if (key.startsWith('KIDS_6_9')) return randInt(6, 8);
  if (key.startsWith('KIDS_9_12')) return randInt(9, 12);
  return randInt(18, 55);
}

// Builds the pool of individual competitor names to draw test entrants from,
// taken from the Hall of Fame (previous years' competitors). Team rows expose
// their roster via `members`; individual rows carry a single person in `name`.
// Falls back to REQUIRED_NAMES if the Hall of Fame is empty.
async function hofNamePool(): Promise<string[]> {
  const rows = await prisma.historicalResult.findMany({ select: { name: true, members: true } });
  const names = new Set<string>();
  for (const r of rows) {
    const people = r.members.length > 0 ? r.members : r.name.split(',');
    for (const p of people) {
      const clean = p.trim();
      if (clean) names.add(clean);
    }
  }
  return names.size > 0 ? [...names] : [...REQUIRED_NAMES];
}

// Adds `count` random competitors spread across all categories. TEAM entrants
// are created as "available to join a group" with random willing legs.
export async function generateTestCompetitors(locale: string, count = 100) {
  await requireRole('ADMIN');
  const categories = await prisma.category.findMany();
  if (categories.length === 0) return { ok: false as const };

  const pool = await hofNamePool();
  // The three required names lead the batch; the rest draw random names from
  // the Hall of Fame pool. Total stays at `count`.
  const names = Array.from({ length: count }, (_, i) =>
    i < REQUIRED_NAMES.length ? REQUIRED_NAMES[i] : pick(pool),
  );

  const data = names.map((name) => {
    const cat = pick(categories);
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

// Clears only the race itself — heats, the schedule, and every timing stamp —
// while keeping the registered competitors, their teams, and their check-ins.
// Groups are un-scheduled (entryId cleared) so the schedule can be generated
// and started again. For re-running a competition-start demo without having to
// re-register everyone.
export async function resetResultsAndTiming(locale: string) {
  await requireRole('ADMIN');
  await prisma.$transaction([
    prisma.member.deleteMany(),
    prisma.entry.deleteMany(), // also SET NULLs every registrant.entryId
    prisma.heat.deleteMany(),
    prisma.group.updateMany({ data: { entryId: null } }),
  ]);
  await prisma.eventSettings.update({
    where: { id: 'singleton' },
    data: { competitionActive: false, scheduleGeneratedAt: null, raceStartTime: null },
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
