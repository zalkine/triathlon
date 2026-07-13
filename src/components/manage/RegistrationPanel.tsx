import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { openRegistration, closeRegistration } from '@/actions/event';
import ConfirmForm from '@/components/ConfirmForm';
import AdminAddRegistrantForm from '@/components/AdminAddRegistrantForm';
import TestDataControls from '@/components/TestDataControls';
import CsvLink from './CsvLink';
import CompetitorFilters from './CompetitorFilters';
import RegistrationRoster from './RegistrationRoster';

export default async function RegistrationPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const [settings, categories] = await Promise.all([
    prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const runOpen = openRegistration.bind(null, locale);
  const runClose = closeRegistration.bind(null, locale);

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
      </div>

      {/* Add a competitor manually */}
      <AdminAddRegistrantForm categories={catInfo} />

      {/* Filterable overview — checked-in, no team, multi-team, anomalies */}
      <CompetitorFilters />

      {/* Editable roster */}
      <RegistrationRoster locale={locale} />

      <div className="flex flex-wrap gap-3">
        <CsvLink href="/api/export/competitors" label={t('exportCompetitors')} />
      </div>

      <TestDataControls locale={locale} />
    </div>
  );
}
