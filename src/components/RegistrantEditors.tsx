'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { updateRegistrantName, updateRegistrantCategory } from '@/actions/registrants';

type CategoryInfo = { key: string; nameEn: string; nameHe: string };

export default function RegistrantEditors({
  registrantId,
  initialName,
  initialCategoryKey,
  categories,
}: {
  registrantId: string;
  initialName: string;
  initialCategoryKey: string;
  categories: CategoryInfo[];
}) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const tr = useTranslations('register');
  const [name, setName] = useState(initialName);
  const [draftName, setDraftName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [categoryKey, setCategoryKey] = useState(initialCategoryKey);
  const [draftCatKey, setDraftCatKey] = useState(initialCategoryKey);
  const [editingCat, setEditingCat] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const categoryLabel = (key: string) => {
    const cat = categories.find((c) => c.key === key);
    return cat ? (locale === 'he' ? cat.nameHe : cat.nameEn) : key;
  };

  const saveName = () => {
    setError('');
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', draftName);
      const result = await updateRegistrantName(registrantId, fd);
      if (result.error) {
        setError(result.error === 'name-letters-only' ? tr('errorNameLettersOnly') : tr('errorInvalid'));
      } else {
        setName(draftName);
        setEditingName(false);
      }
    });
  };

  const saveCat = () => {
    setError('');
    startTransition(async () => {
      const fd = new FormData();
      fd.set('categoryKey', draftCatKey);
      const result = await updateRegistrantCategory(registrantId, fd);
      if (result.error) {
        setError(tr('errorInvalid'));
      } else {
        setCategoryKey(draftCatKey);
        setEditingCat(false);
      }
    });
  };

  return (
    <div className="space-y-0.5">
      {editingName ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="rounded border border-ink/20 px-2 py-1 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={isPending}
            onClick={saveName}
            className="text-xs font-semibold text-swim-dark disabled:opacity-60"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingName(false);
              setDraftName(name);
              setError('');
            }}
            className="text-xs text-ink-light"
          >
            {t('cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          <button
            type="button"
            onClick={() => {
              setDraftName(name);
              setEditingName(true);
            }}
            className="text-xs text-ink-light underline"
          >
            {t('edit')}
          </button>
        </div>
      )}

      {editingCat ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={draftCatKey}
            onChange={(e) => setDraftCatKey(e.target.value)}
            className="rounded border border-ink/20 px-2 py-1 text-xs"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {locale === 'he' ? c.nameHe : c.nameEn}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={saveCat}
            className="text-xs font-semibold text-swim-dark disabled:opacity-60"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCat(false);
              setDraftCatKey(categoryKey);
              setError('');
            }}
            className="text-xs text-ink-light"
          >
            {t('cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-light">{categoryLabel(categoryKey)}</span>
          <button
            type="button"
            onClick={() => {
              setDraftCatKey(categoryKey);
              setEditingCat(true);
            }}
            className="text-xs text-ink-light underline"
          >
            {t('edit')}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-run-dark">{error}</p>}
    </div>
  );
}
