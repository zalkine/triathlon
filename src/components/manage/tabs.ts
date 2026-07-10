// Shared definition of the admin management tabs, in competition sequence.
export const MANAGE_TABS = [
  { key: 'registration', icon: '📝', labelKey: 'tabRegistration' },
  { key: 'staff', icon: '👥', labelKey: 'tabStaff' },
  { key: 'heats', icon: '🏁', labelKey: 'tabHeats' },
  { key: 'schedule', icon: '🕐', labelKey: 'tabSchedule' },
  { key: 'scores', icon: '🏅', labelKey: 'tabScores' },
  { key: 'competitionInfo', icon: 'ℹ️', labelKey: 'tabCompetitionInfo' },
  { key: 'trails', icon: '🥾', labelKey: 'tabTrails' },
  { key: 'hof', icon: '🏆', labelKey: 'tabHof' },
  { key: 'info', icon: '🗺️', labelKey: 'tabInfo' },
] as const;

export type ManageTabKey = (typeof MANAGE_TABS)[number]['key'];

export const MANAGE_TAB_KEYS = MANAGE_TABS.map((t) => t.key) as ManageTabKey[];

export function isManageTabKey(value: string | undefined): value is ManageTabKey {
  return !!value && (MANAGE_TAB_KEYS as string[]).includes(value);
}
