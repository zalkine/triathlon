-- Add type field to InfoSection to categorize content as "competitionInfo" or "trails"
ALTER TABLE "InfoSection" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'competitionInfo';

-- Add publish flags for competition info and trails screens
ALTER TABLE "EventSettings" ADD COLUMN "competitionInfoPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventSettings" ADD COLUMN "trailsPublished" BOOLEAN NOT NULL DEFAULT false;
