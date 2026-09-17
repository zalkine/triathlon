import { prisma } from './db';
import { racingCategories } from './categories';
import { getCategoryResults } from './ranking';
import { loadHofResults } from './hofData';
import { formatHms } from './hallOfFame';
import { formatClock, formatDuration } from './time';

// Every admin download is built here, so the per-list CSV and the one-file Excel
// workbook can never drift apart: each builder returns the sheet exactly once,
// header row first, and the routes only choose how to package it.

export type ExportRows = (string | number | null)[][];

const splitOf = (from: Date | null, to: Date | null): string =>
  from && to ? formatDuration(to.getTime() - from.getTime()) : '';

/** Everyone who signed up, with the bracket they registered in and the field they race in. */
export async function competitorRows(): Promise<ExportRows> {
  const [categories, fields] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { registrants: { orderBy: { createdAt: 'asc' } } },
    }),
    racingCategories(),
  ]);

  // The roster keeps the bracket each person actually registered in — the admin
  // needs it to manage age groups — and names the field they race in beside it,
  // which differs only where brackets have been merged.
  const fieldName = new Map<string, string>();
  for (const f of fields) for (const id of f.memberIds) fieldName.set(id, f.nameEn);

  const rows: ExportRows = [
    ['Category', 'Races as', 'Name', 'Age', 'Type', 'Group preference', 'Swim', 'Bike', 'Run', 'Checked in', 'Registered at'],
  ];
  for (const cat of categories) {
    for (const r of cat.registrants) {
      rows.push([
        cat.nameEn,
        fieldName.get(cat.id) ?? cat.nameEn,
        r.name,
        r.age ?? '',
        r.mode,
        r.groupPref ?? '',
        r.legSwim ? 'Y' : '',
        r.legBike ? 'Y' : '',
        r.legRun ? 'Y' : '',
        r.checkedIn ? 'Y' : '',
        r.createdAt.toISOString(),
      ]);
    }
  }
  return rows;
}

/**
 * The relay teams as they currently stand — available from the moment groups
 * start forming, so team sheets can be printed before the lottery has built any
 * heats. An open leg ("will be added later") shows as a blank, and the team is
 * marked incomplete so the gaps are easy to filter for.
 */
export async function teamRows(): Promise<ExportRows> {
  const [groups, registrants, fields] = await Promise.all([
    prisma.group.findMany({ include: { category: true }, orderBy: { createdAt: 'asc' } }),
    prisma.registrant.findMany(),
    racingCategories(),
  ]);

  const byId = new Map(registrants.map((r) => [r.id, r]));
  const fieldName = new Map<string, string>();
  for (const f of fields) for (const id of f.memberIds) fieldName.set(id, f.nameEn);

  // A team's heat, once one has been built for it.
  const entryIds = groups.map((g) => g.entryId).filter((id): id is string => !!id);
  const entries =
    entryIds.length > 0
      ? await prisma.entry.findMany({ where: { id: { in: entryIds } }, include: { heat: true } })
      : [];
  const heatOfEntry = new Map(entries.map((e) => [e.id, e.heat.name]));

  const rows: ExportRows = [
    ['Category', 'Races as', 'Team', 'Swim', 'Bike', 'Run', 'Complete', 'Checked in', 'Heat'],
  ];

  for (const g of groups) {
    const legs = [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId].map((id) =>
      id ? byId.get(id) ?? null : null
    );
    // A group with every leg cleared isn't a team — it's a blank row the admin
    // can still fill in, and it would only export as an empty line.
    if (legs.every((m) => !m)) continue;

    const names = legs.map((m) => m?.name ?? '');
    const filled = legs.filter((m) => m);
    rows.push([
      g.category.nameEn,
      fieldName.get(g.categoryId) ?? g.category.nameEn,
      [...new Set(filled.map((m) => m!.name))].join(' / '),
      names[0],
      names[1],
      names[2],
      filled.length === 3 ? 'Y' : '',
      `${filled.filter((m) => m!.checkedIn).length}/${filled.length}`,
      (g.entryId && heatOfEntry.get(g.entryId)) || '',
    ]);
  }
  return rows;
}

/** Every heat in race order, with its combined-start group and each entry. */
export async function heatListRows(): Promise<ExportRows> {
  const fields = await racingCategories();
  const heats = await prisma.heat.findMany({
    orderBy: [{ estimatedStart: 'asc' }, { createdAt: 'asc' }],
    include: { entries: { orderBy: { createdAt: 'asc' }, include: { members: true } } },
  });

  // Number the combined starts so the sheet shows which heats leave together;
  // an uncombined heat leaves the column blank.
  const waveNumbers = new Map<string, number>();
  for (const heat of heats) {
    if (heat.waveId && !waveNumbers.has(heat.waveId)) waveNumbers.set(heat.waveId, waveNumbers.size + 1);
  }

  const rows: ExportRows = [
    ['Category', 'Heat', 'Combined start', 'Estimated start', 'Actual start', 'Entry', 'Swim', 'Bike', 'Run', 'Scratched'],
  ];

  for (const field of fields) {
    for (const heat of heats.filter((h) => field.memberIds.includes(h.categoryId))) {
      for (const entry of heat.entries) {
        const member = (leg: string) => entry.members.find((m) => m.leg === leg)?.name ?? '';
        rows.push([
          field.nameEn,
          heat.name,
          heat.waveId ? `Combined ${waveNumbers.get(heat.waveId)}` : '',
          heat.estimatedStart ? formatClock(heat.estimatedStart, 'en') : '',
          heat.startTime ? formatClock(heat.startTime, 'en') : '',
          entry.name,
          field.type === 'TEAM' ? member('SWIM') : '',
          field.type === 'TEAM' ? member('BIKE') : '',
          field.type === 'TEAM' ? member('RUN') : '',
          entry.scratched ? 'Y' : '',
        ]);
      }
    }
  }
  return rows;
}

/** Ranked results per racing field, with every split. */
export async function resultRows(): Promise<ExportRows> {
  const categories = await racingCategories();

  const rows: ExportRows = [
    [
      'Category', 'Heat', 'Rank', 'Name', 'Status',
      'Start', 'Swim finish', 'Bike finish', 'Run finish',
      'Swim split', 'Bike split', 'Run split', 'Total',
    ],
  ];

  for (const cat of categories) {
    const result = await getCategoryResults(cat.id);
    if (!result) continue;
    for (const e of result.ranked) {
      rows.push([
        cat.nameEn,
        e.heatName,
        e.rank ?? '',
        e.name,
        e.status,
        e.startTime ? formatClock(e.startTime, 'en') : '',
        e.swimTime ? formatClock(e.swimTime, 'en') : '',
        e.bikeTime ? formatClock(e.bikeTime, 'en') : '',
        e.runTime ? formatClock(e.runTime, 'en') : '',
        splitOf(e.startTime, e.swimTime),
        splitOf(e.swimTime, e.bikeTime),
        splitOf(e.bikeTime, e.runTime),
        e.totalMs != null ? formatDuration(e.totalMs) : '',
      ]);
    }
  }
  return rows;
}

/** The race-day contact directory. */
export async function contactRows(): Promise<ExportRows> {
  const contacts = await prisma.contact.findMany({ orderBy: { sortOrder: 'asc' } });
  const rows: ExportRows = [['Role', 'Name', 'Phone']];
  for (const c of contacts) rows.push([c.role, c.name, c.phone]);
  return rows;
}

/** Historical results behind the Hall of Fame. */
export async function hofRows(): Promise<ExportRows> {
  const results = await loadHofResults();
  const rows: ExportRows = [
    ['Year', 'Category', 'Family', 'Type', 'Rank', 'Name', 'Members', 'Time', 'Seconds'],
  ];
  for (const r of results) {
    rows.push([
      r.year,
      r.categoryHe,
      r.family,
      r.isTeam ? 'Team' : 'Individual',
      r.rank ?? '',
      r.name,
      (r.members ?? []).join(' / '),
      formatHms(r.seconds),
      r.seconds,
    ]);
  }
  return rows;
}

/**
 * Every list in one workbook, in the order an organiser works through them.
 * Built in parallel because each is an independent read.
 */
export async function allExportSheets(): Promise<{ name: string; rows: ExportRows }[]> {
  const [competitors, teams, heats, results, contacts, hof] = await Promise.all([
    competitorRows(),
    teamRows(),
    heatListRows(),
    resultRows(),
    contactRows(),
    hofRows(),
  ]);
  return [
    { name: 'Competitors', rows: competitors },
    { name: 'Teams', rows: teams },
    { name: 'Heats', rows: heats },
    { name: 'Results', rows: results },
    { name: 'Contacts', rows: contacts },
    { name: 'Hall of Fame', rows: hof },
  ];
}
