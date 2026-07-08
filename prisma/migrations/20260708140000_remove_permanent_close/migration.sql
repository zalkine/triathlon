-- Registration can now be re-opened after closing; drop the one-way gate column.
ALTER TABLE "EventSettings" DROP COLUMN IF EXISTS "registrationPermanentlyClosed";
