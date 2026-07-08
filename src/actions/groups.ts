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

// Admin: create a new empty group in a category (all legs open, to be filled).
export async function createEmptyGroup(categoryId: string): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.type !== 'TEAM') return { error: 'invalid' };
  await prisma.group.create({ data: { categoryId } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
