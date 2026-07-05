import { getTranslations } from 'next-intl/server';
import { addMember, removeMember } from '@/actions/entries';
import ConfirmForm from './ConfirmForm';

type Member = { id: string; name: string; leg: string | null };

export default async function MembersEditor({
  locale,
  heatId,
  entryId,
  members,
}: {
  locale: string;
  heatId: string;
  entryId: string;
  members: Member[];
}) {
  const t = await getTranslations('manage');
  const legLabel = (leg: string | null) => (leg === 'SWIM' ? t('legSwim') : leg === 'BIKE' ? t('legBike') : leg === 'RUN' ? t('legRun') : '');
  const addAction = addMember.bind(null, locale, heatId, entryId);

  return (
    <div className="mt-2 space-y-2 border-t border-ink/5 pt-2">
      <ul className="flex flex-wrap gap-2">
        {members.map((m) => {
          const removeAction = removeMember.bind(null, locale, heatId, m.id);
          return (
            <li key={m.id} className="flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 text-xs">
              <span>
                {m.name}
                {m.leg ? ` · ${legLabel(m.leg)}` : ''}
              </span>
              <form action={removeAction}>
                <button className="font-bold text-run-dark" aria-label={t('remove')}>
                  ×
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <form action={addAction} className="flex flex-wrap items-center gap-2">
        <input
          name="name"
          type="text"
          required
          placeholder={t('memberName')}
          className="rounded border border-ink/20 px-2 py-1 text-sm"
        />
        <select name="leg" className="rounded border border-ink/20 px-2 py-1 text-sm">
          <option value="SWIM">{t('legSwim')}</option>
          <option value="BIKE">{t('legBike')}</option>
          <option value="RUN">{t('legRun')}</option>
        </select>
        <button type="submit" className="text-xs font-semibold underline">
          {t('addMember')}
        </button>
      </form>
    </div>
  );
}
