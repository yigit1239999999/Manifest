-- Clinic-defined species ("her kliniğin kendi dünyası").
-- Pets keep the built-in Species enum; a custom species stores OTHER in the
-- enum column plus a reference to the clinic's own species row.

-- CreateTable
CREATE TABLE "custom_species" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_species_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_species_clinicId_idx" ON "custom_species"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_species_clinicId_name_key" ON "custom_species"("clinicId", "name");

-- AddForeignKey
ALTER TABLE "custom_species" ADD CONSTRAINT "custom_species_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "pets" ADD COLUMN "customSpeciesId" TEXT;

-- CreateIndex
CREATE INDEX "pets_customSpeciesId_idx" ON "pets"("customSpeciesId");

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_customSpeciesId_fkey" FOREIGN KEY ("customSpeciesId") REFERENCES "custom_species"("id") ON DELETE SET NULL ON UPDATE CASCADE;
