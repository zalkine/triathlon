'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import type { Role } from '@/lib/constants';

export async function createUser(
  locale: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('ADMIN');

  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || '') as Role;

  if (!username || password.length < 4 || (role !== 'ADMIN' && role !== 'TIMEKEEPER')) {
    return { error: 'invalid' };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: 'taken' };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, passwordHash, role } });
  revalidatePath(`/${locale}/staff/users`);
  return {};
}

export async function deleteUser(locale: string, userId: string): Promise<{ error?: string }> {
  const session = await requireRole('ADMIN');
  if (session.sub === userId) return { error: 'self' };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (target?.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) return { error: 'last-admin' };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath(`/${locale}/staff/users`);
  return {};
}
