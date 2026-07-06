import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { LEGS, type Leg } from '@/lib/constants';
import AssignToTeamForm from './AssignToTeamForm';

export default async function UnassignedRegistrants({ locale }: { locale: string }) {
  const t = await getTranslations('manage');

  // "Available" people who are checked in but aren't in any group yet and
  // haven't been manually placed into an entry.
  const [available, allGroups] = await Promise.all([
    prisma.registrant.findMany({
      where: { checkedIn: true, entryId: null, groupPref: 'AVAILABLE', category: { type: 'TEAM' } },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.group.findMany(),
  ]);
  const inGroup = new Set(
    allGroups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId])
  );
  const leftovers = available.filter((r) => !inGroup.has(r.id));

  if (leftovers.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
        <h2 className="mb-2 font-semibold">{t('unassigned')}</h2>
        <p className="text-sm text-ink-light">{t('unassignedNone')}</p>
      </div>
    );
  }

  const categoryIds = [...new Set(leftovers.map((r) => r.categoryId))];
  const openEntries = await prisma.entry.findMany({
    where: { heat: { categoryId: { in: categoryIds } } },
    include: { members: true, heat: true },
  });

  const optionsFor = (categoryId: string, willingLegs: Leg[]) => {
    return openEntries
      .filter((e) => e.heat.categoryId === categoryId)
      .flatMap((e) => {
        const takenLegs = new Set(e.members.map((m) => m.leg));
        const missing = LEGS.filter((l) => !takenLegs.has(l) && willingLegs.includes(l));
        return missing.map((leg) => ({ entryId: e.id, entryName: e.name, leg }));
      });
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
      <h2 className="mb-1 font-semibold">{t('unassigned')}</h2>
      <p className="mb-3 text-sm text-ink-light">{t('unassignedHint')}</p>
      <ul className="divide-y divide-ink/5">
        {leftovers.map((r) => {
          const willingLegs = LEGS.filter((l) => (l === 'SWIM' && r.legSwim) || (l === 'BIKE' && r.legBike) || (l === 'RUN' && r.legRun));
          const options = optionsFor(r.categoryId, willingLegs);
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <span className="font-medium">{r.name}</span>{' '}
                <span className="text-sm text-ink-light">
                  · {locale === 'he' ? r.category.nameHe : r.category.nameEn} · {willingLegs.join('/')}
                </span>
              </div>
              <AssignToTeamForm locale={locale} registrantId={r.id} options={options} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
