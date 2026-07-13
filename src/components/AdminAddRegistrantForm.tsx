'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { adminAddRegistrant } from '@/actions/registrants';

type CategoryInfo = { key: string; nameEn: string; nameHe: string; type: string };

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export default function AdminAddRegistrantForm({ categories }: { categories: CategoryInfo[] }) {
  const locale = useLocale();
  const t = useTranslations('manage');
  const tr = useTranslations('register');
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? '');
  const [state, formAction] = useFormState(adminAddRegistrant, undefined);

  const selectedCat = categories.find((c) => c.key === categoryKey);
  const isKids = categoryKey.startsWith('KIDS_');
  const isTeam = selectedCat?.type === 'TEAM';

  const errorMsg = (e: string) =>
    ({
      'name-letters-only': tr('errorNameLettersOnly'),
      duplicate: tr('errorDuplicate'),
      'no-leg': tr('errorNoLeg'),
    })[e] ?? tr('errorInvalid');

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-ink/10 bg-white/60 p-3">
      <p className="text-sm font-medium">{t('addRegistrant')}</p>

      <div className="flex flex-wrap gap-2">
        <input
          key={state?.success ? 'reset-name' : 'name'}
          name="name"
          type="text"
          required
          placeholder={tr('name')}
          className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
        />
        <input type="hidden" name="categoryKey" value={categoryKey} />
        <select
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
          className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {locale === 'he' ? c.nameHe : c.nameEn}
            </option>
          ))}
        </select>
        {isKids && (
          <input
            key={state?.success ? 'reset-age' : 'age'}
            name="age"
            type="number"
            min={6}
            max={12}
            required
            placeholder={tr('age')}
            className="w-20 rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
          />
        )}
      </div>

      {isTeam && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-ink-light">{tr('legsPrompt')}</span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="legSwim" />
            {tr('legSwim')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="legBike" />
            {tr('legBike')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="legRun" />
            {tr('legRun')}
          </label>
        </div>
      )}

      {state?.error && <p className="text-xs text-run-dark">{errorMsg(state.error)}</p>}
      {state?.error === 'duplicate' && (
        <label className="flex items-center gap-1.5 text-xs text-ink-light">
          <input type="checkbox" name="allowDuplicate" />
          {t('addDuplicateAnyway')}
        </label>
      )}
      {state?.success && <p className="text-xs text-swim-dark">{tr('success')}</p>}

      <SubmitBtn label={t('addRegistrant')} />
    </form>
  );
}
