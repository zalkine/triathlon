'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';

export type RegisterState = { error?: string; success?: boolean };

export async function registerAction(
  locale: string,
  _prevState: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.registrationOpen) return { error: 'closed' };

  const name = String(formData.get('name') || '').trim();
  const categoryKey = String(formData.get('categoryKey') || '');

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return { error: 'invalid' };

  // Validate the single registrant name (solo entry or "available" pool member).
  // A full group has no single name — its three leg names are validated below.
  async function checkName(): Promise<RegisterState | null> {
    if (!name) return { error: 'invalid' };
    if (!/^[\p{L}\s\-']+$/u.test(name)) return { error: 'name-letters-only' };
    const dup = await prisma.registrant.findFirst({ where: { name, categoryId: category!.id } });
    if (dup) return { error: 'duplicate' };
    return null;
  }

  // Age is only collected for the children's brackets, where it decides the
  // 6–9 vs 9–12 split. Professional and intermediate registrants have no age
  // requirement, so their age stays null.
  const isKids = category.key.startsWith('KIDS_');
  let age: number | null = null;
  if (isKids) {
    const parsed = Number(formData.get('age'));
    if (!Number.isInteger(parsed) || parsed < 6 || parsed > 12) return { error: 'invalid' };
    age = parsed;
    // The chosen kids bracket must match the age (6–8 → 6-9, 9–12 → 9-12).
    const kidBracket = age < 9 ? 'KIDS_6_9' : 'KIDS_9_12';
    if (category.key !== `${kidBracket}_${category.type}`) return { error: 'invalid' };
  }

  // Solo competitor: one registrant, done.
  if (category.type === 'SINGLE') {
    const nameError = await checkName();
    if (nameError) return nameError;
    await prisma.registrant.create({
      data: { name, age, categoryId: category.id, mode: 'SINGLE' },
    });
    revalidatePath('/', 'layout');
    return { success: true };
  }

  // TEAM category: either "available" (pool) or "has group" (captain forms a group now).
  const groupChoice = String(formData.get('groupChoice') || 'AVAILABLE');

  if (groupChoice === 'AVAILABLE') {
    const nameError = await checkName();
    if (nameError) return nameError;
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

  // groupChoice === 'HAS_GROUP': register an entire relay group by naming the
  // person doing each leg. The same name may be reused across legs (one person
  // doing two or three legs); there is no distinctness requirement.
  const legNames = {
    SWIM: String(formData.get('swimName') || '').trim(),
    BIKE: String(formData.get('bikeName') || '').trim(),
    RUN: String(formData.get('runName') || '').trim(),
  };
  // All three legs must be named.
  if (!legNames.SWIM || !legNames.BIKE || !legNames.RUN) return { error: 'roles-incomplete' };
  for (const n of Object.values(legNames)) {
    if (!/^[\p{L}\s\-']+$/u.test(n)) return { error: 'name-letters-only' };
  }

  // One registrant per distinct name; a name repeated across legs is the same
  // person and reuses the row it already created. Track the rows we make so a
  // later DB error can't leave stray registrants behind.
  const byName = new Map<string, string>();
  const createdIds: string[] = [];
  try {
    const resolved: Record<'SWIM' | 'BIKE' | 'RUN', string> = { SWIM: '', BIKE: '', RUN: '' };
    for (const leg of ['SWIM', 'BIKE', 'RUN'] as const) {
      const memberName = legNames[leg];
      let id = byName.get(memberName);
      if (!id) {
        const member = await prisma.registrant.create({
          data: { name: memberName, age: null, categoryId: category.id, mode: 'TEAM', groupPref: 'HAS_GROUP' },
        });
        id = member.id;
        byName.set(memberName, id);
        createdIds.push(id);
      }
      resolved[leg] = id;
    }

    await prisma.group.create({
      data: {
        categoryId: category.id,
        swimRegistrantId: resolved.SWIM,
        bikeRegistrantId: resolved.BIKE,
        runRegistrantId: resolved.RUN,
      },
    });
  } catch (err) {
    await prisma.registrant.deleteMany({ where: { id: { in: createdIds } } });
    throw err;
  }

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

// Admin: remove a registrant and unlink them from any groups / timing members.
export async function deleteRegistrant(registrantId: string, _formData: FormData) {
  await requireRole('ADMIN');
  await Promise.all([
    prisma.group.updateMany({ where: { swimRegistrantId: registrantId }, data: { swimRegistrantId: null } }),
    prisma.group.updateMany({ where: { bikeRegistrantId: registrantId }, data: { bikeRegistrantId: null } }),
    prisma.group.updateMany({ where: { runRegistrantId: registrantId }, data: { runRegistrantId: null } }),
  ]);
  await prisma.member.updateMany({ where: { registrantId }, data: { registrantId: null } });
  await prisma.registrant.delete({ where: { id: registrantId } });
  revalidatePath('/', 'layout');
}

// Admin: correct a registrant's name.
export async function updateRegistrantName(
  registrantId: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const name = String(formData.get('name') || '').trim();
  if (!name) return { error: 'empty' };
  if (!/^[\p{L}\s\-']+$/u.test(name)) return { error: 'name-letters-only' };
  await prisma.registrant.update({ where: { id: registrantId }, data: { name } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: move a registrant to a different category (unlinks them from groups in the old category).
export async function updateRegistrantCategory(
  registrantId: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const categoryKey = String(formData.get('categoryKey') || '');
  const [category, registrant] = await Promise.all([
    prisma.category.findUnique({ where: { key: categoryKey } }),
    prisma.registrant.findUnique({ where: { id: registrantId } }),
  ]);
  if (!category || !registrant) return { error: 'invalid' };
  if (registrant.categoryId !== category.id) {
    await Promise.all([
      prisma.group.updateMany({ where: { categoryId: registrant.categoryId, swimRegistrantId: registrantId }, data: { swimRegistrantId: null } }),
      prisma.group.updateMany({ where: { categoryId: registrant.categoryId, bikeRegistrantId: registrantId }, data: { bikeRegistrantId: null } }),
      prisma.group.updateMany({ where: { categoryId: registrant.categoryId, runRegistrantId: registrantId }, data: { runRegistrantId: null } }),
    ]);
    await prisma.registrant.update({ where: { id: registrantId }, data: { categoryId: category.id, entryId: null } });
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: edit a registrant's name and category in one go (used by the single
// "Edit" control in the management roster). Moving category unlinks them from
// any group in the old category, matching updateRegistrantCategory.
export async function updateRegistrant(
  registrantId: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const name = String(formData.get('name') || '').trim();
  const categoryKey = String(formData.get('categoryKey') || '');
  if (!name) return { error: 'empty' };
  if (!/^[\p{L}\s\-']+$/u.test(name)) return { error: 'name-letters-only' };

  const [category, registrant] = await Promise.all([
    prisma.category.findUnique({ where: { key: categoryKey } }),
    prisma.registrant.findUnique({ where: { id: registrantId } }),
  ]);
  if (!category || !registrant) return { error: 'invalid' };

  const changingCategory = registrant.categoryId !== category.id;
  if (changingCategory) {
    await Promise.all([
      prisma.group.updateMany({ where: { categoryId: registrant.categoryId, swimRegistrantId: registrantId }, data: { swimRegistrantId: null } }),
      prisma.group.updateMany({ where: { categoryId: registrant.categoryId, bikeRegistrantId: registrantId }, data: { bikeRegistrantId: null } }),
      prisma.group.updateMany({ where: { categoryId: registrant.categoryId, runRegistrantId: registrantId }, data: { runRegistrantId: null } }),
    ]);
  }
  await prisma.registrant.update({
    where: { id: registrantId },
    data: { name, categoryId: category.id, ...(changingCategory ? { entryId: null } : {}) },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Admin: register a competitor even when public registration is closed.
export async function adminAddRegistrant(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await requireRole('ADMIN');
  const name = String(formData.get('name') || '').trim();
  const categoryKey = String(formData.get('categoryKey') || '');
  if (!name) return { error: 'invalid' };
  if (!/^[\p{L}\s\-']+$/u.test(name)) return { error: 'name-letters-only' };
  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return { error: 'invalid' };
  // The admin can knowingly override the duplicate-name guard (two real people
  // with the same name, or intentionally adding a second entry for someone).
  const allowDuplicate = formData.get('allowDuplicate') === 'on';
  const dup = await prisma.registrant.findFirst({ where: { name, categoryId: category.id } });
  if (dup && !allowDuplicate) return { error: 'duplicate' };
  const isKids = category.key.startsWith('KIDS_');
  let age: number | null = null;
  if (isKids) {
    const parsed = Number(formData.get('age'));
    if (!Number.isInteger(parsed) || parsed < 6 || parsed > 12) return { error: 'invalid' };
    age = parsed;
    const kidBracket = age < 9 ? 'KIDS_6_9' : 'KIDS_9_12';
    if (category.key !== `${kidBracket}_${category.type}`) return { error: 'invalid' };
  }
  if (category.type === 'SINGLE') {
    await prisma.registrant.create({ data: { name, age, categoryId: category.id, mode: 'SINGLE' } });
  } else {
    const legSwim = formData.get('legSwim') === 'on';
    const legBike = formData.get('legBike') === 'on';
    const legRun = formData.get('legRun') === 'on';
    if (!legSwim && !legBike && !legRun) return { error: 'no-leg' };
    await prisma.registrant.create({
      data: { name, age, categoryId: category.id, mode: 'TEAM', groupPref: 'AVAILABLE', legSwim, legBike, legRun },
    });
  }
  revalidatePath('/', 'layout');
  return { success: true };
}
