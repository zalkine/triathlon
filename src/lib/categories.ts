import { prisma } from './db';
import { isRegistrationOnlyCategory, mergedCategoryName } from './constants';

// Merged categories: reading side.
//
// An admin can race two age brackets as one (see Category.mergedIntoId). The
// absorbed bracket points at the primary, and everywhere the race is presented
// — heats, schedule, results — the pair acts as a single category under a name
// with the age range dropped. Registration still files everyone under their real
// bracket, so the merge stays reversible and the age data is never lost.

export type CategoryRow = {
  id: string;
  key: string;
  nameEn: string;
  nameHe: string;
  type: string;
  sortOrder: number;
  estDurationMinutes: number;
  mergedIntoId: string | null;
};

/** The category a given one races as: itself, or the primary that absorbed it. */
export function racingCategoryId(category: { id: string; mergedIntoId: string | null }): string {
  return category.mergedIntoId ?? category.id;
}

/**
 * Groups categories into the fields that actually race. Each group is led by a
 * primary (a category not merged into anything) and carries every bracket merged
 * into it. Returned in race order, and a group's name, duration and sort order
 * come from the whole group rather than the primary alone — a merged field takes
 * the slowest bracket's pool time, since they swim it together.
 */
export type RacingCategory = {
  id: string;
  key: string;
  nameEn: string;
  nameHe: string;
  type: string;
  sortOrder: number;
  estDurationMinutes: number;
  /** Every category id whose competitors race in this field, primary included. */
  memberIds: string[];
  /** The absorbed brackets, for telling the admin what a merge is made of. */
  members: CategoryRow[];
  merged: boolean;
};

export function toRacingCategories(categories: CategoryRow[]): RacingCategory[] {
  const primaries = categories.filter((c) => !c.mergedIntoId).sort((a, b) => a.sortOrder - b.sortOrder);
  return primaries.map((primary) => {
    const absorbed = categories
      .filter((c) => c.mergedIntoId === primary.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const all = [primary, ...absorbed];
    return {
      id: primary.id,
      key: primary.key,
      nameEn: absorbed.length > 0 ? mergedCategoryName(all.map((c) => c.nameEn)) : primary.nameEn,
      nameHe: absorbed.length > 0 ? mergedCategoryName(all.map((c) => c.nameHe)) : primary.nameHe,
      type: primary.type,
      sortOrder: primary.sortOrder,
      // Merged brackets share one trip through the pool, so the field needs as
      // long as its slowest bracket.
      estDurationMinutes: Math.max(...all.map((c) => c.estDurationMinutes)),
      memberIds: all.map((c) => c.id),
      members: all,
      merged: absorbed.length > 0,
    };
  });
}

const CATEGORY_FIELDS = {
  id: true,
  key: true,
  nameEn: true,
  nameHe: true,
  type: true,
  sortOrder: true,
  estDurationMinutes: true,
  mergedIntoId: true,
} as const;

/** Every category as stored, in race order. */
export async function allCategories(): Promise<CategoryRow[]> {
  return prisma.category.findMany({ select: CATEGORY_FIELDS, orderBy: { sortOrder: 'asc' } });
}

/**
 * The fields that race, in race order — merged brackets collapsed into one.
 * Registration-only categories (the toddlers fun run) are left out, exactly as
 * they are everywhere else on race day.
 */
export async function racingCategories(): Promise<RacingCategory[]> {
  const categories = await allCategories();
  return toRacingCategories(categories.filter((c) => !isRegistrationOnlyCategory(c.key)));
}

/** Every category id racing in the same field as this one, itself included. */
export async function racingGroupIds(categoryId: string): Promise<string[]> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, mergedIntoId: true },
  });
  if (!category) return [categoryId];
  const primaryId = racingCategoryId(category);
  const group = await prisma.category.findMany({
    where: { OR: [{ id: primaryId }, { mergedIntoId: primaryId }] },
    select: { id: true },
  });
  return group.map((c) => c.id);
}
