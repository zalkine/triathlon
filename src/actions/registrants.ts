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

  if (!name) return { error: 'invalid' };
  if (!/^[\p{L}\s\-']+$/u.test(name)) return { error: 'name-letters-only' };

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return { error: 'invalid' };

  const dupRegistrant = await prisma.registrant.findFirst({ where: { name, categoryId: category.id } });
  if (dupRegistrant) return { error: 'duplicate' };

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

  // groupMode === 'CREATE': the captain assigns all three legs at once. Each leg
  // is one of:
  //   "CAPTAIN"     - the captain does this leg themselves
  //   "LATER"       - an open leg, to be filled when a teammate registers
  //   "NEW"         - a teammate the captain names now (registered on the spot),
  //                   with the name in role{Swim,Bike,Run}Name
  //   "<id>"        - an existing "available" registrant picked from the pool
  const legInputs = (['SWIM', 'BIKE', 'RUN'] as const).map((leg) => {
    const key = leg === 'SWIM' ? 'roleSwim' : leg === 'BIKE' ? 'roleBike' : 'roleRun';
    return { leg, kind: String(formData.get(key) || ''), name: String(formData.get(`${key}Name`) || '').trim() };
  });

  // Every leg must be explicitly set to a person or to "will be added later".
  if (legInputs.some((l) => !l.kind)) return { error: 'roles-incomplete' };
  // A named teammate must actually have a name typed in.
  if (legInputs.some((l) => l.kind === 'NEW' && !l.name)) return { error: 'roles-incomplete' };
  // The captain registers themselves, so they must take at least one leg.
  if (!legInputs.some((l) => l.kind === 'CAPTAIN')) return { error: 'captain-role' };
  // No single person may hold all three legs (CAPTAIN or the same pool teammate
  // picked for every leg). Named ("NEW") teammates are always distinct people.
  const kinds = legInputs.map((l) => l.kind);
  if (kinds[0] === kinds[1] && kinds[1] === kinds[2] && kinds[0] !== 'NEW') return { error: 'roles-invalid' };

  // Validate any picked-from-pool teammates are real, same category, and available.
  const poolIds = [...new Set(kinds.filter((k) => !['CAPTAIN', 'LATER', 'NEW'].includes(k)))];
  const teammates = poolIds.length
    ? await prisma.registrant.findMany({ where: { id: { in: poolIds } } })
    : [];
  if (
    teammates.length !== poolIds.length ||
    teammates.some((t) => t.categoryId !== category.id || t.groupPref !== 'AVAILABLE')
  ) {
    return { error: 'bad-teammate' };
  }

  // Rule 1: NEW teammate names must contain only letters.
  for (const l of legInputs) {
    if (l.kind === 'NEW' && !/^[\p{L}\s\-']+$/u.test(l.name)) return { error: 'name-letters-only' };
  }
  // Rule 3: NEW teammate names cannot already exist in this category.
  for (const l of legInputs) {
    if (l.kind === 'NEW') {
      const dup = await prisma.registrant.findFirst({ where: { name: l.name, categoryId: category.id } });
      if (dup) return { error: 'duplicate' };
    }
  }
  // Rule 2: a pool teammate cannot already be in a group doing the same leg in this category.
  const legFieldMap = { SWIM: 'swimRegistrantId', BIKE: 'bikeRegistrantId', RUN: 'runRegistrantId' } as const;
  for (const l of legInputs) {
    if (!['CAPTAIN', 'LATER', 'NEW'].includes(l.kind)) {
      const legField = legFieldMap[l.leg];
      const conflict = await prisma.group.findFirst({ where: { categoryId: category.id, [legField]: l.kind } });
      if (conflict) return { error: 'leg-conflict' };
    }
  }

  // Create the captain, then any named teammates. Track the rows we make so a
  // later DB error can't leave stray registrants behind.
  const captain = await prisma.registrant.create({
    data: { name, age, categoryId: category.id, mode: 'TEAM', groupPref: 'HAS_GROUP' },
  });
  const createdIds = [captain.id];

  try {
    const resolved: Record<'SWIM' | 'BIKE' | 'RUN', string | null> = { SWIM: null, BIKE: null, RUN: null };
    for (const l of legInputs) {
      if (l.kind === 'LATER') resolved[l.leg] = null;
      else if (l.kind === 'CAPTAIN') resolved[l.leg] = captain.id;
      else if (l.kind === 'NEW') {
        const mate = await prisma.registrant.create({
          data: { name: l.name, age: null, categoryId: category.id, mode: 'TEAM', groupPref: 'HAS_GROUP' },
        });
        createdIds.push(mate.id);
        resolved[l.leg] = mate.id;
      } else resolved[l.leg] = l.kind; // a validated pool id
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
  const dup = await prisma.registrant.findFirst({ where: { name, categoryId: category.id } });
  if (dup) return { error: 'duplicate' };
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
