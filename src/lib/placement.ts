import { prisma } from './db';
import { HEAT_CAPACITY } from './constants';
import { racingCategories } from './categories';

// Putting registered competitors into heats.
//
// The schedule generator packs everyone in one go, but an admin who builds the
// running order by hand needs the same thing piecemeal: a group that registered
// after the heats were built has nowhere to appear on its own. These helpers are
// shared by both, so a heat entry is created the same way whichever route places
// it, and the by-hand route never rebuilds or moves anything that is already
// arranged.

export type GroupRow = {
  id: string;
  swimRegistrantId: string | null;
  bikeRegistrantId: string | null;
  runRegistrantId: string | null;
};

/** A group with every leg cleared isn't a team — it would only make a junk entry. */
export const isActiveGroup = (g: GroupRow) =>
  !!(g.swimRegistrantId || g.bikeRegistrantId || g.runRegistrantId);

/**
 * Create one heat entry (with its three leg members) for a relay group and link
 * the group to it. An open leg becomes a "—" placeholder the admin can fill later.
 */
export async function createGroupEntry(heatId: string, group: GroupRow, nameOf: Map<string, string>) {
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
  return entry;
}

/** Create the heat entry for a solo competitor and link the registrant to it. */
export async function createSoloEntry(heatId: string, registrant: { id: string; name: string }) {
  const entry = await prisma.entry.create({ data: { heatId, name: registrant.name } });
  await prisma.registrant.update({ where: { id: registrant.id }, data: { entryId: entry.id } });
  return entry;
}

/**
 * Heats a competitor may be dropped into when topping up. A heat combined into a
 * shared start is skipped: the admin sized that wave against the other categories
 * sharing the pool with it, so a newcomer goes into a fresh heat rather than
 * quietly pushing a combined wave past the pool's capacity.
 */
export function topUpTargets<T extends { waveId: string | null }>(heats: T[]): T[] {
  return heats.filter((h) => !h.waveId);
}

export type WaitingItem = {
  kind: 'GROUP' | 'SOLO';
  id: string;
  name: string;
  /** Relay legs, for showing the team the way the board does. */
  members: { leg: string; name: string }[];
  /**
   * True when a heat in this field already holds an entry of the same name —
   * usually a competitor typed in by hand at the start line, who is therefore
   * already racing. Flagged rather than hidden, and left out of "place all", so
   * placing them can't silently duplicate someone.
   */
  maybeAlreadyPlaced: boolean;
};

export type WaitingField = {
  id: string;
  nameEn: string;
  nameHe: string;
  type: string;
  heats: { id: string; name: string; count: number; waveId: string | null }[];
  items: WaitingItem[];
};

/**
 * Everyone who is registered but has no place in a heat, grouped by the field
 * they race in. This is the gap an admin who never runs the schedule generator
 * would otherwise have no way to see or close: a relay team that formed after
 * the heats were built simply never appears on the board.
 */
export async function waitingForHeats(): Promise<WaitingField[]> {
  const fields = await racingCategories();
  const memberIds = fields.flatMap((f) => f.memberIds);

  const [groups, registrants, heats] = await Promise.all([
    prisma.group.findMany({ where: { categoryId: { in: memberIds } }, orderBy: { createdAt: 'asc' } }),
    prisma.registrant.findMany({ where: { categoryId: { in: memberIds } }, orderBy: { createdAt: 'asc' } }),
    prisma.heat.findMany({
      where: { categoryId: { in: memberIds } },
      include: { entries: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const nameOf = new Map(registrants.map((r) => [r.id, r.name]));

  return fields
    .map((field) => {
      const fieldHeats = heats.filter((h) => field.memberIds.includes(h.categoryId));
      const namesInHeats = new Set(fieldHeats.flatMap((h) => h.entries.map((e) => e.name.trim())));

      const items: WaitingItem[] =
        field.type === 'TEAM'
          ? groups
              .filter((g) => field.memberIds.includes(g.categoryId) && !g.entryId && isActiveGroup(g))
              .map((g) => {
                const members = (
                  [
                    ['SWIM', g.swimRegistrantId],
                    ['BIKE', g.bikeRegistrantId],
                    ['RUN', g.runRegistrantId],
                  ] as const
                )
                  .filter(([, id]) => id)
                  .map(([leg, id]) => ({ leg, name: nameOf.get(id as string) ?? '?' }));
                const name = [...new Set(members.map((m) => m.name))].join(' / ') || '—';
                return { kind: 'GROUP' as const, id: g.id, name, members, maybeAlreadyPlaced: namesInHeats.has(name) };
              })
          : registrants
              .filter((r) => field.memberIds.includes(r.categoryId) && !r.entryId)
              .map((r) => ({
                kind: 'SOLO' as const,
                id: r.id,
                name: r.name,
                members: [],
                maybeAlreadyPlaced: namesInHeats.has(r.name.trim()),
              }));

      return {
        id: field.id,
        nameEn: field.nameEn,
        nameHe: field.nameHe,
        type: field.type,
        heats: fieldHeats.map((h) => ({ id: h.id, name: h.name, count: h.entries.length, waveId: h.waveId })),
        items,
      };
    })
    .filter((f) => f.items.length > 0);
}

/**
 * Places the waiting competitors of one field into its heats: spare lanes in the
 * heats that already exist first, then new heats for whoever is left. Nothing
 * already arranged is moved or renamed, so this is safe to press at any time.
 * Returns how many were placed.
 */
export async function placeWaitingInField(fieldId: string, memberIds: string[], type: string): Promise<number> {
  const heats = await prisma.heat.findMany({
    where: { categoryId: { in: memberIds } },
    include: { entries: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const namesInHeats = new Set(heats.flatMap((h) => h.entries.map((e) => e.name.trim())));
  const registrants = await prisma.registrant.findMany({ where: { categoryId: { in: memberIds } } });
  const nameOf = new Map(registrants.map((r) => [r.id, r.name]));

  // Anything that looks like it is already racing under the same name is left
  // for the admin to place deliberately, so a bulk press can't create a double.
  let pending: { place: (heatId: string) => Promise<unknown> }[] = [];
  if (type === 'TEAM') {
    const groups = await prisma.group.findMany({
      where: { categoryId: { in: memberIds }, entryId: null },
      orderBy: { createdAt: 'asc' },
    });
    pending = groups
      .filter(isActiveGroup)
      .filter((g) => {
        const names = [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId]
          .filter((id): id is string => !!id)
          .map((id) => nameOf.get(id) ?? '?');
        return !namesInHeats.has([...new Set(names)].join(' / '));
      })
      .map((g) => ({ place: (heatId: string) => createGroupEntry(heatId, g, nameOf) }));
  } else {
    pending = registrants
      .filter((r) => !r.entryId && !namesInHeats.has(r.name.trim()))
      .map((r) => ({ place: (heatId: string) => createSoloEntry(heatId, r) }));
  }

  if (pending.length === 0) return 0;

  let placed = 0;
  let idx = 0;
  for (const heat of topUpTargets(heats)) {
    let free = HEAT_CAPACITY - heat.entries.length;
    while (free > 0 && idx < pending.length) {
      await pending[idx++].place(heat.id);
      placed++;
      free--;
    }
  }

  // Whoever is left gets new heats, numbered on from the field's last one.
  let heatNumber = heats.length;
  while (idx < pending.length) {
    const heat = await prisma.heat.create({ data: { categoryId: fieldId, name: `Heat ${++heatNumber}` } });
    for (let n = 0; n < HEAT_CAPACITY && idx < pending.length; n++) {
      await pending[idx++].place(heat.id);
      placed++;
    }
  }

  return placed;
}
