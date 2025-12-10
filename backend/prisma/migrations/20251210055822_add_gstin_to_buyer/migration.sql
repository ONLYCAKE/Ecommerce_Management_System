/*
  Warnings:

  - A unique constraint covering the columns `[gstin]` on the table `Buyer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "gstin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_gstin_key" ON "Buyer"("gstin");
