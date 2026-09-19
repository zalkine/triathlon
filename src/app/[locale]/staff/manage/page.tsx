import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import ManageTabs from '@/components/manage/ManageTabs';
import { isManageTabKey, type ManageTabKey } from '@/components/manage/tabs';
import RegistrationPanel from '@/components/manage/RegistrationPanel';
import StaffPanel from '@/components/manage/StaffPanel';
import HeatsPanel from '@/components/manage/HeatsPanel';
import SchedulePanel from '@/components/manage/SchedulePanel';
import ScoresPanel from '@/components/manage/ScoresPanel';
import CompetitionInfoPanel from '@/components/manage/CompetitionInfoPanel';
import TrailsPanel from '@/components/manage/TrailsPanel';
import HofPanel from '@/components/manage/HofPanel';
import InfoPanel from '@/components/manage/InfoPanel';

export const dynamic = 'force-dynamic';

export default async function ManageDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations('manage');
  const locale = await getLocale();
  const { tab } = await searchParams;
  const active: ManageTabKey = isManageTabKey(tab) ? tab : 'registration';

  // A closed year leaves these screens empty on purpose, which looks like
  // something went wrong unless it says so.
  const settings = await prisma.eventSettings.findUnique({ where: { id: 'singleton' } });
  const closedYear = settings?.closedYear ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <p className="text-sm text-ink-light">{t('dashboardSubtitle')}</p>
      </div>

      {closedYear !== null && (
        <p className="rounded-2xl border border-swim-dark/25 bg-swim/10 px-4 py-3 text-sm text-ink">
          🏁 {t('closedBanner', { year: String(closedYear), next: String(closedYear + 1) })}
        </p>
      )}

      <ManageTabs active={active} />

      <div>
        {active === 'registration' && <RegistrationPanel locale={locale} />}
        {active === 'staff' && <StaffPanel locale={locale} />}
        {active === 'heats' && <HeatsPanel locale={locale} />}
        {active === 'schedule' && <SchedulePanel locale={locale} />}
        {active === 'scores' && <ScoresPanel locale={locale} />}
        {active === 'competitionInfo' && <CompetitionInfoPanel locale={locale} />}
        {active === 'trails' && <TrailsPanel locale={locale} />}
        {active === 'hof' && <HofPanel locale={locale} />}
        {active === 'info' && <InfoPanel locale={locale} />}
      </div>
    </div>
  );
}
