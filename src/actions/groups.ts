'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import type { Leg } from '@/lib/constants';

const LEG_FIELD: Record<Leg, 'swimRegistrantId' | 'bikeRegistrantId' | 'runRegistrantId'> = {
  SWIM: 'swimRegistrantId',
  BIKE: 'bikeRegistrantId',
  RUN: 'runRegistrantId',
};

// Admin: delete a self-formed/lottery group. The people in it stay registered
// and simply return to the "available" pool.
export async function deleteGroup(groupId: string, _formData?: FormData) {
  await requireRole('ADMIN');
  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath('/', 'layout');
}

// Admin: clear one leg of a group, opening the slot again. The person who held
// it stays registered and becomes available.
export async function clearGroupLeg(groupId: string, leg: Leg): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  await prisma.group.update({ where: { id: groupId }, data: { [LEG_FIELD[leg]]: null } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: fill an open leg with an existing "available" registrant from the same
// category.
export async function assignGroupLeg(
  groupId: string,
  leg: Leg,
  registrantId: string
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const [group, registrant] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.registrant.findUnique({ where: { id: registrantId } }),
  ]);
  if (!group || !registrant) return { error: 'invalid' };
  if (registrant.categoryId !== group.categoryId) return { error: 'category' };
  await prisma.group.update({ where: { id: groupId }, data: { [LEG_FIELD[leg]]: registrantId } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: register a brand-new teammate on the spot and drop them into an open
// leg of a group.
export async function addNewMemberToGroupLeg(
  groupId: string,
  leg: Leg,
  name: string
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const trimmed = name.trim();
  if (!trimmed) return { error: 'empty' };
  if (!/^[\p{L}\s\-']+$/u.test(trimmed)) return { error: 'name-letters-only' };
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: 'invalid' };
  const dup = await prisma.registrant.findFirst({ where: { name: trimmed, categoryId: group.categoryId } });
  if (dup) return { error: 'duplicate' };
  const mate = await prisma.registrant.create({
    data: { name: trimmed, categoryId: group.categoryId, mode: 'TEAM', groupPref: 'HAS_GROUP' },
  });
  await prisma.group.update({ where: { id: groupId }, data: { [LEG_FIELD[leg]]: mate.id } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin drag-and-drop: assign `registrantId` to a target leg of a group. If the
// registrant was dragged out of another leg (`source`), that leg is cleared. If
// the target leg was already held by someone else, that person is displaced back
// to the unassigned pool (their leg simply becomes null on the group) — a
// replace, not a swap. Their registered legs live on the registrant record and
// are untouched, so they return to the pool with their original leg preferences.
export async function moveGroupMember(
  registrantId: string,
  target: { groupId: string; leg: Leg },
  source: { groupId: string; leg: Leg } | null
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');

  // Dropping onto the exact same cell is a no-op.
  if (source && source.groupId === target.groupId && source.leg === target.leg) return { ok: true };

  const [targetGroup, registrant] = await Promise.all([
    prisma.group.findUnique({ where: { id: target.groupId } }),
    prisma.registrant.findUnique({ where: { id: registrantId } }),
  ]);
  if (!targetGroup || !registrant) return { error: 'invalid' };
  if (registrant.categoryId !== targetGroup.categoryId) return { error: 'category' };

  const targetField = LEG_FIELD[target.leg];

  if (source && source.groupId === target.groupId) {
    // Same group: set the new leg and clear the old one in a single update. Any
    // person who held the target leg drops out of the group (→ unassigned).
    await prisma.group.update({
      where: { id: target.groupId },
      data: { [targetField]: registrantId, [LEG_FIELD[source.leg]]: null },
    });
  } else {
    await prisma.group.update({ where: { id: target.groupId }, data: { [targetField]: registrantId } });
    if (source) {
      const srcGroup = await prisma.group.findUnique({ where: { id: source.groupId } });
      if (srcGroup && srcGroup.categoryId === targetGroup.categoryId) {
        await prisma.group.update({ where: { id: source.groupId }, data: { [LEG_FIELD[source.leg]]: null } });
      }
    }
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: create a new empty group in a category (all legs open, to be filled).
export async function createEmptyGroup(categoryId: string): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.type !== 'TEAM') return { error: 'invalid' };
  await prisma.group.create({ data: { categoryId } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: form a complete group by assigning a registrant to every leg. All
// three legs are required so the runner (and each other leg) is unambiguous at
// the finish line. The same person may fill two legs (e.g. swim + bike) while a
// teammate runs — every leg is still assigned, so the runner stays defined.
export async function createGroupWithLegs(
  categoryId: string,
  legs: { SWIM: string; BIKE: string; RUN: string }
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.type !== 'TEAM') return { error: 'invalid' };
  if (!legs.SWIM || !legs.BIKE || !legs.RUN) return { error: 'incomplete' };

  const uniqueIds = Array.from(new Set([legs.SWIM, legs.BIKE, legs.RUN]));
  const registrants = await prisma.registrant.findMany({ where: { id: { in: uniqueIds } } });
  if (registrants.length !== uniqueIds.length) return { error: 'invalid' };
  if (registrants.some((r) => r.categoryId !== categoryId)) return { error: 'category' };

  await prisma.group.create({
    data: {
      categoryId,
      swimRegistrantId: legs.SWIM,
      bikeRegistrantId: legs.BIKE,
      runRegistrantId: legs.RUN,
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
