import { getLocale, getTranslations } from 'next-intl/server';
import ManageTabs from '@/components/manage/ManageTabs';
import { isManageTabKey, type ManageTabKey } from '@/components/manage/tabs';
import RegistrationPanel from '@/components/manage/RegistrationPanel';
import StaffPanel from '@/components/manage/StaffPanel';
import HeatsPanel from '@/components/manage/HeatsPanel';
import SchedulePanel from '@/components/manage/SchedulePanel';
import ScoresPanel from '@/components/manage/ScoresPanel';
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <p className="text-sm text-ink-light">{t('dashboardSubtitle')}</p>
      </div>

      <ManageTabs active={active} />

      <div>
        {active === 'registration' && <RegistrationPanel locale={locale} />}
        {active === 'staff' && <StaffPanel locale={locale} />}
        {active === 'heats' && <HeatsPanel locale={locale} />}
        {active === 'schedule' && <SchedulePanel locale={locale} />}
        {active === 'scores' && <ScoresPanel locale={locale} />}
        {active === 'hof' && <HofPanel locale={locale} />}
        {active === 'info' && <InfoPanel locale={locale} />}
      </div>
    </div>
  );
}
