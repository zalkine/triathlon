-- Admin toggle for whether the public Results page shows live rankings/times.
ALTER TABLE "EventSettings" ADD COLUMN "publicResultsVisible" BOOLEAN NOT NULL DEFAULT true;
