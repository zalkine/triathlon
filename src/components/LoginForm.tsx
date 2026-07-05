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
      className="w-full rounded-full bg-ink px-6 py-3 font-semibold text-cream transition hover:brightness-110 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export default function LoginForm({ action }: { action: FormAction }) {
  const t = useTranslations('login');
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="username">
          {t('username')}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="password">
          {t('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        />
      </div>
      {state?.error && <p className="text-sm text-run-dark">{t('error')}</p>}
      <SubmitButton label={t('submit')} />
    </form>
  );
}
