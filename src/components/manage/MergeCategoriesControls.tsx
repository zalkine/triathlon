'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { mergeCategories, unmergeCategory } from '@/actions/categories';

export type MergeFamily = {
  family: string;
  /** What the brackets would race as once merged, e.g. "Children – Singles". */
  mergedName: string;
  bracketNames: string[];
  categoryIds: string[];
  /** Set when this family is already merged — the field to split back apart. */
  mergedPrimaryId: string | null;
};

// One row per family of age brackets that may be raced as one. Merging changes
// who competes against whom, so it asks first and says plainly what it does.
export default function MergeCategoriesControls({ families }: { families: MergeFamily[] }) {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const doMerge = (f: MergeFamily) => {
    if (!window.confirm(t('confirmMergeCategories', { merged: f.mergedName, brackets: f.bracketNames.join(' + ') }))) return;
    startTransition(async () => {
      const result = await mergeCategories(f.categoryIds);
      if ('error' in result) {
        window.alert(
          result.error === 'already-timed'
            ? t('mergeAlreadyTimed')
            : result.error === 'not-same-family'
              ? t('mergeNotSameFamily')
              : t('mergeFailed')
        );
        return;
      }
      router.refresh();
    });
  };

  const doUnmerge = (f: MergeFamily) => {
    if (!f.mergedPrimaryId) return;
    if (!window.confirm(t('confirmUnmergeCategories', { brackets: f.bracketNames.join(' + ') }))) return;
    startTransition(async () => {
      const result = await unmergeCategory(f.mergedPrimaryId as string);
      if ('error' in result) {
        window.alert(result.error === 'already-timed' ? t('mergeAlreadyTimed') : t('mergeFailed'));
        return;
      }
      router.refresh();
    });
  };

  return (
    <ul className="space-y-2">
      {families.map((f) => {
        const merged = !!f.mergedPrimaryId;
        return (
          <li
            key={f.family}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
              merged ? 'border-swim-dark/40 bg-swim/10' : 'border-ink/15'
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {merged && <span className="me-1">🔗</span>}
                {merged ? f.mergedName : f.bracketNames.join('  ·  ')}
              </p>
              <p className="text-xs text-ink-light">
                {merged
                  ? `${t('racingAsOne')}: ${f.bracketNames.join(' + ')}`
                  : t('mergeWouldRaceAs', { merged: f.mergedName })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (merged ? doUnmerge(f) : doMerge(f))}
              disabled={isPending}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                merged ? 'border border-ink/30 hover:bg-ink/5' : 'bg-swim text-ink hover:brightness-95'
              }`}
            >
              {merged ? t('unmergeCategories') : t('mergeCategoriesAction')}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
