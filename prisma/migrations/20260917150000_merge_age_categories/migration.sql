-- Merging age brackets: an absorbed category points at the category that keeps
-- the racing, and the pair is packed and ranked as one. Null (the default for
-- every existing category) means the category races on its own, as before.
ALTER TABLE "Category" ADD COLUMN "mergedIntoId" TEXT;

CREATE INDEX "Category_mergedIntoId_idx" ON "Category"("mergedIntoId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
