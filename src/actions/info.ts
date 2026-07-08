'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// Admin CRUD for the public "Rules & Trails" info sections.

export async function createInfoSection(): Promise<{ id: string }> {
  await requireRole('ADMIN');
  const count = await prisma.infoSection.count();
  const section = await prisma.infoSection.create({ data: { sortOrder: count } });
  revalidatePath('/', 'layout');
  return { id: section.id };
}

export async function updateInfoSection(
  sectionId: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  await requireRole('ADMIN');
  const titleEn = String(formData.get('titleEn') || '').trim();
  const titleHe = String(formData.get('titleHe') || '').trim();
  const bodyEn = String(formData.get('bodyEn') || '');
  const bodyHe = String(formData.get('bodyHe') || '');
  const imageUrlRaw = String(formData.get('imageUrl') || '').trim();
  const imageUrl = imageUrlRaw || null;
  await prisma.infoSection.update({
    where: { id: sectionId },
    data: { titleEn, titleHe, bodyEn, bodyHe, imageUrl },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteInfoSection(sectionId: string, _formData: FormData) {
  await requireRole('ADMIN');
  await prisma.infoSection.delete({ where: { id: sectionId } });
  revalidatePath('/', 'layout');
}

// Nudge a section up/down in display order by swapping sortOrder with its neighbour.
export async function moveInfoSection(sectionId: string, direction: 'up' | 'down') {
  await requireRole('ADMIN');
  const sections = await prisma.infoSection.findMany({ orderBy: { sortOrder: 'asc' } });
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sections.length) return;
  const a = sections[idx];
  const b = sections[swapWith];
  await prisma.$transaction([
    prisma.infoSection.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.infoSection.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  revalidatePath('/', 'layout');
}
