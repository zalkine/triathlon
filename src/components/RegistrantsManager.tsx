import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import ConfirmForm from '@/components/ConfirmForm';
import RegistrantEditors from '@/components/RegistrantEditors';
import AdminAddRegistrantForm from '@/components/AdminAddRegistrantForm';
import { deleteRegistrant } from '@/actions/registrants';

export default async function RegistrantsManager({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  const [registrants, categories] = await Promise.all([
    prisma.registrant.findMany({
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const catInfo = categories.map((c) => ({
    key: c.key,
    nameEn: c.nameEn,
    nameHe: c.nameHe,
    type: c.type,
  }));

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-4">
      <h2 className="font-semibold">{t('allRegistrants')} ({registrants.length})</h2>

      <AdminAddRegistrantForm categories={catInfo} />

      {registrants.length === 0 ? (
        <p className="text-sm text-ink-light">{t('noRegistrants')}</p>
      ) : (
        <ul className="divide-y divide-ink/5">
          {registrants.map((r) => {
            const deleteAction = deleteRegistrant.bind(null, r.id);
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="mb-0.5 text-xs text-ink-light">
                    {r.mode === 'TEAM' && (
                      <span>
                        {[r.legSwim && 'Swim', r.legBike && 'Bike', r.legRun && 'Run']
                          .filter(Boolean)
                          .join('/')}
                        {' · '}
                      </span>
                    )}
                    {r.age != null && `${r.age} · `}
                    {r.checkedIn && '✓ '}
                  </div>
                  <RegistrantEditors
                    registrantId={r.id}
                    initialName={r.name}
                    initialCategoryKey={r.category.key}
                    categories={catInfo}
                  />
                </div>
                <ConfirmForm action={deleteAction} confirmMessage={t('confirmDeleteRegistrant')}>
                  <button type="submit" className="shrink-0 text-sm text-run-dark underline">
                    {t('deleteRegistrant')}
                  </button>
                </ConfirmForm>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
