'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import type { RegisterState } from '@/actions/registrants';

type FormAction = (prevState: RegisterState | undefined, formData: FormData) => Promise<RegisterState>;
type CategoryInfo = { key: string; nameEn: string; nameHe: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-run px-6 py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export default function RegisterForm({ action, categories }: { action: FormAction; categories: CategoryInfo[] }) {
  const t = useTranslations('register');
  const locale = useLocale();
  const [state, formAction] = useFormState(action, undefined);

  const [age, setAge] = useState('');
  const [skillLevel, setSkillLevel] = useState<'PRO' | 'INTER'>('PRO');
  const [mode, setMode] = useState<'SINGLE' | 'TEAM'>('SINGLE');
  const [legSwim, setLegSwim] = useState(false);
  const [legBike, setLegBike] = useState(false);
  const [legRun, setLegRun] = useState(false);

  const ageNum = Number(age);
  const isKidAge = age !== '' && Number.isInteger(ageNum) && ageNum <= 12;
  const bracket = age === '' || !Number.isInteger(ageNum) ? null : ageNum < 9 ? 'KIDS_6_9' : ageNum <= 12 ? 'KIDS_9_12' : skillLevel;
  const categoryKey = bracket ? `${bracket}_${mode}` : '';

  const categoryName = useMemo(() => {
    const match = categories.find((c) => c.key === categoryKey);
    if (!match) return '';
    return locale === 'he' ? match.nameHe : match.nameEn;
  }, [categories, categoryKey, locale]);

  if (state?.success) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <p className="text-lg font-semibold text-swim-dark">{t('success')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border-2 border-ink/20 px-6 py-2 font-semibold hover:bg-ink/5"
        >
          {t('registerAnother')}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-sm space-y-5">
      <input type="hidden" name="categoryKey" value={categoryKey} readOnly />

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="name">
          {t('name')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="age">
          {t('age')}
        </label>
        <input
          id="age"
          name="age"
          type="number"
          min={3}
          max={110}
          required
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        />
      </div>

      {age !== '' && !isKidAge && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="skillLevel">
            {t('skillLevel')}
          </label>
          <select
            id="skillLevel"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value as 'PRO' | 'INTER')}
            className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
          >
            <option value="PRO">{t('professional')}</option>
            <option value="INTER">{t('intermediate')}</option>
          </select>
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium">{t('modeLabel')}</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="modeDisplay" checked={mode === 'SINGLE'} onChange={() => setMode('SINGLE')} />
            {t('single')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="modeDisplay" checked={mode === 'TEAM'} onChange={() => setMode('TEAM')} />
            {t('team')}
          </label>
        </div>
      </div>

      {mode === 'TEAM' && (
        <div>
          <p className="mb-2 text-sm font-medium">{t('legsPrompt')}</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="legSwim" checked={legSwim} onChange={(e) => setLegSwim(e.target.checked)} />
              {t('legSwim')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="legBike" checked={legBike} onChange={(e) => setLegBike(e.target.checked)} />
              {t('legBike')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="legRun" checked={legRun} onChange={(e) => setLegRun(e.target.checked)} />
              {t('legRun')}
            </label>
          </div>
        </div>
      )}

      {categoryName && <p className="text-sm text-ink-light">{t('kidsCategoryNote', { category: categoryName })}</p>}

      {state?.error && (
        <p className="text-sm text-run-dark">
          {state.error === 'closed' ? t('errorClosed') : state.error === 'no-leg' ? t('errorNoLeg') : t('errorInvalid')}
        </p>
      )}

      <SubmitButton label={t('submit')} />
    </form>
  );
}
