/*
  Warnings:

  - You are about to drop the column `hsn` on the `InvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `InvoiceItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InvoiceItem" DROP COLUMN "hsn",
DROP COLUMN "unit",
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "discountPct" DROP DEFAULT;
