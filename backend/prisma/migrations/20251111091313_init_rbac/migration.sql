/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Buyer` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Buyer` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `serviceCharge` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `discountPct` on the `InvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Permission` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `Permission` table. All the data in the column will be lost.
  - You are about to drop the column `buyerId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `archivedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `archivedBy` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isArchived` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `phone` on table `Buyer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `address` on table `Buyer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `paymentMethod` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `InvoiceItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sku` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `supplierId` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `Supplier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `address` on table `Supplier` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "postgres"."InvoiceItem" DROP CONSTRAINT "InvoiceItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "postgres"."Permission" DROP CONSTRAINT "Permission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "postgres"."Product" DROP CONSTRAINT "Product_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "postgres"."Product" DROP CONSTRAINT "Product_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "postgres"."Project" DROP CONSTRAINT "Project_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "postgres"."Project" DROP CONSTRAINT "Project_productId_fkey";

-- DropForeignKey
ALTER TABLE "postgres"."Project" DROP CONSTRAINT "Project_supplierId_fkey";

-- DropIndex
DROP INDEX "postgres"."Buyer_email_key";

-- DropIndex
DROP INDEX "postgres"."Supplier_email_key";

-- AlterTable
ALTER TABLE "Buyer" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "address" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "balance",
DROP COLUMN "filePath",
DROP COLUMN "serviceCharge",
ALTER COLUMN "paymentMethod" SET NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InvoiceItem" DROP COLUMN "discountPct",
ALTER COLUMN "productId" DROP NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "Permission" DROP COLUMN "description",
DROP COLUMN "roleId";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "buyerId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "sku" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "stock" DROP DEFAULT,
ALTER COLUMN "supplierId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "address" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "archivedAt",
DROP COLUMN "archivedBy",
DROP COLUMN "createdAt",
DROP COLUMN "isArchived",
DROP COLUMN "phone",
DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "postgres"."Project";

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
