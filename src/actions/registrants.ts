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

  if (!name || !Number.isInteger(age) || age < 3 || age > 110) return { error: 'invalid' };

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return { error: 'invalid' };

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

  // groupChoice === 'HAS_GROUP': captain picks available teammates and assigns the three roles.
  let teammateIds: string[] = [];
  try {
    teammateIds = JSON.parse(String(formData.get('teammateIds') || '[]'));
  } catch {
    return { error: 'invalid' };
  }
  teammateIds = [...new Set(teammateIds.filter((id) => typeof id === 'string'))].slice(0, 2);

  // Role assignment: each role is "CAPTAIN" or a teammate id.
  const roleSwim = String(formData.get('roleSwim') || '');
  const roleBike = String(formData.get('roleBike') || '');
  const roleRun = String(formData.get('roleRun') || '');
  if (!roleSwim || !roleBike || !roleRun) return { error: 'roles-incomplete' };

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

  // Create the captain, then resolve role ids (CAPTAIN -> captain.id).
  const captain = await prisma.registrant.create({
    data: { name, age, categoryId: category.id, mode: 'TEAM', groupPref: 'HAS_GROUP' },
  });

  const memberIds = new Set([captain.id, ...teammateIds]);
  const resolve = (v: string) => (v === 'CAPTAIN' ? captain.id : v);
  const swimId = resolve(roleSwim);
  const bikeId = resolve(roleBike);
  const runId = resolve(roleRun);

  // Every role must map to a group member, at least two distinct people must be
  // used (nobody does all three), and every picked teammate must hold a role.
  const usedIds = [swimId, bikeId, runId];
  const distinct = new Set(usedIds);
  const everyRoleIsMember = usedIds.every((id) => memberIds.has(id));
  const everyTeammateUsed = teammateIds.every((id) => distinct.has(id));
  if (!everyRoleIsMember || distinct.size < 2 || !everyTeammateUsed) {
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
