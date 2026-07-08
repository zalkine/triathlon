import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { openRegistration, closeRegistration, setAllowRandomGrouping } from '@/actions/event';
import ConfirmForm from '@/components/ConfirmForm';
import AdminAddRegistrantForm from '@/components/AdminAddRegistrantForm';
import TestDataControls from '@/components/TestDataControls';
import CsvLink from './CsvLink';
import RegistrationRoster from './RegistrationRoster';

export default async function RegistrationPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const [settings, categories] = await Promise.all([
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const runOpen = openRegistration.bind(null, locale);
  const runClose = closeRegistration.bind(null, locale);
  const toggleGrouping = setAllowRandomGrouping.bind(null, locale, !settings.allowRandomGrouping);

  const catInfo = categories.map((c) => ({ key: c.key, nameEn: c.nameEn, nameHe: c.nameHe, type: c.type }));

  return (
    <div className="space-y-6">
      {/* Registration open/closed toggle — the headline control of this tab */}
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-ink-light">{t('registrationOpenLabel')}:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                settings.registrationOpen ? 'bg-swim/30 text-swim-dark' : 'bg-ink/10 text-ink-light'
              }`}
            >
              {settings.registrationOpen ? t('open') : t('closed')}
            </span>
          </div>
          {settings.registrationOpen ? (
            <ConfirmForm action={runClose} confirmMessage={t('closeRegistrationConfirm')}>
              <button type="submit" className="rounded-full bg-run px-5 py-2 text-sm font-semibold text-white hover:brightness-95">
                {t('closeRegistration')}
              </button>
            </ConfirmForm>
          ) : (
            <ConfirmForm action={runOpen} confirmMessage={t('openRegistrationConfirm')}>
              <button type="submit" className="rounded-full bg-swim px-5 py-2 text-sm font-semibold text-ink hover:brightness-95">
                {t('openRegistration')}
              </button>
            </ConfirmForm>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4 text-sm">
          <span className="text-ink-light">{t('randomGroupingLabel')}:</span>
          <span className="font-semibold">{settings.allowRandomGrouping ? t('open') : t('closed')}</span>
          <form action={toggleGrouping}>
            <button type="submit" className="text-sm font-semibold underline">
              {settings.allowRandomGrouping ? t('disableRandomGrouping') : t('enableRandomGrouping')}
            </button>
          </form>
          <span className="text-xs text-ink-light">· {t('randomGroupingHint')}</span>
        </div>
      </div>

      {/* Add a competitor manually */}
      <AdminAddRegistrantForm categories={catInfo} />

      {/* Editable roster */}
      <RegistrationRoster locale={locale} />

      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/competitors" label={t('exportCompetitors')} />
      </div>

      <TestDataControls locale={locale} />
    </div>
  );
}
