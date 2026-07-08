'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// Admin CRUD for the public contact directory (doctor, security, volunteers, …).

export async function createContact(_prevState: unknown, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  await requireRole('ADMIN');
  const role = String(formData.get('role') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  if (!role || !name) return { error: 'invalid' };
  const count = await prisma.contact.count();
  await prisma.contact.create({ data: { role, name, phone, sortOrder: count } });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateContact(
  contactId: string,
  formData: FormData
): Promise<{ error?: string; ok?: true }> {
  await requireRole('ADMIN');
  const role = String(formData.get('role') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  if (!role || !name) return { error: 'invalid' };
  await prisma.contact.update({ where: { id: contactId }, data: { role, name, phone } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteContact(contactId: string, _formData: FormData) {
  await requireRole('ADMIN');
  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath('/', 'layout');
}
