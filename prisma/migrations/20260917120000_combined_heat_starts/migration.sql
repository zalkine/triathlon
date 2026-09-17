-- Combined starts: heats sharing a waveId are sent off together as one wave,
-- so two thinly-populated categories can fill the pool in a single start.
-- Null (the default for every existing heat) means the heat starts on its own.
ALTER TABLE "Heat" ADD COLUMN "waveId" TEXT;

CREATE INDEX "Heat_waveId_idx" ON "Heat"("waveId");
