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

function legsFor(r: { legSwim: boolean; legBike: boolean; legRun: boolean }): Leg[] {
  const legs: Leg[] = [];
  if (r.legSwim) legs.push('SWIM');
  if (r.legBike) legs.push('BIKE');
  if (r.legRun) legs.push('RUN');
  return legs;
}

/**
 * Runs the swim/bike/run lottery for TEAM categories, places SINGLE-mode
 * registrants directly, packs everyone into new heats (capacity HEAT_CAPACITY),
 * and recomputes estimated start times for every heat in race order. Safe to
 * re-run: only checked-in registrants not yet placed in an entry are touched,
 * so a later run just schedules whoever checked in since the last run.
 */
export async function generateSchedule(locale: string) {
  await requireRole('ADMIN');

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  const raceStartTime = new Date(Date.now() + 5 * 60_000);

  for (const category of categories) {
    const pending = await prisma.registrant.findMany({
      where: { categoryId: category.id, checkedIn: true, entryId: null },
    });
    if (pending.length === 0) continue;

    const existingHeatCount = await prisma.heat.count({ where: { categoryId: category.id } });

    if (category.type === 'TEAM') {
      const candidates: LotteryCandidate[] = pending.map((r) => ({
        registrantId: r.id,
        name: r.name,
        legs: legsFor(r),
      }));
      const { teams } = runLottery(candidates);
      if (teams.length === 0) continue;

      const heatChunks = chunk(teams, HEAT_CAPACITY);
      for (let i = 0; i < heatChunks.length; i++) {
        const heat = await prisma.heat.create({
          data: { categoryId: category.id, name: `Heat ${existingHeatCount + i + 1}` },
        });
        for (const team of heatChunks[i]) {
          const entry = await prisma.entry.create({
            data: { heatId: heat.id, name: [team.swim.name, team.bike.name, team.run.name].join(' / ') },
          });
          await prisma.member.createMany({
            data: [
              { entryId: entry.id, name: team.swim.name, leg: 'SWIM', registrantId: team.swim.registrantId },
              { entryId: entry.id, name: team.bike.name, leg: 'BIKE', registrantId: team.bike.registrantId },
              { entryId: entry.id, name: team.run.name, leg: 'RUN', registrantId: team.run.registrantId },
            ],
          });
          await prisma.registrant.updateMany({
            where: { id: { in: [team.swim.registrantId, team.bike.registrantId, team.run.registrantId] } },
            data: { entryId: entry.id },
          });
        }
      }
    } else {
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

  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });

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
