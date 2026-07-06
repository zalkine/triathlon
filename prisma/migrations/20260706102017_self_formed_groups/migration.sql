-- AlterTable
ALTER TABLE "EventSettings" ADD COLUMN     "allowRandomGrouping" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Registrant" ADD COLUMN     "groupPref" TEXT;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "swimRegistrantId" TEXT NOT NULL,
    "bikeRegistrantId" TEXT NOT NULL,
    "runRegistrantId" TEXT NOT NULL,
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Group_categoryId_idx" ON "Group"("categoryId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
