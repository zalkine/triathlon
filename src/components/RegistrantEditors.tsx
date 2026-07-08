'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { updateRegistrant } from '@/actions/registrants';

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
  const [categoryKey, setCategoryKey] = useState(initialCategoryKey);
  const [draftName, setDraftName] = useState(initialName);
  const [draftCatKey, setDraftCatKey] = useState(initialCategoryKey);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const categoryLabel = (key: string) => {
    const cat = categories.find((c) => c.key === key);
    return cat ? (locale === 'he' ? cat.nameHe : cat.nameEn) : key;
  };

  const startEdit = () => {
    setDraftName(name);
    setDraftCatKey(categoryKey);
    setError('');
    setEditing(true);
  };

  const save = () => {
    setError('');
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', draftName);
      fd.set('categoryKey', draftCatKey);
      const result = await updateRegistrant(registrantId, fd);
      if (result.error) {
        setError(result.error === 'name-letters-only' ? tr('errorNameLettersOnly') : tr('errorInvalid'));
      } else {
        setName(draftName);
        setCategoryKey(draftCatKey);
        setEditing(false);
      }
    });
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="w-full rounded border border-ink/20 px-2 py-1 text-sm"
          autoFocus
        />
        <select
          value={draftCatKey}
          onChange={(e) => setDraftCatKey(e.target.value)}
          className="w-full rounded border border-ink/20 px-2 py-1 text-xs"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {locale === 'he' ? c.nameHe : c.nameEn}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={save}
            className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream disabled:opacity-60"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError('');
            }}
            className="text-xs text-ink-light"
          >
            {t('cancel')}
          </button>
        </div>
        {error && <p className="text-xs text-run-dark">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-medium">{name}</span>
      <span className="text-xs text-ink-light">{categoryLabel(categoryKey)}</span>
      <button type="button" onClick={startEdit} className="text-xs text-ink-light underline">
        {t('edit')}
      </button>
    </div>
  );
}
