-- Registration now starts closed by default and closing is permanent (one-way).
ALTER TABLE "EventSettings" ADD COLUMN "registrationPermanentlyClosed" BOOLEAN NOT NULL DEFAULT false;
-- Flip existing open installations to the new default-closed state is intentionally
-- NOT done here — already-deployed instances keep their current open/closed setting.
