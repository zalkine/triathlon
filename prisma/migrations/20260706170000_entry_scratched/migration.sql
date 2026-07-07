-- A start-line timekeeper can scratch a competitor/team from a heat (no-show or
-- last-minute drop). Scratched entries are skipped by the timing stations and
-- excluded from results.
ALTER TABLE "Entry" ADD COLUMN "scratched" BOOLEAN NOT NULL DEFAULT false;
