'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { canMergeCategories, mergeFamilyOf } from '@/lib/constants';

// Merging age brackets into one racing category. Admin-only throughout: this
// decides who competes against whom, so it is never a timekeeper's call.
//
// A merge is deliberately narrow. Only categories of the same merge family may
// be joined — the same race differing by age bracket alone (children's singles
// with children's singles, children's relays with children's relays). It is not
// a way to fold a relay into a singles race, or to rank a child against an
// adult; those refuse. Nothing about registration changes: a 7-year-old is still
// filed under 6-9, so a merge is undone by clearing one field.

/**
 * Race two or more age brackets as a single category. The lowest bracket in race
 * order keeps the racing (it becomes the "primary") and the others point at it;
 * from then on they are one field, ranked in a single list.
 *
 * Existing heats are kept, so an admin who builds the running order by hand
 * keeps it. Refused once anything has been timed: merging rewrites the rankings,
 * which is not something to do to a race already under way.
 */
export async function mergeCategories(categoryIds: string[]) {
  await requireRole('ADMIN');

  const ids = [...new Set(categoryIds.filter(Boolean))];
  if (ids.length < 2) return { error: 'need-two' as const };

  const categories = await prisma.category.findMany({ where: { id: { in: ids } } });
  if (categories.length !== ids.length) return { error: 'no-category' as const };

  // Pull in anything already merged with one of the chosen brackets, so a merge
  // can be extended without leaving a bracket stranded on its own.
  const related = await prisma.category.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { mergedIntoId: { in: ids } },
        ...categories.filter((c) => c.mergedIntoId).map((c) => ({ id: c.mergedIntoId as string })),
        ...categories.filter((c) => c.mergedIntoId).map((c) => ({ mergedIntoId: c.mergedIntoId as string })),
      ],
    },
  });

  if (!canMergeCategories(related.map((c) => c.key))) {
    return { error: 'not-same-family' as const, family: mergeFamilyOf(categories[0].key) };
  }

  // The bracket that races first leads, so the merged field keeps its place in
  // the running order and its heats stay where the schedule already put them.
  const ordered = [...related].sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = ordered[0];
  const absorbed = ordered.slice(1);

  const memberIds = ordered.map((c) => c.id);
  const timed = await prisma.heat.findFirst({
    where: {
      categoryId: { in: memberIds },
      OR: [
        { startTime: { not: null } },
        { entries: { some: { OR: [{ swimTime: { not: null } }, { bikeTime: { not: null } }, { runTime: { not: null } }] } } },
      ],
    },
  });
  if (timed) return { error: 'already-timed' as const };

  // Merging changes who competes against whom; it is not a rebuild. Every heat
  // that already exists is left exactly as it is, whether the schedule generator
  // packed it or an admin arranged it by hand — losing a hand-built running order
  // here would be unrecoverable. Everything that presents a race (the heats
  // board, the schedule, the start line, results and the exports) reads a heat
  // through the field its category races in, so heats still filed under an
  // absorbed bracket simply appear under the merged field. An admin who does want
  // them repacked into shared heats can run the schedule generator afterwards.
  await prisma.$transaction([
    prisma.category.updateMany({ where: { id: { in: absorbed.map((c) => c.id) } }, data: { mergedIntoId: primary.id } }),
    prisma.category.update({ where: { id: primary.id }, data: { mergedIntoId: null } }),
  ]);

  // Both brackets numbered their heats from 1, so the merged field would show
  // two "Heat 1"s. Renumber in race order — auto-generated names only, so a heat
  // an admin named themselves keeps its name.
  await renumberAutoNamedHeats(memberIds);

  revalidatePath('/', 'layout');
  return { ok: true as const, primaryId: primary.id, categoryCount: ordered.length };
}

const AUTO_HEAT_NAME = /^Heat\s+\d+$/i;

/**
 * Renumbers "Heat N" heats across a set of categories so they read 1..N in race
 * order. A heat named by hand keeps its name — only the names the app generated
 * are the app's to change.
 */
async function renumberAutoNamedHeats(categoryIds: string[]) {
  const heats = await prisma.heat.findMany({
    where: { categoryId: { in: categoryIds } },
    include: { category: { select: { sortOrder: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const ordered = [...heats].sort(
    (a, b) => a.category.sortOrder - b.category.sortOrder || a.createdAt.getTime() - b.createdAt.getTime()
  );

  let n = 1;
  for (const heat of ordered) {
    if (!AUTO_HEAT_NAME.test(heat.name)) continue;
    const name = `Heat ${n++}`;
    if (name !== heat.name) await prisma.heat.update({ where: { id: heat.id }, data: { name } });
  }
}

/**
 * Split a merged category back into its separate age brackets, each racing and
 * ranked on its own again. Nothing is rebuilt and no heat is deleted: everyone
 * keeps the bracket they registered in, and each heat goes back to being read
 * under its own bracket.
 *
 * One thing to know: a heat ranks whoever is in it under the heat's own bracket.
 * So if, while merged, someone was moved into a heat belonging to the other
 * bracket, splitting leaves them ranked with that bracket — the admin moves them
 * back if that isn't what they want. Refused once anything has been timed.
 */
export async function unmergeCategory(primaryId: string) {
  await requireRole('ADMIN');

  const absorbed = await prisma.category.findMany({ where: { mergedIntoId: primaryId } });
  if (absorbed.length === 0) return { error: 'not-merged' as const };

  const memberIds = [primaryId, ...absorbed.map((c) => c.id)];
  const timed = await prisma.heat.findFirst({
    where: {
      categoryId: { in: memberIds },
      OR: [
        { startTime: { not: null } },
        { entries: { some: { OR: [{ swimTime: { not: null } }, { bikeTime: { not: null } }, { runTime: { not: null } }] } } },
      ],
    },
  });
  if (timed) return { error: 'already-timed' as const };

  await prisma.category.updateMany({
    where: { id: { in: absorbed.map((c) => c.id) } },
    data: { mergedIntoId: null },
  });

  // Each bracket numbers its own heats again.
  for (const id of memberIds) await renumberAutoNamedHeats([id]);

  revalidatePath('/', 'layout');
  return { ok: true as const, categoryCount: memberIds.length };
}
