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
 * from then on they are packed into shared heats and ranked as one field.
 *
 * Refused once anything has been timed: a merge repacks the heats and rewrites
 * the rankings, which is not something to do to a race already under way.
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

  // The absorbed brackets stop holding heats of their own — their competitors
  // are repacked into the primary's heats by the next schedule generation. Safe
  // to clear: nothing here has been timed (checked above), so no result is lost.
  await prisma.$transaction([
    prisma.heat.deleteMany({ where: { categoryId: { in: absorbed.map((c) => c.id) } } }),
    prisma.registrant.updateMany({ where: { categoryId: { in: memberIds } }, data: { entryId: null } }),
    prisma.group.updateMany({ where: { categoryId: { in: memberIds } }, data: { entryId: null } }),
    prisma.heat.deleteMany({ where: { categoryId: primary.id } }),
    prisma.category.updateMany({ where: { id: { in: absorbed.map((c) => c.id) } }, data: { mergedIntoId: primary.id } }),
    prisma.category.update({ where: { id: primary.id }, data: { mergedIntoId: null } }),
  ]);

  revalidatePath('/', 'layout');
  return { ok: true as const, primaryId: primary.id, categoryCount: ordered.length };
}

/**
 * Split a merged category back into its separate age brackets, each racing and
 * ranked on its own again. Everyone keeps the bracket they registered in, so
 * nothing has to be re-entered — but the shared heats are cleared, so the admin
 * re-runs the schedule to rebuild them per bracket.
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

  await prisma.$transaction([
    prisma.heat.deleteMany({ where: { categoryId: { in: memberIds } } }),
    prisma.registrant.updateMany({ where: { categoryId: { in: memberIds } }, data: { entryId: null } }),
    prisma.group.updateMany({ where: { categoryId: { in: memberIds } }, data: { entryId: null } }),
    prisma.category.updateMany({ where: { id: { in: absorbed.map((c) => c.id) } }, data: { mergedIntoId: null } }),
  ]);

  revalidatePath('/', 'layout');
  return { ok: true as const, categoryCount: memberIds.length };
}
