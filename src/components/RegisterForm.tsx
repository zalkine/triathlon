'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormStatus, useFormState } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import type { RegisterState } from '@/actions/registrants';

type FormAction = (prevState: RegisterState | undefined, formData: FormData) => Promise<RegisterState>;
type CategoryInfo = { key: string; nameEn: string; nameHe: string };
type Teammate = { id: string; name: string; age: number; legSwim: boolean; legBike: boolean; legRun: boolean };
type OpenGroup = { id: string; swim: string | null; bike: string | null; run: string | null; openLegs: string[] };

const LATER = 'LATER';
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
  const [selected, setSelected] = useState<string[]>([]);
  const [roleSwim, setRoleSwim] = useState('');
  const [roleBike, setRoleBike] = useState('');
  const [roleRun, setRoleRun] = useState('');

  // "join an open group" flow
  const [openGroups, setOpenGroups] = useState<OpenGroup[]>([]);
  const [joinGroupId, setJoinGroupId] = useState('');
  const [joinLeg, setJoinLeg] = useState('');

  const ageNum = Number(age);
  // Registration opens at 8. Young members (8–12) may enter any race — pro,
  // intermediate, or their kids bracket; over-12 may only go pro/intermediate.
  const validAge = age !== '' && Number.isInteger(ageNum) && ageNum >= 8;
  const canPickKids = validAge && ageNum <= 12;
  const bracket = !validAge
    ? null
    : skillLevel === 'KIDS'
      ? ageNum < 9
        ? 'KIDS_6_9'
        : 'KIDS_9_12'
      : skillLevel;
  const categoryKey = bracket ? `${bracket}_${mode}` : '';

  // Drop back to a valid level if the age no longer permits the kids race.
  useEffect(() => {
    if (skillLevel === 'KIDS' && !canPickKids) setSkillLevel('PRO');
  }, [canPickKids, skillLevel]);

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

  // Clear a stale join selection if the group/leg is no longer offered.
  useEffect(() => {
    if (!openGroups.some((g) => g.id === joinGroupId && g.openLegs.includes(joinLeg))) {
      setJoinGroupId('');
      setJoinLeg('');
    }
    if (openGroups.length === 0) setGroupMode('CREATE');
  }, [openGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Options for the role dropdowns: me (captain) + picked teammates + "later".
  const roleOptions = useMemo(() => {
    const opts = [{ value: 'CAPTAIN', label: `${t('me')}${name ? ` (${name})` : ''}` }];
    for (const id of selected) {
      const tm = pool.find((p) => p.id === id);
      if (tm) opts.push({ value: id, label: tm.name });
    }
    opts.push({ value: LATER, label: t('roleLater') });
    return opts;
  }, [selected, pool, name, t]);

  const toggleTeammate = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        [roleSwim, roleBike, roleRun].forEach((r, i) => {
          if (r === id) [setRoleSwim, setRoleBike, setRoleRun][i]('');
        });
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) return prev; // max 2 teammates (3 people total)
      return [...prev, id];
    });
  };

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
      <input type="hidden" name="teammateIds" value={JSON.stringify(selected)} readOnly />
      <input type="hidden" name="roleSwim" value={roleSwim} readOnly />
      <input type="hidden" name="roleBike" value={roleBike} readOnly />
      <input type="hidden" name="roleRun" value={roleRun} readOnly />
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
        <label className="mb-1 block text-sm font-medium" htmlFor="age">
          {t('age')}
        </label>
        <input
          id="age"
          name="age"
          type="number"
          min={8}
          max={110}
          required
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full rounded-lg border border-ink/20 px-4 py-2 focus:border-ink focus:outline-none"
        />
      </div>

      {validAge && (
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
            {canPickKids && <option value="KIDS">{t('kids')}</option>}
          </select>
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
                <>
                  <div>
                    <p className="mb-2 text-sm">{t('pickTeammates')}</p>
                    {pool.length === 0 ? (
                      <p className="text-sm text-ink-light">{t('noTeammates')}</p>
                    ) : (
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink/10 p-2">
                        {pool.map((tm) => (
                          <label key={tm.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.includes(tm.id)}
                              disabled={!selected.includes(tm.id) && selected.length >= 2}
                              onChange={() => toggleTeammate(tm.id)}
                            />
                            {tm.name}
                            <span className="text-ink-light">· {tm.age}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm">{t('assignRoles')}</p>
                    <div className="space-y-2">
                      {(
                        [
                          ['roleSwimLabel', roleSwim, setRoleSwim],
                          ['roleBikeLabel', roleBike, setRoleBike],
                          ['roleRunLabel', roleRun, setRoleRun],
                        ] as const
                      ).map(([labelKey, val, setter]) => (
                        <div key={labelKey} className="flex items-center gap-2">
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
                      ))}
                    </div>
                  </div>
                </>
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
