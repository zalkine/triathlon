import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import {
  openRegistration,
  closeRegistration,
  generateSchedule,
  activateCompetition,
  setAllowRandomGrouping,
  setPublicResultsVisible,
} from '@/actions/event';
import { formatClock } from '@/lib/time';
import ConfirmForm from './ConfirmForm';

export default async function EventControls({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });

  const runOpenRegistration = openRegistration.bind(null, locale);
  const runCloseRegistration = closeRegistration.bind(null, locale);
  const toggleRandomGrouping = setAllowRandomGrouping.bind(null, locale, !settings.allowRandomGrouping);
  const togglePublicResults = setPublicResultsVisible.bind(null, locale, !settings.publicResultsVisible);
  const runGenerateSchedule = generateSchedule.bind(null, locale);
  const runActivateCompetition = activateCompetition.bind(null, locale);

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
      <h2 className="mb-4 font-semibold">{t('eventControls')}</h2>
      <div className="flex flex-wrap items-center gap-6 text-sm">

        <div className="flex items-center gap-2">
          <span className="text-ink-light">{t('registrationOpenLabel')}:</span>
          {settings.registrationOpen ? (
            <>
              <span className="font-semibold text-swim-dark">{t('open')}</span>
              <ConfirmForm action={runCloseRegistration} confirmMessage={t('closeRegistrationConfirm')}>
                <button
                  type="submit"
                  className="rounded-full bg-run px-4 py-1 text-sm font-semibold text-white hover:brightness-95"
                >
                  {t('closeRegistration')}
                </button>
              </ConfirmForm>
            </>
          ) : (
            <>
              <span className="font-semibold text-ink-light">{t('closed')}</span>
              <ConfirmForm action={runOpenRegistration} confirmMessage={t('openRegistrationConfirm')}>
                <button
                  type="submit"
                  className="rounded-full bg-swim px-4 py-1 text-sm font-semibold text-ink hover:brightness-95"
                >
                  {t('openRegistration')}
                </button>
              </ConfirmForm>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-ink-light">{t('randomGroupingLabel')}:</span>
          <span className="font-semibold">{settings.allowRandomGrouping ? t('open') : t('closed')}</span>
          <form action={toggleRandomGrouping}>
            <button type="submit" className="text-sm font-semibold underline">
              {settings.allowRandomGrouping ? t('disableRandomGrouping') : t('enableRandomGrouping')}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-ink-light">{t('publicResultsLabel')}:</span>
          <span className="font-semibold">{settings.publicResultsVisible ? t('shown') : t('hidden')}</span>
          <form action={togglePublicResults}>
            <button type="submit" className="text-sm font-semibold underline">
              {settings.publicResultsVisible ? t('hideResults') : t('showResults')}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-ink-light">{t('competitionActiveLabel')}:</span>
          <span className="font-semibold">{settings.competitionActive ? t('active') : t('notActive')}</span>
          {!settings.competitionActive && (
            <ConfirmForm action={runActivateCompetition} confirmMessage={t('activateConfirm')}>
              <button type="submit" className="rounded-full bg-run px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95">
                {t('activateCompetition')}
              </button>
            </ConfirmForm>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-ink/5 pt-4">
        <ConfirmForm action={runGenerateSchedule} confirmMessage={t('generateScheduleConfirm')}>
          <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:brightness-110">
            {t('generateSchedule')}
          </button>
        </ConfirmForm>
        {settings.scheduleGeneratedAt && (
          <p className="mt-2 text-xs text-ink-light">
            {t('scheduleGeneratedAt', { time: formatClock(settings.scheduleGeneratedAt, locale) })}
          </p>
        )}
      </div>
    </div>
  );
}
