import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { LEGS, type Leg } from '@/lib/constants';

// Heats-tab visibility panel: every TEAM registrant who isn't in a group. These
// people are deliberately NOT placed in a heat — the admin forms their group on
// the Registration tab. Membership-based (not check-in / groupPref), matching
// the group table's "unassigned" tray so the two always agree.
export default async function UnassignedRegistrants({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const tc = await getTranslations('competitors');

  const categories = await prisma.category.findMany({
    where: { type: 'TEAM' },
    orderBy: { sortOrder: 'asc' },
    include: { registrants: { orderBy: { createdAt: 'asc' } }, groups: true },
  });

  const legLabel = (l: Leg) => (l === 'SWIM' ? tc('legSwim') : l === 'BIKE' ? tc('legBike') : tc('legRun'));

  const perCategory = categories
    .map((c) => {
      const inGroup = new Set(
        c.groups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId])
      );
      const ungrouped = c.registrants.filter((r) => !inGroup.has(r.id));
      return { category: c, ungrouped };
    })
    .filter((x) => x.ungrouped.length > 0);

  const total = perCategory.reduce((s, x) => s + x.ungrouped.length, 0);

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5">
      <h2 className="mb-1 font-semibold">{t('unassigned')}</h2>
      {total === 0 ? (
        <p className="text-sm text-ink-light">{t('unassignedNone')}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-light">{t('unassignedHint')}</p>
          <div className="space-y-4">
            {perCategory.map(({ category, ungrouped }) => (
              <div key={category.id}>
                <h3 className="mb-1 text-sm font-semibold">
                  {locale === 'he' ? category.nameHe : category.nameEn}{' '}
                  <span className="font-normal text-ink-light">({ungrouped.length})</span>
                </h3>
                <ul className="divide-y divide-ink/5">
                  {ungrouped.map((r) => {
                    const willing = LEGS.filter(
                      (l) => (l === 'SWIM' && r.legSwim) || (l === 'BIKE' && r.legBike) || (l === 'RUN' && r.legRun)
                    );
                    return (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-medium">{r.name}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-bike/20 px-2 py-0.5 font-medium text-bike-dark">
                            ⚠ {t('notInGroup')}
                          </span>
                          {willing.length > 0 && (
                            <span className="text-ink-light">{willing.map(legLabel).join(' · ')}</span>
                          )}
                          {r.checkedIn && <span className="text-swim-dark">✓ {tc('arrived')}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
