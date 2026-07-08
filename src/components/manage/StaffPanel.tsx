import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { createUser, deleteUser } from '@/actions/users';
import { getSession } from '@/lib/auth';
import CreateUserForm from '@/components/CreateUserForm';
import ConfirmForm from '@/components/ConfirmForm';
import ContactsEditor from './ContactsEditor';
import CsvLink from './CsvLink';

export default async function StaffPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const tu = await getTranslations('users');
  const [users, contacts, session] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.contact.findMany({ orderBy: { sortOrder: 'asc' } }),
    getSession(),
  ]);

  const createAction = createUser.bind(null, locale);

  return (
    <div className="space-y-6">
      {/* Staff accounts */}
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-4">
        <h2 className="font-semibold">{tu('title')}</h2>
        <CreateUserForm action={createAction} />
        <ul className="divide-y divide-ink/5">
          {users.map((u) => {
            const deleteAction = async () => {
              'use server';
              await deleteUser(locale, u.id);
            };
            return (
              <li key={u.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">{u.username}</span>{' '}
                  <span className="text-sm text-ink-light">· {u.role === 'ADMIN' ? tu('admin') : tu('timekeeper')}</span>
                </div>
                {u.id !== session?.sub && (
                  <ConfirmForm action={deleteAction} confirmMessage={tu('confirmDelete')}>
                    <button className="text-sm text-run-dark underline">{tu('delete')}</button>
                  </ConfirmForm>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Contact directory (public) */}
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-4">
        <h2 className="font-semibold">{t('contactsTitle')}</h2>
        <ContactsEditor contacts={contacts} />
        <div className="flex flex-wrap gap-3 pt-1">
          <CsvLink href="/api/export/contacts" label={t('exportContacts')} />
        </div>
      </div>
    </div>
  );
}
