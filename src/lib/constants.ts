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
];

// Max competitors/teams scheduled into a single heat (pool holds 8 lanes at once).
export const HEAT_CAPACITY = 8;
