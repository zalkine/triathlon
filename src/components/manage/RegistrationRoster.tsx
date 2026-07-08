import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import ConfirmForm from '@/components/ConfirmForm';
import RegistrantEditors from '@/components/RegistrantEditors';
import { deleteRegistrant } from '@/actions/registrants';

// Fully-editable version of the public competitors view: the same grouping
// (solo / formed groups / available pool) but with inline rename, category
// change and delete for every person. Available team members who aren't in any
// group are flagged so the admin knows to place them.
export default async function RegistrationRoster({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const tc = await getTranslations('competitors');

  const [categories, allCategories] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { registrants: { orderBy: { createdAt: 'asc' } }, groups: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const catInfo = allCategories.map((c) => ({ key: c.key, nameEn: c.nameEn, nameHe: c.nameHe, type: c.type }));
  const total = categories.reduce((s, c) => s + c.registrants.length, 0);

  const DeleteButton = ({ id }: { id: string }) => {
    const action = deleteRegistrant.bind(null, id);
    return (
      <ConfirmForm action={action} confirmMessage={t('confirmDeleteRegistrant')}>
        <button type="submit" className="shrink-0 text-xs text-run-dark underline">
          {t('deleteRegistrant')}
        </button>
      </ConfirmForm>
    );
  };

  const shown = categories.filter(
    (c) => c.registrants.length > 0 || c.groups.length > 0
  );

  if (total === 0) {
    return <p className="text-sm text-ink-light">{t('noRegistrants')}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-light">{t('allRegistrants')} · {tc('count', { count: total })}</p>
      {shown.map((c) => {
        const nameOf = new Map(c.registrants.map((r) => [r.id, r.name]));
        const inGroup = new Set(
          c.groups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId])
        );
        const singles = c.type === 'SINGLE' ? c.registrants : [];
        const available =
          c.type === 'TEAM'
            ? c.registrants.filter((r) => r.groupPref !== 'HAS_GROUP' && !inGroup.has(r.id))
            : [];

        return (
          <div key={c.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
            <h3 className="mb-3 font-semibold">
              {locale === 'he' ? c.nameHe : c.nameEn}{' '}
              <span className="text-sm font-normal text-ink-light">({c.registrants.length})</span>
            </h3>

            {/* Solo competitors */}
            {singles.length > 0 && (
              <ul className="divide-y divide-ink/5">
                {singles.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <RegistrantEditors
                        registrantId={r.id}
                        initialName={r.name}
                        initialCategoryKey={c.key}
                        categories={catInfo}
                      />
                      {r.checkedIn && <span className="text-xs text-swim-dark">✓ {tc('arrived')}</span>}
                    </div>
                    <DeleteButton id={r.id} />
                  </li>
                ))}
              </ul>
            )}

            {/* Formed groups */}
            {c.groups.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-ink-light">{tc('groups')}</h4>
                <ul className="space-y-2">
                  {c.groups.map((g) => (
                    <li key={g.id} className="rounded-xl bg-cream/60 p-3 text-sm">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {(
                          [
                            ['roleSwim', g.swimRegistrantId],
                            ['roleBike', g.bikeRegistrantId],
                            ['roleRun', g.runRegistrantId],
                          ] as const
                        ).map(([label, id]) => (
                          <span key={label}>
                            <span className="text-ink-light">{tc(label)}:</span>{' '}
                            {id ? nameOf.get(id) ?? '?' : <span className="italic text-ink-light">{tc('openSlot')}</span>}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Available pool — flag anyone not yet in a group */}
            {available.length > 0 && (
              <div className="mt-3 space-y-2">
                <h4 className="text-sm font-semibold text-ink-light">{tc('availableTitle')}</h4>
                <ul className="divide-y divide-ink/5">
                  {available.map((r) => {
                    const legs = [r.legSwim && tc('legSwim'), r.legBike && tc('legBike'), r.legRun && tc('legRun')]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <RegistrantEditors
                            registrantId={r.id}
                            initialName={r.name}
                            initialCategoryKey={c.key}
                            categories={catInfo}
                          />
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-bike/20 px-2 py-0.5 font-medium text-bike-dark">
                              ⚠ {t('notInGroup')}
                            </span>
                            {legs && <span className="text-ink-light">{legs}</span>}
                            {r.checkedIn && <span className="text-swim-dark">✓ {tc('arrived')}</span>}
                          </div>
                        </div>
                        <DeleteButton id={r.id} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
