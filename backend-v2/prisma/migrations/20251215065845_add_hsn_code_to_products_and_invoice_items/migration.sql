-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "hsnCode" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hsnCode" TEXT DEFAULT '00000000';
