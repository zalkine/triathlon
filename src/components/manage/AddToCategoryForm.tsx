'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { adminAddRegistrant } from '@/actions/registrants';

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

// Compact "add a competitor straight into this category" control, shown at the
// top of each category card so the admin can add from anywhere on the page.
export default function AddToCategoryForm({
  categoryKey,
  type,
  isKids,
}: {
  categoryKey: string;
  type: string;
  isKids: boolean;
}) {
  const t = useTranslations('manage');
  const tr = useTranslations('register');
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(adminAddRegistrant, undefined);
  const isTeam = type === 'TEAM';

  const errorMsg = (e: string) =>
    ({
      'name-letters-only': tr('errorNameLettersOnly'),
      duplicate: tr('errorDuplicate'),
      'no-leg': tr('errorNoLeg'),
    })[e] ?? tr('errorInvalid');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold hover:bg-ink/5"
      >
        ➕ {t('addRegistrant')}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-ink/10 bg-surface/60 p-3">
      <input type="hidden" name="categoryKey" value={categoryKey} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          key={state?.success ? 'reset' : 'name'}
          name="name"
          type="text"
          required
          placeholder={tr('name')}
          className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
        />
        {isKids && (
          <input
            name="age"
            type="number"
            min={6}
            max={12}
            required
            placeholder={tr('age')}
            className="w-20 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
          />
        )}
        {isTeam && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" name="legSwim" /> {tr('legSwim')}</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="legBike" /> {tr('legBike')}</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="legRun" /> {tr('legRun')}</label>
          </span>
        )}
        <SubmitBtn label={t('addRegistrant')} />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-light">
          {t('cancel')}
        </button>
      </div>
      {state?.error && <p className="text-xs text-run-dark">{errorMsg(state.error)}</p>}
      {state?.error === 'duplicate' && (
        <label className="flex items-center gap-1.5 text-xs text-ink-light">
          <input type="checkbox" name="allowDuplicate" />
          {t('addDuplicateAnyway')}
        </label>
      )}
      {state?.success && <p className="text-xs text-swim-dark">{tr('success')}</p>}
    </form>
  );
}
