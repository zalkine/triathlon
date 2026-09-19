'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { racingCategories, racingCategoryId } from '@/lib/categories';
import { checkCapacity } from '@/lib/heats';
import { createGroupEntry, createSoloEntry, isActiveGroup, placeWaitingInField } from '@/lib/placement';

// Putting waiting competitors into heats without running the schedule generator.
//
// The generator packs the whole field at once, which is what an admin wants
// before the event but not after: a relay team that formed once the heats were
// built has to join them without the existing running order being rebuilt. These
// actions only ever add — they never move, rename or delete a heat or an entry
// that is already arranged — so they are safe to use on a board the admin has
// laid out by hand. Admin-only, like the rest of heat arrangement.

/**
 * Place everyone still waiting into heats: spare lanes in the heats that already
 * exist first, then new heats for whoever is left. With no `fieldId` this covers
 * every race; with one, just that field.
 */
export async function placeWaitingCompetitors(fieldId?: string) {
  await requireRole('ADMIN');

  const fields = await racingCategories();
  const targets = fieldId ? fields.filter((f) => f.id === fieldId) : fields;
  if (targets.length === 0) return { error: 'no-category' as const };

  let placed = 0;
  for (const field of targets) {
    placed += await placeWaitingInField(field.id, field.memberIds, field.type);
  }

  revalidatePath('/', 'layout');
  return { ok: true as const, placed };
}

/**
 * Place one waiting relay team or solo competitor into a heat the admin picks.
 * Over the pool's lane count it reports back and the caller confirms, exactly as
 * dragging someone into a full heat does.
 */
export async function placeInHeat(kind: 'GROUP' | 'SOLO', id: string, heatId: string, force = false) {
  await requireRole('ADMIN');

  const heat = await prisma.heat.findUnique({ where: { id: heatId } });
  if (!heat) return { error: 'no-heat' as const };

  const over = await checkCapacity(heatId, 1, force);
  if (over) return over;

  if (kind === 'GROUP') {
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return { error: 'not-found' as const };
    if (group.entryId) return { error: 'already-placed' as const };
    if (!isActiveGroup(group)) return { error: 'empty-group' as const };
    const registrants = await prisma.registrant.findMany({ where: { categoryId: group.categoryId } });
    await createGroupEntry(heatId, group, new Map(registrants.map((r) => [r.id, r.name])));
  } else {
    const registrant = await prisma.registrant.findUnique({ where: { id } });
    if (!registrant) return { error: 'not-found' as const };
    if (registrant.entryId) return { error: 'already-placed' as const };
    await createSoloEntry(heatId, registrant);
  }

  revalidatePath('/', 'layout');
  return { ok: true as const };
}

/**
 * Add a heat to a field on the spot, so the admin can make somewhere to put the
 * waiting competitors before placing them. Named on from the field's last heat.
 */
export async function addHeatToField(fieldId: string) {
  await requireRole('ADMIN');
  const category = await prisma.category.findUnique({
    where: { id: fieldId },
    select: { id: true, mergedIntoId: true },
  });
  if (!category) return { error: 'no-category' as const };

  // A merged bracket's heats belong to the field that races them.
  const categoryId = racingCategoryId(category);
  const siblings = await prisma.category.findMany({
    where: { OR: [{ id: categoryId }, { mergedIntoId: categoryId }] },
    select: { id: true },
  });
  const count = await prisma.heat.count({ where: { categoryId: { in: siblings.map((c) => c.id) } } });
  const heat = await prisma.heat.create({ data: { categoryId, name: `Heat ${count + 1}` } });

  revalidatePath('/', 'layout');
  return { ok: true as const, heatId: heat.id };
}
