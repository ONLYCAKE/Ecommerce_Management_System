-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "taxRate" DOUBLE PRECISION DEFAULT 18,
ADD COLUMN     "taxType" TEXT DEFAULT 'withTax';
