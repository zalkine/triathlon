-- Admin sign-off flag for results (public results stay hidden until approved).
ALTER TABLE "EventSettings" ADD COLUMN "resultsApproved" BOOLEAN NOT NULL DEFAULT false;

-- Editable contact directory (doctor, security, volunteers, …) shown to competitors.
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- Fully editable Hall of Fame results (seeded from the historical sheets).
CREATE TABLE "HistoricalResult" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "categoryHe" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "isTeam" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    "name" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "members" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HistoricalResult_year_idx" ON "HistoricalResult"("year");

-- Editable content blocks for the public Rules & Trails / info page.
CREATE TABLE "InfoSection" (
    "id" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL DEFAULT '',
    "titleHe" TEXT NOT NULL DEFAULT '',
    "bodyEn" TEXT NOT NULL DEFAULT '',
    "bodyHe" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfoSection_pkey" PRIMARY KEY ("id")
);
