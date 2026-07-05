-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "estDurationMinutes" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Heat" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "estimatedStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Heat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "heatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "swimTime" TIMESTAMP(3),
    "bikeTime" TIMESTAMP(3),
    "runTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leg" TEXT,
    "registrantId" TEXT,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registrant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "legSwim" BOOLEAN NOT NULL DEFAULT false,
    "legBike" BOOLEAN NOT NULL DEFAULT false,
    "legRun" BOOLEAN NOT NULL DEFAULT false,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "competitionActive" BOOLEAN NOT NULL DEFAULT false,
    "raceStartTime" TIMESTAMP(3),
    "heatGapMinutes" INTEGER NOT NULL DEFAULT 3,
    "scheduleGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "EventSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");

-- CreateIndex
CREATE INDEX "Heat_categoryId_idx" ON "Heat"("categoryId");

-- CreateIndex
CREATE INDEX "Entry_heatId_idx" ON "Entry"("heatId");

-- CreateIndex
CREATE INDEX "Member_entryId_idx" ON "Member"("entryId");

-- CreateIndex
CREATE INDEX "Member_registrantId_idx" ON "Member"("registrantId");

-- CreateIndex
CREATE INDEX "Registrant_categoryId_idx" ON "Registrant"("categoryId");

-- CreateIndex
CREATE INDEX "Registrant_entryId_idx" ON "Registrant"("entryId");

-- AddForeignKey
ALTER TABLE "Heat" ADD CONSTRAINT "Heat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_heatId_fkey" FOREIGN KEY ("heatId") REFERENCES "Heat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_registrantId_fkey" FOREIGN KEY ("registrantId") REFERENCES "Registrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
