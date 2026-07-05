import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { createUser, deleteUser } from '@/actions/users';
import { getSession } from '@/lib/auth';
import CreateUserForm from '@/components/CreateUserForm';
import ConfirmForm from '@/components/ConfirmForm';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const t = await getTranslations('users');
  const locale = await getLocale();
  const session = await getSession();
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const createAction = createUser.bind(null, locale);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
        <h2 className="mb-3 font-semibold">{t('newUser')}</h2>
        <CreateUserForm action={createAction} />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
        <h2 className="mb-3 font-semibold">{t('existing')}</h2>
        <ul className="divide-y divide-ink/5">
          {users.map((u) => {
            const deleteAction = async (formData: FormData) => {
              'use server';
              await deleteUser(locale, u.id);
            };
            return (
              <li key={u.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">{u.username}</span>{' '}
                  <span className="text-sm text-ink-light">· {u.role === 'ADMIN' ? t('admin') : t('timekeeper')}</span>
                </div>
                {u.id !== session?.sub && (
                  <ConfirmForm action={deleteAction} confirmMessage={t('confirmDelete')}>
                    <button className="text-sm text-run-dark underline">{t('delete')}</button>
                  </ConfirmForm>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
