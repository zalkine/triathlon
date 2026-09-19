'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { importResultsToHof } from '@/lib/hofImport';
import { competitionYear, resultsPubliclyVisible } from '@/lib/season';

export type CloseCompetitionResult = { ok?: true; year?: number; error?: string };

/**
 * Close a competition: file the season away and hand the management screens
 * back empty, ready for the next year.
 *
 * The published results are the part that lasts. They already live in the Hall
 * of Fame (publishing puts them there), and they are re-imported here so the
 * archive and the public record agree down to the last late correction. From
 * then on the year is read exactly like 2023 — through the Hall of Fame — which
 * is why the operational tables can be emptied at all.
 *
 * Nothing is thrown away. The whole season — the roster, the relay groups, every
 * heat with its entries and leg times, the category line-up, the contacts, the
 * info pages and the settings as they stood — is copied into `CompetitionArchive`
 * first. A mistake found afterwards is corrected in the database: the results in
 * `HistoricalResult`, everything else in the archive row. There is deliberately
 * no screen for editing a closed year.
 *
 * What is *not* cleared: the categories themselves (the line-up races again next
 * year, so only the admin's age-bracket merges are undone), the staff accounts
 * and contact directory, the trail descriptions, and the Hall of Fame. The
 * competition info page is unpublished, since it describes a competition that is
 * over.
 */
export async function closeCompetition(locale: string, formData: FormData): Promise<CloseCompetitionResult> {
  await requireRole('ADMIN');

  const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
  // Closing is the step after publishing, not instead of it: the Hall of Fame is
  // where the year goes on being readable, so there has to be something in it.
  if (!resultsPubliclyVisible(settings)) return { error: 'not-published' };

  const requested = parseInt(String(formData.get('year') || ''), 10);
  const year = Number.isInteger(requested) ? requested : competitionYear(settings.raceStartTime);
  if (year < 1900 || year > 2200) return { error: 'year' };

  // The Hall of Fame takes the results as they stand at this moment.
  await importResultsToHof(year);

  const [categories, registrants, groups, heats, contacts, infoSections, resultCount] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.registrant.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.group.findMany({ orderBy: { createdAt: 'asc' } }),
    // Nested, so the archive reads as the race was actually run: each heat with
    // the competitors who lined up in it and every time recorded against them.
    prisma.heat.findMany({
      include: { entries: { include: { members: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ categoryId: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.contact.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.infoSection.findMany({ orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.historicalResult.count({ where: { year } }),
  ]);

  // Through JSON so the dates land as ISO strings — the archive is meant to be
  // read (and, rarely, corrected) with plain SQL long after this code changed.
  const data = JSON.parse(
    JSON.stringify({
      closedAt: new Date(),
      settings,
      categories,
      registrants,
      groups,
      heats,
      contacts,
      infoSections,
    })
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.competitionArchive.upsert({
        where: { year },
        update: {
          closedAt: new Date(),
          registrantCount: registrants.length,
          heatCount: heats.length,
          resultCount,
          data,
        },
        create: {
          year,
          registrantCount: registrants.length,
          heatCount: heats.length,
          resultCount,
          data,
        },
      });

      // Empty the season. Order matters: the links between these tables are
      // released before the rows they point at are removed.
      await tx.registrant.updateMany({ data: { entryId: null } });
      await tx.member.deleteMany({});
      await tx.entry.deleteMany({});
      await tx.heat.deleteMany({});
      await tx.group.deleteMany({});
      await tx.registrant.deleteMany({});

      // The categories race again next year; only this year's merges are undone.
      await tx.category.updateMany({ where: { mergedIntoId: { not: null } }, data: { mergedIntoId: null } });

      await tx.eventSettings.update({
        where: { id: 'singleton' },
        data: {
          closedYear: year,
          registrationOpen: false,
          competitionActive: false,
          raceStartTime: null,
          scheduleGeneratedAt: null,
          schedulePublished: false,
          resultsApproved: false,
          publicResultsVisible: true,
          // Last year's "what to bring, when to arrive" is not this year's.
          competitionInfoPublished: false,
        },
      });
    },
    { timeout: 30_000 }
  );

  revalidatePath('/', 'layout');
  return { ok: true, year };
}
