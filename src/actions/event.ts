'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { runLottery, type LotteryCandidate } from '@/lib/lottery';
import { chunk, computeEstimatedStarts } from '@/lib/schedule';
import { HEAT_CAPACITY, type Leg } from '@/lib/constants';

export async function setRegistrationOpen(locale: string, open: boolean) {
  await requireRole('ADMIN');
  await prisma.eventSettings.update({ where: { id: 'singleton' }, data: { registrationOpen: open } });
  revalidatePath(`/${locale}/staff/manage`);
  revalidatePath(`/${locale}/register`);
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

function legsFor(r: { legSwim: boolean; legBike: boolean; legRun: boolean }): Leg[] {
  const legs: Leg[] = [];
  if (r.legSwim) legs.push('SWIM');
  if (r.legBike) legs.push('BIKE');
  if (r.legRun) legs.push('RUN');
  return legs;
}

/**
 * Turns registrations into a runnable schedule for every category:
 *  - TEAM: self-formed groups are scheduled as-is; if random grouping is on, the
 *    lottery forms extra groups from checked-in "available" people not already in
 *    any group. Every group (formed or lottery) becomes one heat entry.
 *  - SINGLE: each checked-in solo competitor becomes one heat entry.
 * Then every heat gets an estimated start time in race order. Safe to re-run:
 * already-scheduled groups (group.entryId set) and already-placed singles
 * (registrant.entryId set) are skipped, so a later run only adds new arrivals.
 */
export async function generateSchedule(locale: string) {
  await requireRole('ADMIN');

  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  const raceStartTime = new Date(Date.now() + 5 * 60_000);

  for (const category of categories) {
    const existingHeatCount = await prisma.heat.count({ where: { categoryId: category.id } });

    if (category.type === 'TEAM') {
      // 1. Optionally lottery available people (not already in any group) into new groups.
      if (settings.allowRandomGrouping) {
        const existingGroups = await prisma.group.findMany({ where: { categoryId: category.id } });
        const inGroup = new Set(
          existingGroups.flatMap((g) => [g.swimRegistrantId, g.bikeRegistrantId, g.runRegistrantId])
        );
        const pool = (
          await prisma.registrant.findMany({
            where: { categoryId: category.id, groupPref: 'AVAILABLE', checkedIn: true },
          })
        ).filter((r) => !inGroup.has(r.id));

        const candidates: LotteryCandidate[] = pool.map((r) => ({ registrantId: r.id, name: r.name, legs: legsFor(r) }));
        const { teams } = runLottery(candidates);
        for (const team of teams) {
          await prisma.group.create({
            data: {
              categoryId: category.id,
              swimRegistrantId: team.swim.registrantId,
              bikeRegistrantId: team.bike.registrantId,
              runRegistrantId: team.run.registrantId,
            },
          });
        }
      }

      // 2. Schedule every group in this category that isn't placed in a heat yet.
      const unscheduled = await prisma.group.findMany({
        where: { categoryId: category.id, entryId: null },
        orderBy: { createdAt: 'asc' },
      });
      if (unscheduled.length === 0) continue;

      const regs = await prisma.registrant.findMany({ where: { categoryId: category.id } });
      const nameOf = new Map(regs.map((r) => [r.id, r.name]));

      const heatChunks = chunk(unscheduled, HEAT_CAPACITY);
      for (let i = 0; i < heatChunks.length; i++) {
        const heat = await prisma.heat.create({
          data: { categoryId: category.id, name: `Heat ${existingHeatCount + i + 1}` },
        });
        for (const group of heatChunks[i]) {
          const swimName = nameOf.get(group.swimRegistrantId) ?? '?';
          const bikeName = nameOf.get(group.bikeRegistrantId) ?? '?';
          const runName = nameOf.get(group.runRegistrantId) ?? '?';
          const memberNames = [...new Set([swimName, bikeName, runName])].join(' / ');
          const entry = await prisma.entry.create({ data: { heatId: heat.id, name: memberNames } });
          await prisma.member.createMany({
            data: [
              { entryId: entry.id, name: swimName, leg: 'SWIM', registrantId: group.swimRegistrantId },
              { entryId: entry.id, name: bikeName, leg: 'BIKE', registrantId: group.bikeRegistrantId },
              { entryId: entry.id, name: runName, leg: 'RUN', registrantId: group.runRegistrantId },
            ],
          });
          await prisma.group.update({ where: { id: group.id }, data: { entryId: entry.id } });
        }
      }
    } else {
      const pending = await prisma.registrant.findMany({
        where: { categoryId: category.id, checkedIn: true, entryId: null },
      });
      if (pending.length === 0) continue;

      const heatChunks = chunk(pending, HEAT_CAPACITY);
      for (let i = 0; i < heatChunks.length; i++) {
        const heat = await prisma.heat.create({
          data: { categoryId: category.id, name: `Heat ${existingHeatCount + i + 1}` },
        });
        for (const registrant of heatChunks[i]) {
          const entry = await prisma.entry.create({ data: { heatId: heat.id, name: registrant.name } });
          await prisma.registrant.update({ where: { id: registrant.id }, data: { entryId: entry.id } });
        }
      }
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

  revalidatePath(`/${locale}/staff/manage`);
  return { ok: true as const, memberId: member.id };
}
