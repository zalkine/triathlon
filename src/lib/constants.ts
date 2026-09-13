export const ROLES = ['ADMIN', 'TIMEKEEPER'] as const;
export type Role = (typeof ROLES)[number];

export const ENTRY_TYPES = ['SINGLE', 'TEAM'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const LEGS = ['SWIM', 'BIKE', 'RUN'] as const;
export type Leg = (typeof LEGS)[number];

export const STATIONS = ['start', 'swim', 'bike', 'run'] as const;
export type Station = (typeof STATIONS)[number];

export const STATION_FIELD: Record<Exclude<Station, 'start'>, 'swimTime' | 'bikeTime' | 'runTime'> = {
  swim: 'swimTime',
  bike: 'bikeTime',
  run: 'runTime',
};

// The toddlers fun run (מרוץ קטנטנים) — its own category, referenced by key from
// the registration form and from every race-day filter.
export const TODDLERS_CATEGORY_KEY = 'TODDLERS_RUN';

export const CATEGORY_DEFINITIONS: Array<{
  key: string;
  nameEn: string;
  nameHe: string;
  type: EntryType;
  sortOrder: number;
  estDurationMinutes: number;
}> = [
  // estDurationMinutes = pool wave time per heat (the pool is the bottleneck).
  { key: 'PRO_SINGLE', nameEn: 'Professional – Singles', nameHe: 'מקצוענים - יחידים', type: 'SINGLE', sortOrder: 1, estDurationMinutes: 9 },
  { key: 'PRO_TEAM', nameEn: 'Professional – Groups', nameHe: 'מקצוענים - קבוצות', type: 'TEAM', sortOrder: 2, estDurationMinutes: 9 },
  { key: 'INTER_SINGLE', nameEn: 'Intermediate – Singles', nameHe: 'עממי - יחידים', type: 'SINGLE', sortOrder: 3, estDurationMinutes: 4 },
  { key: 'INTER_TEAM', nameEn: 'Intermediate – Groups', nameHe: 'עממי - קבוצות', type: 'TEAM', sortOrder: 4, estDurationMinutes: 4 },
  { key: 'KIDS_6_9_SINGLE', nameEn: 'Children – Singles 6-9', nameHe: 'ילדים - יחידים 6-9', type: 'SINGLE', sortOrder: 5, estDurationMinutes: 2 },
  { key: 'KIDS_6_9_TEAM', nameEn: 'Children – Groups 6-9', nameHe: 'ילדים - קבוצות 6-9', type: 'TEAM', sortOrder: 6, estDurationMinutes: 2 },
  { key: 'KIDS_9_12_SINGLE', nameEn: 'Children – Singles 9-12', nameHe: 'ילדים - יחידים 9-12', type: 'SINGLE', sortOrder: 7, estDurationMinutes: 1.5 },
  { key: 'KIDS_9_12_TEAM', nameEn: 'Children – Groups 9-12', nameHe: 'ילדים - קבוצות 9-12', type: 'TEAM', sortOrder: 8, estDurationMinutes: 1.5 },
  // The toddlers run is a registration-only fun run (see REGISTRATION_ONLY_CATEGORY_KEYS):
  // no age bracket, no heats and no timing, so estDurationMinutes is never used.
  { key: TODDLERS_CATEGORY_KEY, nameEn: 'Toddlers Run', nameHe: 'מרוץ קטנטנים', type: 'SINGLE', sortOrder: 9, estDurationMinutes: 0 },
];

// Categories that collect sign-ups only. They appear on the registration form and
// in the admin roster, but are deliberately left out of everything race-day: no
// check-in, no heats, no schedule, no timing stations and no ranked results.
export const REGISTRATION_ONLY_CATEGORY_KEYS: readonly string[] = [TODDLERS_CATEGORY_KEY];

export function isRegistrationOnlyCategory(key: string): boolean {
  return REGISTRATION_ONLY_CATEGORY_KEYS.includes(key);
}

// Race-day colour coding for the finish line: one tint per timed category, so the
// timekeeper can see at a glance which race the competitor in front of them is
// running. Singles and groups of the same race share a hue at two lightness
// levels. The classes themselves live in globals.css (they flip for dark mode);
// a category with no entry here — the registration-only toddlers run, or any
// category added later — falls back to the plain card background.
export const CATEGORY_COLOR_CLASS: Record<string, string> = {
  PRO_SINGLE: 'cat-pro-single',
  PRO_TEAM: 'cat-pro-team',
  INTER_SINGLE: 'cat-inter-single',
  INTER_TEAM: 'cat-inter-team',
  KIDS_6_9_SINGLE: 'cat-kids69-single',
  KIDS_6_9_TEAM: 'cat-kids69-team',
  KIDS_9_12_SINGLE: 'cat-kids912-single',
  KIDS_9_12_TEAM: 'cat-kids912-team',
};

export function categoryColorClass(key: string | null | undefined): string {
  return (key && CATEGORY_COLOR_CLASS[key]) || '';
}

// Max competitors/teams scheduled into a single heat (pool holds 8 lanes at once).
export const HEAT_CAPACITY = 8;
