import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { createEntry, deleteEntry } from '@/actions/entries';
import { deleteHeat } from '@/actions/heats';
import HeatStartTimeEditor from '@/components/HeatStartTimeEditor';
import TimeFieldEditor from '@/components/TimeFieldEditor';
import MembersEditor from '@/components/MembersEditor';
import ConfirmForm from '@/components/ConfirmForm';

export const dynamic = 'force-dynamic';

export default async function HeatDetailPage({
  params,
}: {
  params: Promise<{ locale: string; heatId: string }>;
}) {
  const { locale, heatId } = await params;
  const t = await getTranslations('manage');

  const heat = await prisma.heat.findUnique({
    where: { id: heatId },
    include: {
      category: true,
      entries: { include: { members: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!heat) notFound();

  const createEntryAction = createEntry.bind(null, locale, heatId);
  const deleteHeatAction = deleteHeat.bind(null, locale, heatId);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/staff/manage" className="text-sm font-semibold underline">
        {t('backToDashboard')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-light">{locale === 'he' ? heat.category.nameHe : heat.category.nameEn}</p>
          <h1 className="text-2xl font-bold">{heat.name}</h1>
        </div>
        <ConfirmForm action={deleteHeatAction} confirmMessage={t('confirmDeleteHeat')}>
          <button className="rounded-full border border-run-dark px-4 py-2 text-sm font-semibold text-run-dark hover:bg-run-light/30">
            {t('deleteHeat')}
          </button>
        </ConfirmForm>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-ink-light">{t('startTime')}</p>
        <HeatStartTimeEditor heatId={heat.id} value={heat.startTime?.toISOString() ?? null} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('entries')}</h2>
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/70">
          <table className="w-full min-w-[640px] text-start">
            <thead>
              <tr className="border-b border-ink/10 text-sm text-ink-light">
                <th className="px-4 py-3 text-start">{t('entryName')}</th>
                <th className="px-4 py-3 text-start">{t('swimTime')}</th>
                <th className="px-4 py-3 text-start">{t('bikeTime')}</th>
                <th className="px-4 py-3 text-start">{t('runTime')}</th>
                <th className="px-4 py-3 text-start"></th>
              </tr>
            </thead>
            <tbody>
              {heat.entries.map((entry) => {
                const deleteEntryAction = deleteEntry.bind(null, locale, heatId, entry.id);
                return (
                  <tr key={entry.id} className="border-b border-ink/5 align-top last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{entry.name}</div>
                      {heat.category.type === 'TEAM' && (
                        <MembersEditor locale={locale} heatId={heatId} entryId={entry.id} members={entry.members} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TimeFieldEditor heatId={heatId} entryId={entry.id} field="swimTime" value={entry.swimTime?.toISOString() ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <TimeFieldEditor heatId={heatId} entryId={entry.id} field="bikeTime" value={entry.bikeTime?.toISOString() ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <TimeFieldEditor heatId={heatId} entryId={entry.id} field="runTime" value={entry.runTime?.toISOString() ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <ConfirmForm action={deleteEntryAction} confirmMessage={t('confirmDeleteEntry')}>
                        <button className="text-sm text-run-dark underline">{t('remove')}</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form action={createEntryAction} className="flex flex-wrap items-center gap-2">
          <input
            name="name"
            type="text"
            required
            placeholder={t('entryName')}
            className="rounded-lg border border-ink/20 px-4 py-2"
          />
          <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110">
            {t('addEntry')}
          </button>
        </form>
      </div>
    </div>
  );
}
