import { HISTORICAL_RESULTS, type Family, type HistoricalResult } from '@/data/historical';

export const FAMILY_ORDER: Family[] = ['Elite', 'Amateur', 'Kids', 'Seniors', 'Open'];

const FAMILY_HE: Record<Family, string> = {
  Elite: 'מקצועי',
  Amateur: 'עממי',
  Kids: 'ילדים',
  Seniors: 'גיל הזהב',
  Open: 'כללי',
};

export function familyLabel(family: Family, locale: string): string {
  return locale === 'he' ? FAMILY_HE[family] : family;
}

export function kindLabel(isTeam: boolean, locale: string): string {
  if (locale === 'he') return isTeam ? 'קבוצות' : 'יחידים';
  return isTeam ? 'Teams' : 'Individual';
}

// "0:39:31" -> "39:31"; keeps the hour only when there is one.
export function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export type Bucket = { family: Family; isTeam: boolean };
export type RecordEntry = Bucket & { name: string; year: number; seconds: number };

// Distinct (family, isTeam) buckets that actually have data, in display order.
export function buckets(): Bucket[] {
  const seen = new Set<string>();
  const out: Bucket[] = [];
  for (const family of FAMILY_ORDER) {
    for (const isTeam of [false, true]) {
      const key = `${family}:${isTeam}`;
      if (HISTORICAL_RESULTS.some((r) => r.family === family && r.isTeam === isTeam) && !seen.has(key)) {
        seen.add(key);
        out.push({ family, isTeam });
      }
    }
  }
  return out;
}

export const years = (): number[] =>
  [...new Set(HISTORICAL_RESULTS.map((r) => r.year))].sort((a, b) => b - a);

const fastest = (rows: HistoricalResult[]) =>
  rows.reduce<HistoricalResult | null>((best, r) => (!best || r.seconds < best.seconds ? r : best), null);

// All-time record (fastest ever) for each bucket. Computed by time, since the
// source sheets have a few rank typos.
export function courseRecords(): RecordEntry[] {
  return buckets()
    .map(({ family, isTeam }) => {
      const win = fastest(HISTORICAL_RESULTS.filter((r) => r.family === family && r.isTeam === isTeam));
      return win ? { family, isTeam, name: win.name, year: win.year, seconds: win.seconds } : null;
    })
    .filter((r): r is RecordEntry => r !== null);
}

// The winner (fastest) of each bucket in a given year.
export function championsFor(year: number): RecordEntry[] {
  return buckets()
    .map(({ family, isTeam }) => {
      const win = fastest(HISTORICAL_RESULTS.filter((r) => r.year === year && r.family === family && r.isTeam === isTeam));
      return win ? { family, isTeam, name: win.name, year, seconds: win.seconds } : null;
    })
    .filter((r): r is RecordEntry => r !== null);
}

// Full ranked list for one year+bucket (fastest first).
export function resultsFor(year: number, family: Family, isTeam: boolean): HistoricalResult[] {
  return HISTORICAL_RESULTS.filter((r) => r.year === year && r.family === family && r.isTeam === isTeam).sort(
    (a, b) => a.seconds - b.seconds
  );
}

export type Medalist = { name: string; gold: number; silver: number; bronze: number; total: number };

// Personal medal table across all years, from the individual (solo) races only —
// team podiums can't be reliably attributed to each member. Medals are assigned
// by finishing time within each year+category, matching the rest of the page
// (source rank numbers have occasional typos). Ties share a medal: two athletes
// with the same time both take that place's medal. Names are matched exactly as
// they appear on the sheets, so a person spelled two ways counts twice.
export function medalTable(): Medalist[] {
  const tally = new Map<string, { gold: number; silver: number; bronze: number }>();
  for (const year of years()) {
    for (const family of FAMILY_ORDER) {
      const rows = HISTORICAL_RESULTS.filter((r) => r.year === year && r.family === family && !r.isTeam).sort(
        (a, b) => a.seconds - b.seconds
      );
      // Medal is decided by the *distinct* time: the 1st/2nd/3rd fastest times
      // earn gold/silver/bronze, and everyone on a medal time shares it.
      const medalTimes = [...new Set(rows.map((r) => r.seconds))].slice(0, 3);
      for (const r of rows) {
        const place = medalTimes.indexOf(r.seconds);
        if (place < 0) continue;
        const t = tally.get(r.name) ?? { gold: 0, silver: 0, bronze: 0 };
        if (place === 0) t.gold++;
        else if (place === 1) t.silver++;
        else t.bronze++;
        tally.set(r.name, t);
      }
    }
  }
  return [...tally.entries()]
    .map(([name, t]) => ({ name, ...t, total: t.gold + t.silver + t.bronze }))
    .sort(
      (a, b) =>
        b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || b.total - a.total || a.name.localeCompare(b.name)
    );
}
