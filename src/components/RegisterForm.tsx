'use client';

import { useMemo, useState } from 'react';
import { useFormStatus, useFormState } from 'react-dom';
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

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [skillLevel, setSkillLevel] = useState<'PRO' | 'INTER' | 'KIDS'>('PRO');
  const [mode, setMode] = useState<'SINGLE' | 'TEAM'>('SINGLE');

  // available-pool willing legs
  const [legSwim, setLegSwim] = useState(false);
  const [legBike, setLegBike] = useState(false);
  const [legRun, setLegRun] = useState(false);

  // Group choice: join the available pool (admin groups you later) or register
  // an entire group by naming the person doing each leg.
  const [groupChoice, setGroupChoice] = useState<'AVAILABLE' | 'HAS_GROUP'>('AVAILABLE');
  const [swimName, setSwimName] = useState('');
  const [bikeName, setBikeName] = useState('');
  const [runName, setRunName] = useState('');

  // Age is only needed for the children's brackets (it splits 6–9 / 9–12).
  const isKids = skillLevel === 'KIDS';
  const ageNum = Number(age);
  const validKidsAge = age !== '' && Number.isInteger(ageNum) && ageNum >= 6 && ageNum <= 12;
  const bracket = isKids ? (validKidsAge ? (ageNum < 9 ? 'KIDS_6_9' : 'KIDS_9_12') : null) : skillLevel;
  const categoryKey = bracket ? `${bracket}_${mode}` : '';

  const categoryName = useMemo(() => {
    const match = categories.find((c) => c.key === categoryKey);
    return match ? (locale === 'he' ? match.nameHe : match.nameEn) : '';
  }, [categories, categoryKey, locale]);

  // When registering an entire group, the three leg names are the members, so
  // the single "name" field at the top is hidden.
  const fullGroup = mode === 'TEAM' && groupChoice === 'HAS_GROUP';

  if (state?.success) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
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

  const errorText = (e: string) =>
    ({
      closed: t('errorClosed'),
      'no-leg': t('errorNoLeg'),
      'roles-incomplete': t('errorRolesIncomplete'),
      'name-letters-only': t('errorNameLettersOnly'),
      duplicate: t('errorDuplicate'),
    })[e] ?? t('errorInvalid');

  return (
    <form action={formAction} className="w-full max-w-md space-y-5">
      <input type="hidden" name="categoryKey" value={categoryKey} readOnly />
      <input type="hidden" name="groupChoice" value={mode === 'TEAM' ? groupChoice : ''} readOnly />

      {/* The person's own name — for a full group the three leg names stand in. */}
      {!fullGroup && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="name">
            {t('name')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="skillLevel">
          {t('skillLevel')}
        </label>
        <select
          id="skillLevel"
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value as 'PRO' | 'INTER' | 'KIDS')}
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        >
          <option value="PRO">{t('professional')}</option>
          <option value="INTER">{t('intermediate')}</option>
          <option value="KIDS">{t('kids')}</option>
        </select>
      </div>

      {/* Age is asked only for the kids race, to place them in the 6–9 / 9–12 bracket. */}
      {isKids && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="age">
            {t('age')}
          </label>
          <input
            id="age"
            name="age"
            type="number"
            min={6}
            max={12}
            required
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
          />
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
        <div className="space-y-4 rounded-xl border border-ink/10 bg-surface/50 p-4">
          <div>
            <span className="mb-2 block text-sm font-medium">{t('groupChoiceLabel')}</span>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="radio" checked={groupChoice === 'AVAILABLE'} onChange={() => setGroupChoice('AVAILABLE')} />
                {t('chooseAvailable')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={groupChoice === 'HAS_GROUP'} onChange={() => setGroupChoice('HAS_GROUP')} />
                {t('chooseHasGroup')}
              </label>
            </div>
          </div>

          {groupChoice === 'AVAILABLE' && (
            <div>
              <p className="mb-2 text-sm">{t('legsPrompt')}</p>
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

          {groupChoice === 'HAS_GROUP' && (
            <div>
              <p className="mb-2 text-sm">{t('fullGroupPrompt')}</p>
              <div className="space-y-2">
                {(
                  [
                    ['roleSwimLabel', 'swimName', swimName, setSwimName],
                    ['roleBikeLabel', 'bikeName', bikeName, setBikeName],
                    ['roleRunLabel', 'runName', runName, setRunName],
                  ] as const
                ).map(([labelKey, fieldName, val, setter]) => (
                  <div key={fieldName} className="flex items-center gap-2">
                    <span className="w-20 text-sm">{t(labelKey)}</span>
                    <input
                      type="text"
                      name={fieldName}
                      required
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={t('teammateNamePlaceholder')}
                      className="flex-1 rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-light">{t('fullGroupHint')}</p>
            </div>
          )}
        </div>
      )}

      {categoryName && <p className="text-sm text-ink-light">{t('kidsCategoryNote', { category: categoryName })}</p>}

      {state?.error && <p className="text-sm text-run-dark">{errorText(state.error)}</p>}

      <SubmitButton label={t('submit')} />
    </form>
  );
}
