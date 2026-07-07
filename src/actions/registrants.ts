'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export type RegisterState = { error?: string; success?: boolean };

export async function registerAction(
  locale: string,
  _prevState: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.registrationOpen) return { error: 'closed' };

  const name = String(formData.get('name') || '').trim();
  const age = Number(formData.get('age'));
  const categoryKey = String(formData.get('categoryKey') || '');

  if (!name || !Number.isInteger(age) || age < 8 || age > 110) return { error: 'invalid' };

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return { error: 'invalid' };

  // Enforce age eligibility: registration opens at 8. Young members (8–12) may
  // enter pro, intermediate, or their own kids bracket; over-12 may only enter
  // pro or intermediate.
  const kidBracket = age < 9 ? 'KIDS_6_9' : 'KIDS_9_12';
  const allowedBrackets = age <= 12 ? [kidBracket, 'PRO', 'INTER'] : ['PRO', 'INTER'];
  const allowedKeys = allowedBrackets.map((b) => `${b}_${category.type}`);
  if (!allowedKeys.includes(category.key)) return { error: 'invalid' };

  // Solo competitor: one registrant, done.
  if (category.type === 'SINGLE') {
    await prisma.registrant.create({
      data: { name, age, categoryId: category.id, mode: 'SINGLE' },
    });
    revalidatePath('/', 'layout');
    return { success: true };
  }

  // TEAM category: either "available" (pool) or "has group" (captain forms a group now).
  const groupChoice = String(formData.get('groupChoice') || 'AVAILABLE');

  if (groupChoice === 'AVAILABLE') {
    const legSwim = formData.get('legSwim') === 'on';
    const legBike = formData.get('legBike') === 'on';
    const legRun = formData.get('legRun') === 'on';
    if (!legSwim && !legBike && !legRun) return { error: 'no-leg' };

    await prisma.registrant.create({
      data: {
        name,
        age,
        categoryId: category.id,
        mode: 'TEAM',
        groupPref: 'AVAILABLE',
        legSwim,
        legBike,
        legRun,
      },
    });
    revalidatePath('/', 'layout');
    return { success: true };
  }

  // groupChoice === 'HAS_GROUP': either JOIN an open group a teammate already
  // started, or CREATE a (possibly still-open) group and take a leg in it.
  const groupMode = String(formData.get('groupMode') || 'CREATE');

  if (groupMode === 'JOIN') {
    const joinGroupId = String(formData.get('joinGroupId') || '');
    const joinLeg = String(formData.get('joinLeg') || '');
    const legField = { SWIM: 'swimRegistrantId', BIKE: 'bikeRegistrantId', RUN: 'runRegistrantId' }[joinLeg];
    if (!joinGroupId || !legField) return { error: 'join-leg' };

    const group = await prisma.group.findUnique({ where: { id: joinGroupId } });
    if (!group || group.categoryId !== category.id) return { error: 'invalid' };
    // The chosen leg must still be open right now.
    if ((group as Record<string, unknown>)[legField] != null) return { error: 'join-taken' };

    const joiner = await prisma.registrant.create({
      data: { name, age, categoryId: category.id, mode: 'TEAM', groupPref: 'HAS_GROUP' },
    });
    // Fill the leg only if it's still open (guards against two people grabbing
    // the same leg at once); count===0 means someone beat us to it.
    const filled = await prisma.group.updateMany({
      where: { id: group.id, [legField]: null },
      data: { [legField]: joiner.id },
    });
    if (filled.count === 0) {
      await prisma.registrant.delete({ where: { id: joiner.id } });
      return { error: 'join-taken' };
    }
    revalidatePath('/', 'layout');
    return { success: true };
  }

  // groupMode === 'CREATE': captain assigns the three roles. Each role is
  // "CAPTAIN", a picked teammate id, or "LATER" (an open leg filled later).
  let teammateIds: string[] = [];
  try {
    teammateIds = JSON.parse(String(formData.get('teammateIds') || '[]'));
  } catch {
    return { error: 'invalid' };
  }
  teammateIds = [...new Set(teammateIds.filter((id) => typeof id === 'string'))].slice(0, 2);

  const roleSwim = String(formData.get('roleSwim') || '');
  const roleBike = String(formData.get('roleBike') || '');
  const roleRun = String(formData.get('roleRun') || '');
  // Every leg must be explicitly set to a person or to "will be added later".
  if (!roleSwim || !roleBike || !roleRun) return { error: 'roles-incomplete' };
  // The captain registers themselves, so they must take at least one leg.
  if (![roleSwim, roleBike, roleRun].includes('CAPTAIN')) return { error: 'captain-role' };

  // Validate teammates are real, same category, and available (pickable, multi-group ok).
  const teammates = teammateIds.length
    ? await prisma.registrant.findMany({ where: { id: { in: teammateIds } } })
    : [];
  if (
    teammates.length !== teammateIds.length ||
    teammates.some((t) => t.categoryId !== category.id || t.groupPref !== 'AVAILABLE')
  ) {
    return { error: 'bad-teammate' };
  }

  // Create the captain, then resolve role ids (CAPTAIN -> captain.id, LATER -> null).
  const captain = await prisma.registrant.create({
    data: { name, age, categoryId: category.id, mode: 'TEAM', groupPref: 'HAS_GROUP' },
  });

  const memberIds = new Set([captain.id, ...teammateIds]);
  const resolve = (v: string): string | null => (v === 'LATER' ? null : v === 'CAPTAIN' ? captain.id : v);
  const swimId = resolve(roleSwim);
  const bikeId = resolve(roleBike);
  const runId = resolve(roleRun);

  // Every filled role must map to a group member, no one may hold all three
  // legs, and every picked teammate must hold a role.
  const filledIds = [swimId, bikeId, runId].filter((id): id is string => id != null);
  const everyRoleIsMember = filledIds.every((id) => memberIds.has(id));
  const nobodyDoesAllThree = new Set(filledIds).size >= (filledIds.length === 3 ? 2 : 1);
  const everyTeammateUsed = teammateIds.every((id) => filledIds.includes(id));
  if (!everyRoleIsMember || !nobodyDoesAllThree || !everyTeammateUsed) {
    // Roll back the captain we just created so a bad submit doesn't leave a stray.
    await prisma.registrant.delete({ where: { id: captain.id } });
    return { error: 'roles-invalid' };
  }

  await prisma.group.create({
    data: {
      categoryId: category.id,
      swimRegistrantId: swimId,
      bikeRegistrantId: bikeId,
      runRegistrantId: runId,
    },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

// Timekeeper/admin: mark a registrant as arrived at the gathering area.
export async function checkInRegistrant(registrantId: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  await prisma.registrant.update({
    where: { id: registrantId },
    data: { checkedIn: true, checkedInAt: new Date() },
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

export async function undoCheckIn(registrantId: string) {
  const session = await requireSession();
  if (session.role !== 'ADMIN' && session.role !== 'TIMEKEEPER') throw new Error('FORBIDDEN');

  await prisma.registrant.update({
    where: { id: registrantId },
    data: { checkedIn: false, checkedInAt: null },
  });
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
