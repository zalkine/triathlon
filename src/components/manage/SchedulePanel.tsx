import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { setSchedulePublished, activateCompetition } from '@/actions/event';
import PreliminarySchedulePreview from '@/components/PreliminarySchedulePreview';
import ConfirmForm from '@/components/ConfirmForm';
import CsvLink from './CsvLink';

export default async function SchedulePanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });

  const runPublish = setSchedulePublished.bind(null, locale, true);
  const runUnpublish = setSchedulePublished.bind(null, locale, false);
  const runActivate = activateCompetition.bind(null, locale);

  return (
    <div className="space-y-6">
      <PreliminarySchedulePreview locale={locale} />

      {/* Publish schedule to the public */}
      <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-3">
        <h2 className="font-semibold">{t('schedulePublishedLabel')}</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              settings.schedulePublished ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'
            }`}
          >
            {settings.schedulePublished ? t('shown') : t('hidden')}
          </span>
          {settings.schedulePublished ? (
            <ConfirmForm action={runUnpublish} confirmMessage={t('unpublishScheduleConfirm')}>
              <button type="submit" className="text-sm font-semibold underline">
                {t('unpublishSchedule')}
              </button>
            </ConfirmForm>
          ) : (
            <form action={runPublish}>
              <button type="submit" className="rounded-full bg-swim px-4 py-1.5 text-sm font-semibold text-ink hover:brightness-95">
                {t('publishSchedule')}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Activate the competition (go live for timekeepers) */}
      <div className="rounded-2xl border border-ink/10 bg-surface/70 p-5 space-y-3">
        <h2 className="font-semibold">{t('competitionActiveLabel')}</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              settings.competitionActive ? 'bg-run/30 text-run-dark' : 'bg-ink/10 text-ink-light'
            }`}
          >
            {settings.competitionActive ? t('active') : t('notActive')}
          </span>
          {!settings.competitionActive && (
            <ConfirmForm action={runActivate} confirmMessage={t('activateConfirm')}>
              <button type="submit" className="rounded-full bg-run px-5 py-2 text-sm font-semibold text-white hover:brightness-95">
                {t('activateCompetition')}
              </button>
            </ConfirmForm>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/heats" label={t('exportHeats')} />
      </div>
    </div>
  );
}
