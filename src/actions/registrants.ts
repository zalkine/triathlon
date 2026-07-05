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
  const legSwim = formData.get('legSwim') === 'on';
  const legBike = formData.get('legBike') === 'on';
  const legRun = formData.get('legRun') === 'on';

  if (!name || !Number.isInteger(age) || age < 3 || age > 110) return { error: 'invalid' };

  const category = await prisma.category.findUnique({ where: { key: categoryKey } });
  if (!category) return { error: 'invalid' };

  if (category.type === 'TEAM' && !legSwim && !legBike && !legRun) {
    return { error: 'no-leg' };
  }

  await prisma.registrant.create({
    data: {
      name,
      age,
      categoryId: category.id,
      mode: category.type,
      legSwim: category.type === 'TEAM' ? legSwim : false,
      legBike: category.type === 'TEAM' ? legBike : false,
      legRun: category.type === 'TEAM' ? legRun : false,
    },
  });

  revalidatePath(`/${locale}/staff/checkin`);
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
