'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { signSession, setSessionCookie, clearSessionCookie, getSession } from '@/lib/auth';
import type { Role } from '@/lib/constants';

export async function loginAction(
  locale: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  if (!username || !password) return { error: 'invalid' };

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return { error: 'invalid' };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: 'invalid' };

  const token = await signSession({ sub: user.id, username: user.username, role: user.role as Role });
  await setSessionCookie(token);

  redirect(`/${locale}/staff/${user.role === 'ADMIN' ? 'manage' : 'stations'}`);
}

export async function logoutAction(locale: string) {
  await clearSessionCookie();
  redirect(`/${locale}/login`);
}

export async function getCurrentSession() {
  return getSession();
}
