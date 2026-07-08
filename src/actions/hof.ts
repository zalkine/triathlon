'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getCategoryResults } from '@/lib/ranking';
import type { Family } from '@/lib/hallOfFame';

// Admin CRUD + bulk-import for the Hall of Fame (HistoricalResult table).

function parseSeconds(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // Accept a plain number of seconds, or a clock like m:ss / h:mm:ss.
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(':').map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p)) || parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  return parts.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
}

const FAMILIES: Family[] = ['Elite', 'Amateur', 'Kids', 'Seniors', 'Open'];

function readForm(formData: FormData): { data?: {
  year: number; categoryHe: string; family: string; isTeam: boolean;
  rank: number | null; name: string; seconds: number; members: string[];
}; error?: string } {
  const year = parseInt(String(formData.get('year') || ''), 10);
  const categoryHe = String(formData.get('categoryHe') || '').trim();
  const family = String(formData.get('family') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const isTeam = formData.get('isTeam') === 'on' || formData.get('isTeam') === 'true';
  const seconds = parseSeconds(String(formData.get('seconds') || ''));
  const rankRaw = String(formData.get('rank') || '').trim();
  const rank = rankRaw ? parseInt(rankRaw, 10) : null;
  const members = String(formData.get('members') || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  if (!Number.isInteger(year) || year < 1900 || year > 2200) return { error: 'year' };
  if (!name) return { error: 'name' };
  if (!FAMILIES.includes(family as Family)) return { error: 'family' };
  if (seconds == null || seconds <= 0) return { error: 'seconds' };
  if (rankRaw && (rank == null || Number.isNaN(rank))) return { error: 'rank' };

  return { data: { year, categoryHe, family, isTeam, rank, name, seconds, members } };
}

export async function createHistoricalResult(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await requireRole('ADMIN');
  const { data, error } = readForm(formData);
  if (error || !data) return { error: error ?? 'invalid' };
  await prisma.historicalResult.create({ data });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function updateHistoricalResult(
  resultId: string,
  formData: FormData
): Promise<{ error?: string; ok?: true }> {
  await requireRole('ADMIN');
  const { data, error } = readForm(formData);
  if (error || !data) return { error: error ?? 'invalid' };
  await prisma.historicalResult.update({ where: { id: resultId }, data });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteHistoricalResult(resultId: string, _formData: FormData) {
  await requireRole('ADMIN');
  await prisma.historicalResult.delete({ where: { id: resultId } });
  revalidatePath('/', 'layout');
}

// Map a competition category to a Hall of Fame "family" bucket.
function familyForCategoryKey(key: string): Family {
  if (key.startsWith('PRO_')) return 'Elite';
  if (key.startsWith('INTER_')) return 'Amateur';
  if (key.startsWith('KIDS_')) return 'Kids';
  return 'Open';
}

// Publish this year's finished results into the Hall of Fame. Idempotent per
// (year, category): re-running first clears any rows previously imported for
// that year+categoryHe so it always reflects the latest approved results.
export async function addResultsToHof(locale: string, formData: FormData): Promise<{ added: number }> {
  await requireRole('ADMIN');
  const parsedYear = parseInt(String(formData.get('year') || ''), 10);
  const year = Number.isInteger(parsedYear) ? parsedYear : new Date().getFullYear();
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });

  let added = 0;
  for (const cat of categories) {
    const result = await getCategoryResults(cat.id);
    if (!result) continue;
    const finished = result.ranked.filter((e) => e.totalMs != null);
    if (finished.length === 0) continue;

    // Members for team entries, to populate the split roster.
    const membersByEntry = new Map<string, string[]>();
    if (cat.type === 'TEAM') {
      const entries = await prisma.entry.findMany({
        where: { id: { in: finished.map((e) => e.id) } },
        include: { members: true },
      });
      for (const e of entries) {
        membersByEntry.set(
          e.id,
          e.members.map((m) => m.name).filter((n) => n && n !== '—')
        );
      }
    }

    // Replace any previously-imported rows for this year + category.
    await prisma.historicalResult.deleteMany({ where: { year, categoryHe: cat.nameHe } });

    await prisma.historicalResult.createMany({
      data: finished.map((e) => ({
        year,
        categoryHe: cat.nameHe,
        family: familyForCategoryKey(cat.key),
        isTeam: cat.type === 'TEAM',
        rank: e.rank,
        name: e.name,
        seconds: Math.round((e.totalMs as number) / 1000),
        members: cat.type === 'TEAM' ? membersByEntry.get(e.id) ?? [] : [],
      })),
    });
    added += finished.length;
  }

  revalidatePath('/', 'layout');
  return { added };
}
