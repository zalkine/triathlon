import { getTranslations } from 'next-intl/server';
import { allCategories, toRacingCategories } from '@/lib/categories';
import { isRegistrationOnlyCategory, mergeFamilyOf, mergedCategoryName } from '@/lib/constants';
import MergeCategoriesControls, { type MergeFamily } from './MergeCategoriesControls';

// Admin-only: race two age brackets as a single category (children's singles
// 6-9 together with 9-12, say), so a handful of children in each bracket become
// one proper field with one ranking and one podium.
//
// Only brackets of the same race differing by age can be offered here, which is
// why the options are built from MERGE_FAMILY rather than from whatever
// categories happen to exist.
export default async function MergeCategoriesPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  const categories = await allCategories();
  const fields = toRacingCategories(categories.filter((c) => !isRegistrationOnlyCategory(c.key)));
  const name = (c: { nameEn: string; nameHe: string }) => (locale === 'he' ? c.nameHe : c.nameEn);

  // Group the mergeable brackets by family, so each family is offered as one
  // proposition ("race these two as one") rather than a free-for-all.
  const byFamily = new Map<string, typeof categories>();
  for (const c of categories) {
    const family = mergeFamilyOf(c.key);
    if (!family) continue;
    byFamily.set(family, [...(byFamily.get(family) ?? []), c]);
  }

  const families: MergeFamily[] = [...byFamily.entries()]
    .map(([family, members]) => {
      const ordered = [...members].sort((a, b) => a.sortOrder - b.sortOrder);
      const merged = fields.find((f) => f.merged && f.memberIds.length === ordered.length &&
        ordered.every((m) => f.memberIds.includes(m.id)));
      return {
        family,
        mergedName: mergedCategoryName(ordered.map(name)),
        bracketNames: ordered.map(name),
        categoryIds: ordered.map((c) => c.id),
        // The field id to split back apart, when this family is already merged.
        mergedPrimaryId: merged?.id ?? null,
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family));

  if (families.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-3">
      <h2 className="font-semibold">{t('mergeCategoriesTitle')}</h2>
      <p className="text-sm text-ink-light">{t('mergeCategoriesHint')}</p>
      <MergeCategoriesControls families={families} />
    </div>
  );
}
