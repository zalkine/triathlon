'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createContact, updateContact, deleteContact } from '@/actions/contacts';

type Contact = { id: string; role: string; name: string; phone: string };

export default function ContactsEditor({ contacts }: { contacts: Contact[] }) {
  const t = useTranslations('manage');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = (id: string, form: HTMLFormElement) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await updateContact(id, fd);
      if (!res.error) {
        setEditingId(null);
        router.refresh();
      }
    });
  };

  const add = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createContact(undefined, fd);
      if (res.success) {
        form.reset();
        router.refresh();
      }
    });
  };

  const remove = (id: string) => {
    if (!window.confirm(t('confirmDeleteContact'))) return;
    startTransition(async () => {
      await deleteContact(id, new FormData());
      router.refresh();
    });
  };

  const inputCls = 'w-full rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none';

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-light">{t('contactsHint')}</p>

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/70">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs text-ink-light">
              <th className="px-4 py-2 text-start font-medium">{t('contactRole')}</th>
              <th className="px-4 py-2 text-start font-medium">{t('contactName')}</th>
              <th className="px-4 py-2 text-start font-medium">{t('contactPhone')}</th>
              <th className="px-4 py-2 text-end font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-light">
                  {t('contactsNone')}
                </td>
              </tr>
            )}
            {contacts.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="border-b border-ink/5 last:border-0">
                  <td colSpan={4} className="px-4 py-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        save(c.id, e.currentTarget);
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input name="role" defaultValue={c.role} required placeholder={t('contactRole')} className={`${inputCls} sm:w-40`} />
                      <input name="name" defaultValue={c.name} required placeholder={t('contactName')} className={`${inputCls} sm:w-48`} />
                      <input name="phone" defaultValue={c.phone} placeholder={t('contactPhone')} className={`${inputCls} sm:w-40`} />
                      <button type="submit" disabled={isPending} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream disabled:opacity-60">
                        {t('save')}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-ink-light">
                        {t('cancel')}
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.role}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr">{c.phone}</td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setEditingId(c.id)} className="text-xs text-ink-light underline">
                        {t('edit')}
                      </button>
                      <button type="button" onClick={() => remove(c.id)} className="text-xs text-run-dark underline">
                        {t('deleteRegistrant')}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Add a new contact */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(e.currentTarget);
        }}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white/60 p-3"
      >
        <input name="role" required placeholder={t('contactRole')} className={`${inputCls} sm:w-40`} />
        <input name="name" required placeholder={t('contactName')} className={`${inputCls} sm:w-48`} />
        <input name="phone" placeholder={t('contactPhone')} className={`${inputCls} sm:w-40`} />
        <button type="submit" disabled={isPending} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-60">
          {t('addContact')}
        </button>
      </form>
    </div>
  );
}
