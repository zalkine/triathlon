-- Heat durations can be fractional (e.g. 1.5 min for the 9-12 kids pool wave).
ALTER TABLE "Category" ALTER COLUMN "estDurationMinutes" SET DATA TYPE DOUBLE PRECISION;

-- Default gap between heats is 2 minutes; apply to the existing singleton row.
ALTER TABLE "EventSettings" ALTER COLUMN "heatGapMinutes" SET DEFAULT 2;
UPDATE "EventSettings" SET "heatGapMinutes" = 2 WHERE id = 'singleton';
