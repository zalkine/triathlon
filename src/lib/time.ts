// The whole app runs on a single, fixed clock: Israel time. Every displayed
// time — public schedule, live results, timekeeper stations, admin editors —
// is rendered in Asia/Jerusalem regardless of the viewer's device timezone or
// locale, and every time the admin types into a datetime input is interpreted
// as Israel wall-clock time. This keeps a race in Gal-On consistent even if a
// timekeeper's phone or an admin's laptop is set to another timezone.
export const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

// Heats are stored with auto-generated English names ("Heat 1", "Heat 2"). The
// Hebrew UI has no need for English labels, so render "מקצה N" there. Any other
// (manually chosen) name is shown as-is.
export function formatHeatName(name: string, locale: string): string {
  if (locale === 'he') {
    const m = name.match(/^Heat\s+(\d+)$/i);
    if (m) return `מקצה ${m[1]}`;
  }
  return name;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatClock(date: Date | null | undefined, locale: string): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: ISRAEL_TIME_ZONE,
  }).format(date);
}

// Hour:minute only — used for estimated/scheduled times where seconds are noise.
export function formatClockHM(date: Date | null | undefined, locale: string): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ISRAEL_TIME_ZONE,
  }).format(date);
}

// Wall-clock parts of an instant *as seen in Israel* (year/month/…/second).
function israelParts(date: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // Intl renders midnight as "24" in some engines; normalise to 0.
  const h = get('hour');
  return { y: get('year'), mo: get('month'), d: get('day'), h: h === 24 ? 0 : h, mi: get('minute'), s: get('second') };
}

// The value a <input type="datetime-local"> should show for an instant, in
// Israel wall-clock time (so the admin edits Israel time, not their device's).
export function formatDateTimeInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  const { y, mo, d, h, mi, s } = israelParts(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

// Convert Israel wall-clock components to the matching UTC instant, accounting
// for Israel's DST offset at that moment. Used to interpret every datetime the
// admin types as Israel time regardless of their device timezone.
export function israelWallTimeToDate(y: number, mo: number, d: number, h: number, mi: number, s: number): Date {
  // First guess: treat the components as if they were UTC.
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, s);
  // See what Israel clock those components map to, and correct by the offset.
  const shown = israelParts(new Date(utcGuess));
  const shownUtc = Date.UTC(shown.y, shown.mo - 1, shown.d, shown.h, shown.mi, shown.s);
  const offset = shownUtc - utcGuess;
  return new Date(utcGuess - offset);
}

// Parse a <input type="datetime-local"> value ("2026-09-19T14:03:27") as Israel
// wall time and return the ISO instant, or '' for an empty value.
export function israelInputToISO(value: string): string {
  if (!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return '';
  const date = israelWallTimeToDate(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? '0')
  );
  return date.toISOString();
}

// Parse a bare "HH:MM(:SS)" the timekeeper typed as *today's* Israel wall time,
// returning epoch ms (or null if unparseable). `nowMs` anchors "today".
export function israelClockToMs(value: string, nowMs: number = Date.now()): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const { y, mo, d } = israelParts(new Date(nowMs));
  return israelWallTimeToDate(y, mo, d, Number(m[1]), Number(m[2]), Number(m[3] ?? '0')).getTime();
}
