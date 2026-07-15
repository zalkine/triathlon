import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import ConfirmForm from '@/components/ConfirmForm';
import RegistrantEditors from '@/components/RegistrantEditors';
import { deleteRegistrant } from '@/actions/registrants';
import GroupsBoard from './GroupsBoard';
import AddToCategoryForm from './AddToCategoryForm';
import UndoCheckinButton from './UndoCheckinButton';

// Fully-editable version of the public competitors view: the same grouping
// (solo / formed groups / available pool) but with inline edit, category
// change, delete, group editing and per-category add. Available team members
// who aren't in any group are flagged so the admin knows to place them.
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

  if (total === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-light">{t('noRegistrants')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-light">{t('allRegistrants')} · {tc('count', { count: total })}</p>
      {categories.map((c) => {
        const byId = new Map(c.registrants.map((r) => [r.id, r]));
        const inGroup = new Set(
          c.groups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId])
        );
        const singles = c.type === 'SINGLE' ? c.registrants : [];
        // Unassigned = any TEAM registrant not currently holding a leg in a
        // group — based on actual membership, not their registration-time
        // groupPref. This keeps a registrant visible (and placeable) even after
        // an admin clears/reassigns their leg, so no one is orphaned off-screen.
        const unassigned =
          c.type === 'TEAM'
            ? c.registrants
                .filter((r) => !inGroup.has(r.id))
                .map((r) => ({
                  id: r.id,
                  name: r.name,
                  checkedIn: r.checkedIn,
                  legSwim: r.legSwim,
                  legBike: r.legBike,
                  legRun: r.legRun,
                }))
            : [];
        const slotOf = (id: string | null) => {
          const r = id ? byId.get(id) : null;
          return r ? { id: r.id, name: r.name, checkedIn: r.checkedIn } : null;
        };
        const boardGroups = c.groups.map((g) => ({
          id: g.id,
          SWIM: slotOf(g.swimRegistrantId),
          BIKE: slotOf(g.bikeRegistrantId),
          RUN: slotOf(g.runRegistrantId),
        }));
        const isKids = c.key.startsWith('KIDS_');

        return (
          <div key={c.id} className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                {locale === 'he' ? c.nameHe : c.nameEn}{' '}
                <span className="text-sm font-normal text-ink-light">({c.registrants.length})</span>
              </h3>
              <AddToCategoryForm categoryKey={c.key} type={c.type} isKids={isKids} />
            </div>

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
                      {r.checkedIn && (
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-swim-dark">
                          ✓ {tc('arrived')}
                          <UndoCheckinButton registrantId={r.id} />
                        </span>
                      )}
                    </div>
                    <DeleteButton id={r.id} />
                  </li>
                ))}
              </ul>
            )}

            {/* Groups as a drag-and-drop table + unassigned tray */}
            {c.type === 'TEAM' && (
              <GroupsBoard
                categoryId={c.id}
                categoryKey={c.key}
                groups={boardGroups}
                unassigned={unassigned}
                categories={catInfo}
              />
            )}

            {c.type === 'SINGLE' && singles.length === 0 && (
              <p className="text-sm text-ink-light">{t('noRegistrants')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
