-- Add schedulePublished flag so admins can generate a schedule internally
-- before making it visible to the public.
ALTER TABLE "EventSettings" ADD COLUMN "schedulePublished" BOOLEAN NOT NULL DEFAULT false;
