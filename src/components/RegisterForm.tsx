'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormStatus, useFormState } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import type { RegisterState } from '@/actions/registrants';

type FormAction = (prevState: RegisterState | undefined, formData: FormData) => Promise<RegisterState>;
type CategoryInfo = { key: string; nameEn: string; nameHe: string };
type Teammate = { id: string; name: string; legSwim: boolean; legBike: boolean; legRun: boolean };
type OpenGroup = { id: string; swim: string | null; bike: string | null; run: string | null; openLegs: string[] };

const LATER = 'LATER';
const NEW = 'NEW';
const legLabelKey = { SWIM: 'roleSwimLabel', BIKE: 'roleBikeLabel', RUN: 'roleRunLabel' } as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-run px-6 py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export default function RegisterForm({ action, categories }: { action: FormAction; categories: CategoryInfo[] }) {
  const t = useTranslations('register');
  const locale = useLocale();
  const [state, formAction] = useFormState(action, undefined);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [skillLevel, setSkillLevel] = useState<'PRO' | 'INTER' | 'KIDS'>('PRO');
  const [mode, setMode] = useState<'SINGLE' | 'TEAM'>('SINGLE');

  // available-pool willing legs
  const [legSwim, setLegSwim] = useState(false);
  const [legBike, setLegBike] = useState(false);
  const [legRun, setLegRun] = useState(false);

  // group choice + captain flow
  const [groupChoice, setGroupChoice] = useState<'AVAILABLE' | 'HAS_GROUP'>('AVAILABLE');
  const [groupMode, setGroupMode] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [pool, setPool] = useState<Teammate[]>([]);
  // Each leg holds a "kind" (CAPTAIN | pool id | NEW | LATER | '') plus, when NEW,
  // the typed teammate name.
  const [roleSwim, setRoleSwim] = useState('');
  const [roleBike, setRoleBike] = useState('');
  const [roleRun, setRoleRun] = useState('');
  const [nameSwim, setNameSwim] = useState('');
  const [nameBike, setNameBike] = useState('');
  const [nameRun, setNameRun] = useState('');

  // "join an open group" flow
  const [openGroups, setOpenGroups] = useState<OpenGroup[]>([]);
  const [joinGroupId, setJoinGroupId] = useState('');
  const [joinLeg, setJoinLeg] = useState('');

  // Age is only needed for the children's brackets (it splits 6–9 / 9–12).
  const isKids = skillLevel === 'KIDS';
  const ageNum = Number(age);
  const validKidsAge = age !== '' && Number.isInteger(ageNum) && ageNum >= 6 && ageNum <= 12;
  const bracket = isKids ? (validKidsAge ? (ageNum < 9 ? 'KIDS_6_9' : 'KIDS_9_12') : null) : skillLevel;
  const categoryKey = bracket ? `${bracket}_${mode}` : '';

  const categoryName = useMemo(() => {
    const match = categories.find((c) => c.key === categoryKey);
    return match ? (locale === 'he' ? match.nameHe : match.nameEn) : '';
  }, [categories, categoryKey, locale]);

  const formingGroup = mode === 'TEAM' && groupChoice === 'HAS_GROUP' && !!categoryKey;

  // Load the available pool for the chosen category when forming a group.
  useEffect(() => {
    if (!formingGroup) {
      setPool([]);
      return;
    }
    let active = true;
    fetch(`/api/available-teammates?category=${categoryKey}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active) setPool(d.available ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [formingGroup, categoryKey]);

  // Load open groups (started by a teammate) that this person could join.
  useEffect(() => {
    if (!formingGroup) {
      setOpenGroups([]);
      return;
    }
    let active = true;
    fetch(`/api/open-groups?category=${categoryKey}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active) setOpenGroups(d.groups ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [formingGroup, categoryKey]);

  // Reset the captain's leg assignments when the category changes: a pool
  // teammate picked for the old category isn't valid for the new one.
  useEffect(() => {
    setRoleSwim('');
    setRoleBike('');
    setRoleRun('');
    setNameSwim('');
    setNameBike('');
    setNameRun('');
  }, [categoryKey]);

  // Clear a stale join selection if the group/leg is no longer offered.
  useEffect(() => {
    if (!openGroups.some((g) => g.id === joinGroupId && g.openLegs.includes(joinLeg))) {
      setJoinGroupId('');
      setJoinLeg('');
    }
    if (openGroups.length === 0) setGroupMode('CREATE');
  }, [openGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Options for the role dropdowns: me (captain), any registered available
  // teammate, a teammate I'll name now, or "will be added later".
  const roleOptions = useMemo(() => {
    const opts = [{ value: 'CAPTAIN', label: `${t('me')}${name ? ` (${name})` : ''}` }];
    for (const tm of pool) opts.push({ value: tm.id, label: tm.name });
    opts.push({ value: NEW, label: t('roleNew') });
    opts.push({ value: LATER, label: t('roleLater') });
    return opts;
  }, [pool, name, t]);

  if (state?.success) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-lg font-semibold text-swim-dark">{t('success')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border-2 border-ink/20 px-6 py-2 font-semibold hover:bg-ink/5"
        >
          {t('registerAnother')}
        </button>
      </div>
    );
  }

  const errorText = (e: string) =>
    ({
      closed: t('errorClosed'),
      'no-leg': t('errorNoLeg'),
      'roles-incomplete': t('errorRolesIncomplete'),
      'roles-invalid': t('errorRolesInvalid'),
      'captain-role': t('errorCaptainRole'),
      'bad-teammate': t('errorBadTeammate'),
      'join-leg': t('errorJoinLeg'),
      'join-taken': t('errorJoinTaken'),
    })[e] ?? t('errorInvalid');

  const groupSummary = (g: OpenGroup) =>
    (['SWIM', 'BIKE', 'RUN'] as const)
      .map((leg) => {
        const who = leg === 'SWIM' ? g.swim : leg === 'BIKE' ? g.bike : g.run;
        return `${t(legLabelKey[leg])}: ${who ?? t('openLeg')}`;
      })
      .join(' · ');

  return (
    <form action={formAction} className="w-full max-w-md space-y-5">
      <input type="hidden" name="categoryKey" value={categoryKey} readOnly />
      <input type="hidden" name="groupChoice" value={mode === 'TEAM' ? groupChoice : ''} readOnly />
      <input type="hidden" name="groupMode" value={formingGroup ? groupMode : ''} readOnly />
      <input type="hidden" name="roleSwim" value={roleSwim} readOnly />
      <input type="hidden" name="roleBike" value={roleBike} readOnly />
      <input type="hidden" name="roleRun" value={roleRun} readOnly />
      <input type="hidden" name="roleSwimName" value={nameSwim} readOnly />
      <input type="hidden" name="roleBikeName" value={nameBike} readOnly />
      <input type="hidden" name="roleRunName" value={nameRun} readOnly />
      <input type="hidden" name="joinGroupId" value={joinGroupId} readOnly />
      <input type="hidden" name="joinLeg" value={joinLeg} readOnly />

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="name">
          {t('name')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="skillLevel">
          {t('skillLevel')}
        </label>
        <select
          id="skillLevel"
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value as 'PRO' | 'INTER' | 'KIDS')}
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        >
          <option value="PRO">{t('professional')}</option>
          <option value="INTER">{t('intermediate')}</option>
          <option value="KIDS">{t('kids')}</option>
        </select>
      </div>

      {/* Age is asked only for the kids race, to place them in the 6–9 / 9–12 bracket. */}
      {isKids && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="age">
            {t('age')}
          </label>
          <input
            id="age"
            name="age"
            type="number"
            min={6}
            max={12}
            required
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
          />
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium">{t('modeLabel')}</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="modeDisplay" checked={mode === 'SINGLE'} onChange={() => setMode('SINGLE')} />
            {t('single')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="modeDisplay" checked={mode === 'TEAM'} onChange={() => setMode('TEAM')} />
            {t('team')}
          </label>
        </div>
      </div>

      {mode === 'TEAM' && (
        <div className="space-y-4 rounded-xl border border-ink/10 bg-white/50 p-4">
          <div>
            <span className="mb-2 block text-sm font-medium">{t('groupChoiceLabel')}</span>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="radio" checked={groupChoice === 'AVAILABLE'} onChange={() => setGroupChoice('AVAILABLE')} />
                {t('chooseAvailable')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={groupChoice === 'HAS_GROUP'} onChange={() => setGroupChoice('HAS_GROUP')} />
                {t('chooseHasGroup')}
              </label>
            </div>
          </div>

          {groupChoice === 'AVAILABLE' && (
            <div>
              <p className="mb-2 text-sm">{t('legsPrompt')}</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="legSwim" checked={legSwim} onChange={(e) => setLegSwim(e.target.checked)} />
                  {t('legSwim')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="legBike" checked={legBike} onChange={(e) => setLegBike(e.target.checked)} />
                  {t('legBike')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="legRun" checked={legRun} onChange={(e) => setLegRun(e.target.checked)} />
                  {t('legRun')}
                </label>
              </div>
            </div>
          )}

          {groupChoice === 'HAS_GROUP' && (
            <div className="space-y-4">
              {/* Start a new group, or join one a teammate already opened. */}
              {openGroups.length > 0 && (
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={groupMode === 'CREATE'} onChange={() => setGroupMode('CREATE')} />
                    {t('groupModeCreate')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={groupMode === 'JOIN'} onChange={() => setGroupMode('JOIN')} />
                    {t('groupModeJoin')}
                  </label>
                </div>
              )}

              {groupMode === 'JOIN' && openGroups.length > 0 && (
                <div>
                  <p className="mb-2 text-sm">{t('joinPrompt')}</p>
                  <div className="space-y-2">
                    {openGroups.map((g) => (
                      <div key={g.id} className="rounded-lg border border-ink/10 p-2">
                        <p className="mb-1 text-sm text-ink-light">{groupSummary(g)}</p>
                        <div className="flex flex-wrap gap-3">
                          {g.openLegs.map((leg) => (
                            <label key={leg} className="flex items-center gap-1.5 text-sm">
                              <input
                                type="radio"
                                name="joinPick"
                                checked={joinGroupId === g.id && joinLeg === leg}
                                onChange={() => {
                                  setJoinGroupId(g.id);
                                  setJoinLeg(leg);
                                }}
                              />
                              {t(legLabelKey[leg as keyof typeof legLabelKey])}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {groupMode === 'CREATE' && (
                <div>
                  <p className="mb-2 text-sm">{t('assignRoles')}</p>
                  <div className="space-y-2">
                    {(
                      [
                        ['roleSwimLabel', roleSwim, setRoleSwim, nameSwim, setNameSwim],
                        ['roleBikeLabel', roleBike, setRoleBike, nameBike, setNameBike],
                        ['roleRunLabel', roleRun, setRoleRun, nameRun, setNameRun],
                      ] as const
                    ).map(([labelKey, val, setter, nameVal, nameSetter]) => (
                      <div key={labelKey} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-sm">{t(labelKey)}</span>
                          <select
                            value={val}
                            onChange={(e) => setter(e.target.value)}
                            className="flex-1 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"
                          >
                            <option value="">—</option>
                            {roleOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {val === NEW && (
                          <input
                            type="text"
                            value={nameVal}
                            onChange={(e) => nameSetter(e.target.value)}
                            placeholder={t('teammateNamePlaceholder')}
                            className="ml-[calc(5rem+0.5rem)] w-[calc(100%-5.5rem)] rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-light">{t('createGroupHint')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {categoryName && <p className="text-sm text-ink-light">{t('kidsCategoryNote', { category: categoryName })}</p>}

      {state?.error && <p className="text-sm text-run-dark">{errorText(state.error)}</p>}

      <SubmitButton label={t('submit')} />
    </form>
  );
}
