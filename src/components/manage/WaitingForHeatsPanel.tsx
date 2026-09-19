import { getTranslations } from 'next-intl/server';
import { waitingForHeats } from '@/lib/placement';
import WaitingForHeatsControls from './WaitingForHeatsControls';

// Everyone registered who has no place in a heat yet. Without this the gap is
// invisible: a relay team that formed after the heats were built simply never
// appears on the board, and the only thing that would have placed it is the
// schedule generator — which an admin arranging heats by hand never runs.
export default async function WaitingForHeatsPanel({ locale }: { locale: string }) {
  const t = await getTranslations('manage');
  const fields = await waitingForHeats();
  if (fields.length === 0) return null;

  const total = fields.reduce((n, f) => n + f.items.length, 0);

  return (
    <div className="rounded-2xl border border-bike-dark/40 bg-bike/10 p-5 space-y-3">
      <div>
        <h2 className="font-semibold">
          ⚠ {t('waitingForHeatsTitle')} <span className="font-normal text-ink-light">({total})</span>
        </h2>
        <p className="mt-1 text-sm text-ink-light">{t('waitingForHeatsHint')}</p>
      </div>
      <WaitingForHeatsControls
        fields={fields.map((f) => ({
          id: f.id,
          name: locale === 'he' ? f.nameHe : f.nameEn,
          heats: f.heats,
          items: f.items,
        }))}
      />
    </div>
  );
}
