'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

type FormAction = (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string }>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export default function CreateUserForm({ action }: { action: FormAction }) {
  const t = useTranslations('users');
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="new-username">
          {t('username')}
        </label>
        <input id="new-username" name="username" type="text" required className="rounded-lg border border-ink/20 px-3 py-2" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="new-password">
          {t('password')}
        </label>
        <input id="new-password" name="password" type="password" required minLength={4} className="rounded-lg border border-ink/20 px-3 py-2" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="new-role">
          {t('role')}
        </label>
        <select id="new-role" name="role" className="rounded-lg border border-ink/20 px-3 py-2">
          <option value="TIMEKEEPER">{t('timekeeper')}</option>
          <option value="ADMIN">{t('admin')}</option>
        </select>
      </div>
      <SubmitButton label={t('create')} />
      {state?.error && <p className="w-full text-sm text-run-dark">{state.error}</p>}
    </form>
  );
}
