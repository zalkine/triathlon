-- AlterTable
ALTER TABLE "Heat" ADD COLUMN "estimatedStart" DATETIME;

-- CreateTable
CREATE TABLE "Registrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "legSwim" BOOLEAN NOT NULL DEFAULT false,
    "legBike" BOOLEAN NOT NULL DEFAULT false,
    "legRun" BOOLEAN NOT NULL DEFAULT false,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" DATETIME,
    "entryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Registrant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Registrant_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "competitionActive" BOOLEAN NOT NULL DEFAULT false,
    "raceStartTime" DATETIME,
    "heatGapMinutes" INTEGER NOT NULL DEFAULT 3,
    "scheduleGeneratedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "estDurationMinutes" INTEGER NOT NULL DEFAULT 45
);
INSERT INTO "new_Category" ("id", "key", "nameEn", "nameHe", "sortOrder", "type") SELECT "id", "key", "nameEn", "nameHe", "sortOrder", "type" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leg" TEXT,
    "registrantId" TEXT,
    CONSTRAINT "Member_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Member_registrantId_fkey" FOREIGN KEY ("registrantId") REFERENCES "Registrant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("entryId", "id", "leg", "name") SELECT "entryId", "id", "leg", "name" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_entryId_idx" ON "Member"("entryId");
CREATE INDEX "Member_registrantId_idx" ON "Member"("registrantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Registrant_categoryId_idx" ON "Registrant"("categoryId");

-- CreateIndex
CREATE INDEX "Registrant_entryId_idx" ON "Registrant"("entryId");
