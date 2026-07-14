'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { chunk, computeEstimatedStarts } from '@/lib/schedule';
import { HEAT_CAPACITY, LEGS, type Leg } from '@/lib/constants';

const LEG_FIELD: Record<Leg, 'swimRegistrantId' | 'bikeRegistrantId' | 'runRegistrantId'> = {
  SWIM: 'swimRegistrantId',
  BIKE: 'bikeRegistrantId',
  RUN: 'runRegistrantId',
};

export async function openRegistration(locale: string) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({
    where: { id: 'singleton' },
    data: { registrationOpen: true },
  });
  revalidatePath('/', 'layout');
}

export async function closeRegistration(locale: string) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({
    where: { id: 'singleton' },
    data: { registrationOpen: false },
  });
  revalidatePath('/', 'layout');
}

export async function activateCompetition(locale: string) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { competitionActive: true } });
  revalidatePath('/', 'layout');
}

export async function setAllowRandomGrouping(locale: string, allow: boolean) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { allowRandomGrouping: allow } });
  revalidatePath(`/${locale}/staff/manage`);
  revalidatePath(`/${locale}/register`);
}

export async function setPublicResultsVisible(locale: string, visible: boolean) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { publicResultsVisible: visible } });
  revalidatePath('/', 'layout');
}

export async function setSchedulePublished(locale: string, published: boolean) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { schedulePublished: published } });
  revalidatePath('/', 'layout');
}

// Admin sign-off on the timekeepers' results. The public results page only
// shows results once they are approved AND set visible.
export async function setResultsApproved(locale: string, approved: boolean) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { resultsApproved: approved } });
  revalidatePath('/', 'layout');
}

export async function setRaceStartTime(locale: string, formData: FormData) {
  await requireRole('ADMIN');
  const iso = formData.get('iso') as string;
  if (!iso) return;
  // Race start is minute-precision; drop any seconds so estimated heat times stay clean.
  const start = new Date(iso);
  start.setSeconds(0, 0);
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { raceStartTime: start } });
  revalidatePath(`/${locale}/staff/manage`);
}

export async function setHeatGapMinutes(locale: string, formData: FormData) {
  await requireRole('ADMIN');
  const minutes = parseInt(formData.get('minutes') as string, 10);
  if (isNaN(minutes) || minutes < 0) return;
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { heatGapMinutes: minutes } });
  revalidatePath(`/${locale}/staff/manage`);
}

type GroupRow = { id: string; swimRegistrantId: string | null; bikeRegistrantId: string | null; runRegistrantId: string | null };

// Create one heat entry (with its three leg members) for a relay group and link
// the group to it. An open leg becomes a "—" placeholder the admin can fill later.
async function createGroupEntry(heatId: string, group: GroupRow, nameOf: Map<string, string>) {
  const legMembers = (
    [
      ['SWIM', group.swimRegistrantId],
      ['BIKE', group.bikeRegistrantId],
      ['RUN', group.runRegistrantId],
    ] as const
  ).map(([leg, registrantId]) => ({
    leg,
    registrantId,
    name: registrantId ? nameOf.get(registrantId) ?? '?' : '—',
  }));
  const memberNames = [...new Set(legMembers.filter((m) => m.registrantId).map((m) => m.name))].join(' / ') || '—';
  const entry = await prisma.entry.create({ data: { heatId, name: memberNames } });
  await prisma.member.createMany({
    data: legMembers.map((m) => ({ entryId: entry.id, name: m.name, leg: m.leg, registrantId: m.registrantId })),
  });
  await prisma.group.update({ where: { id: group.id }, data: { entryId: entry.id } });
}

// A category is "locked" once timing has begun — a heat has been started or any
// leg time recorded. We never rebuild a locked category (that would lose times);
// we only top up its heats with newcomers.
function isLocked(heats: { startTime: Date | null; entries: { swimTime: Date | null; bikeTime: Date | null; runTime: Date | null }[] }[]) {
  return heats.some((h) => h.startTime || h.entries.some((e) => e.swimTime || e.bikeTime || e.runTime));
}

// Pack a TEAM category's groups into as few heats as possible (HEAT_CAPACITY per
// heat), named Heat 1..N. Before timing starts we rebuild the heats from scratch
// so incremental additions never fragment into many half-empty heats or collide
// on names. Once timing has started we leave placed teams (and their times)
// alone and only fill spare lanes / append heats for any new groups.
async function packTeamCategory(categoryId: string) {
  const [groups, heats, regs] = await Promise.all([
    prisma.group.findMany({ where: { categoryId }, orderBy: { createdAt: 'asc' } }),
    prisma.heat.findMany({ where: { categoryId }, include: { entries: true }, orderBy: { createdAt: 'asc' } }),
    prisma.registrant.findMany({ where: { categoryId } }),
  ]);
  const nameOf = new Map(regs.map((r) => [r.id, r.name]));

  if (!isLocked(heats)) {
    if (heats.length > 0) await prisma.heat.deleteMany({ where: { categoryId } });
    await prisma.group.updateMany({ where: { categoryId }, data: { entryId: null } });
    const chunks = chunk(groups, HEAT_CAPACITY);
    for (let i = 0; i < chunks.length; i++) {
      const heat = await prisma.heat.create({ data: { categoryId, name: `Heat ${i + 1}` } });
      for (const g of chunks[i]) await createGroupEntry(heat.id, g, nameOf);
    }
    return;
  }

  const unscheduled = groups.filter((g) => !g.entryId);
  if (unscheduled.length === 0) return;
  let idx = 0;
  for (const h of heats) {
    let free = HEAT_CAPACITY - h.entries.length;
    while (free > 0 && idx < unscheduled.length) {
      await createGroupEntry(h.id, unscheduled[idx++], nameOf);
      free--;
    }
  }
  const chunks = chunk(unscheduled.slice(idx), HEAT_CAPACITY);
  for (let i = 0; i < chunks.length; i++) {
    const heat = await prisma.heat.create({ data: { categoryId, name: `Heat ${heats.length + i + 1}` } });
    for (const g of chunks[i]) await createGroupEntry(heat.id, g, nameOf);
  }
}

// Same compact packing for a SINGLE category (one entry per solo competitor).
async function packSingleCategory(categoryId: string) {
  const [registrants, heats] = await Promise.all([
    prisma.registrant.findMany({ where: { categoryId }, orderBy: { createdAt: 'asc' } }),
    prisma.heat.findMany({ where: { categoryId }, include: { entries: true }, orderBy: { createdAt: 'asc' } }),
  ]);

  const addSolo = async (heatId: string, r: { id: string; name: string }) => {
    const entry = await prisma.entry.create({ data: { heatId, name: r.name } });
    await prisma.registrant.update({ where: { id: r.id }, data: { entryId: entry.id } });
  };

  if (!isLocked(heats)) {
    if (heats.length > 0) await prisma.heat.deleteMany({ where: { categoryId } });
    await prisma.registrant.updateMany({ where: { categoryId }, data: { entryId: null } });
    const chunks = chunk(registrants, HEAT_CAPACITY);
    for (let i = 0; i < chunks.length; i++) {
      const heat = await prisma.heat.create({ data: { categoryId, name: `Heat ${i + 1}` } });
      for (const r of chunks[i]) await addSolo(heat.id, r);
    }
    return;
  }

  const pending = registrants.filter((r) => !r.entryId);
  if (pending.length === 0) return;
  let idx = 0;
  for (const h of heats) {
    let free = HEAT_CAPACITY - h.entries.length;
    while (free > 0 && idx < pending.length) {
      await addSolo(h.id, pending[idx++]);
      free--;
    }
  }
  const chunks = chunk(pending.slice(idx), HEAT_CAPACITY);
  for (let i = 0; i < chunks.length; i++) {
    const heat = await prisma.heat.create({ data: { categoryId, name: `Heat ${heats.length + i + 1}` } });
    for (const r of chunks[i]) await addSolo(heat.id, r);
  }
}

/**
 * Builds the heat schedule for every category. Only admin-formed groups (TEAM)
 * and registered solos (SINGLE) are scheduled — ungrouped team registrants are
 * left unassigned, never auto-teamed. Groups/solos are packed into as few heats
 * as possible (up to HEAT_CAPACITY each), named Heat 1..N. Before any timing has
 * started a category's heats are rebuilt compactly on each run (so re-running
 * never fragments heats or duplicates names); once a heat is started or a time
 * is recorded, that category is only topped up with newcomers. Then every heat
 * gets an estimated start time in race order.
 */
export async function generateSchedule(locale: string) {
  await requireRole('ADMIN');

  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  // Use the admin-configured start time if it's in the future; otherwise fall back to now+5 min.
  const raceStartTime =
    settings.raceStartTime && settings.raceStartTime > new Date()
      ? settings.raceStartTime
      : new Date(Date.now() + 5 * 60_000);

  for (const category of categories) {
    if (category.type === 'TEAM') {
      await packTeamCategory(category.id);
    } else {
      await packSingleCategory(category.id);
    }
  }

  const allHeatsByCategory = await Promise.all(
    categories.map((category) =>
      prisma.heat.findMany({ where: { categoryId: category.id }, orderBy: { createdAt: 'asc' } })
    )
  );

  const blocks = categories.map((category, i) => ({
    categoryId: category.id,
    estDurationMinutes: category.estDurationMinutes,
    heatCount: allHeatsByCategory[i].length,
  }));
  const startsByBlock = computeEstimatedStarts(blocks, raceStartTime, settings.heatGapMinutes);

  for (let i = 0; i < categories.length; i++) {
    const heats = allHeatsByCategory[i];
    const starts = startsByBlock[i];
    for (let h = 0; h < heats.length; h++) {
      await prisma.heat.update({ where: { id: heats[h].id }, data: { estimatedStart: starts[h] } });
    }
  }

  await prisma.eventSettings.update({
    where: { id: 'singleton' },
    data: { raceStartTime, scheduleGeneratedAt: new Date() },
  });

  revalidatePath('/', 'layout');
}

// Admin fixup: place a leftover (unmatched) registrant onto an existing team's
// open leg, e.g. after the lottery couldn't find them a full team.
export async function addRegistrantToEntry(locale: string, registrantId: string, entryId: string, leg: Leg) {
  await requireRole('ADMIN');

  const registrant = await prisma.registrant.findUniqueOrThrow({ where: { id: registrantId } });
  const member = await prisma.member.create({
    data: { entryId, name: registrant.name, leg, registrantId: registrant.id },
  });
  await prisma.registrant.update({ where: { id: registrant.id }, data: { entryId } });
  // Keep the linked group's leg in sync so the group stays the source of truth
  // (and the heats↔roster reconcile below won't undo this placement).
  await prisma.group.updateMany({ where: { entryId }, data: { [LEG_FIELD[leg]]: registrantId } });

  revalidatePath(`/${locale}/staff/manage`);
  return { ok: true as const, memberId: member.id };
}

/**
 * Reconcile already-scheduled heats with the current roster, so group/competitor
 * edits made on the Registration tab show up on the Heats tab. Run when the admin
 * opens the Heats tab; it only writes (and reports `changed`) when something is
 * actually out of date, so nothing happens on a quiet revisit.
 *
 * - For each group already placed in a heat: rebuild its entry's members and name
 *   from the group's current legs. If a group leg is open but the entry still
 *   holds a real person there (a legacy manual placement), that person is adopted
 *   back into the group rather than dropped. If the entry was deleted (its heat
 *   removed), the group is freed so it can be re-scheduled.
 * - For each solo competitor already placed: keep the entry name in step with a
 *   rename, and free them if their entry was deleted.
 * Never moves entries between heats or touches stamped times, so the admin's heat
 * arrangement and any recorded results are preserved.
 */
export async function syncHeatsWithRoster(): Promise<{ changed: boolean }> {
  await requireRole('ADMIN');
  let changed = false;

  // --- TEAM: reconcile each placed group's entry with the group's legs ---
  const placedGroups = await prisma.group.findMany({ where: { entryId: { not: null } } });
  if (placedGroups.length > 0) {
    const entries = await prisma.entry.findMany({
      where: { id: { in: placedGroups.map((g) => g.entryId as string) } },
      include: { members: true },
    });
    const entryById = new Map(entries.map((e) => [e.id, e]));

    const rids = new Set<string>();
    for (const g of placedGroups) {
      for (const f of ['swimRegistrantId', 'bikeRegistrantId', 'runRegistrantId'] as const) if (g[f]) rids.add(g[f] as string);
    }
    for (const e of entries) for (const m of e.members) if (m.registrantId) rids.add(m.registrantId);
    const regs = await prisma.registrant.findMany({ where: { id: { in: [...rids] } } });
    const nameOf = new Map(regs.map((r) => [r.id, r.name]));

    for (const g of placedGroups) {
      const entry = entryById.get(g.entryId as string);
      if (!entry) {
        await prisma.group.update({ where: { id: g.id }, data: { entryId: null } });
        changed = true;
        continue;
      }

      // Prefer the real (assigned) member per leg when reading the current entry.
      const curByLeg = new Map<string, (typeof entry.members)[number]>();
      for (const m of entry.members) {
        const existing = curByLeg.get(m.leg ?? '');
        if (m.leg && (!existing || (!existing.registrantId && m.registrantId))) curByLeg.set(m.leg, m);
      }

      const groupFix: Record<string, string> = {};
      const desired = LEGS.map((leg) => {
        let rid = g[LEG_FIELD[leg]];
        if (!rid) {
          const cur = curByLeg.get(leg);
          if (cur?.registrantId) {
            rid = cur.registrantId; // adopt a legacy entry-side placement into the group
            groupFix[LEG_FIELD[leg]] = rid;
          }
        }
        return { leg, registrantId: rid ?? null, name: rid ? nameOf.get(rid) ?? '?' : '—' };
      });
      if (Object.keys(groupFix).length > 0) {
        await prisma.group.update({ where: { id: g.id }, data: groupFix });
        changed = true;
      }

      const desiredName = [...new Set(desired.filter((m) => m.registrantId).map((m) => m.name))].join(' / ') || '—';
      const membersMatch =
        entry.members.length === desired.length &&
        desired.every((d) => {
          const cur = curByLeg.get(d.leg);
          return cur && cur.registrantId === d.registrantId && cur.name === d.name;
        });

      if (!membersMatch || entry.name !== desiredName) {
        await prisma.member.deleteMany({ where: { entryId: entry.id } });
        await prisma.member.createMany({
          data: desired.map((d) => ({ entryId: entry.id, name: d.name, leg: d.leg, registrantId: d.registrantId })),
        });
        await prisma.entry.update({ where: { id: entry.id }, data: { name: desiredName } });
        changed = true;
      }
    }
  }

  // --- Remove phantom relay entries left over from disbanded groups: a team
  // entry that has leg members but is no longer pointed to by any group. Manual
  // name-only entries and solo entries have no leg members, so they're safe. ---
  const linkedEntryIds = new Set(
    (await prisma.group.findMany({ where: { entryId: { not: null } }, select: { entryId: true } })).map(
      (g) => g.entryId as string
    )
  );
  const teamEntries = await prisma.entry.findMany({
    where: { heat: { category: { type: 'TEAM' } } },
    include: { members: true },
  });
  for (const e of teamEntries) {
    if (!linkedEntryIds.has(e.id) && e.members.some((m) => m.leg)) {
      await prisma.entry.delete({ where: { id: e.id } });
      changed = true;
    }
  }

  // --- SINGLE: keep each placed solo entry's name in step with the registrant ---
  const placedSingles = await prisma.registrant.findMany({ where: { entryId: { not: null }, mode: 'SINGLE' } });
  if (placedSingles.length > 0) {
    const entries = await prisma.entry.findMany({ where: { id: { in: placedSingles.map((r) => r.entryId as string) } } });
    const entryById = new Map(entries.map((e) => [e.id, e]));
    for (const r of placedSingles) {
      const entry = entryById.get(r.entryId as string);
      if (!entry) {
        await prisma.registrant.update({ where: { id: r.id }, data: { entryId: null } });
        changed = true;
      } else if (entry.name !== r.name) {
        await prisma.entry.update({ where: { id: entry.id }, data: { name: r.name } });
        changed = true;
      }
    }
  }

  if (changed) revalidatePath('/', 'layout');
  return { changed };
}
