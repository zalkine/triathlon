-- Closing a competition: the season's results go to the Hall of Fame and the
-- operational tables (roster, groups, heats, entries) are emptied so the next
-- year starts clean. Everything they held is snapshotted into CompetitionArchive
-- first, and `EventSettings.closedYear` remembers which year that was, so the
-- public site can point at the right year's results until the next competition
-- opens registration.
ALTER TABLE "EventSettings" ADD COLUMN "closedYear" INTEGER;

CREATE TABLE "CompetitionArchive" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrantCount" INTEGER NOT NULL DEFAULT 0,
    "heatCount" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,

    CONSTRAINT "CompetitionArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetitionArchive_year_key" ON "CompetitionArchive"("year");
