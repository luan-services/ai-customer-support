/*
  Warnings:

  - The `category` column on the `SupportRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `department` column on the `SupportRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TriageCategory" AS ENUM ('DELIVERY', 'EXCHANGE_OR_RETURN', 'BILLING', 'ORDER_CHANGE_OR_CANCELLATION', 'PRODUCT_NOT_AS_DESCRIBED', 'DAMAGED_PRODUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('LOGISTICS', 'AFTER_SALES', 'FINANCE', 'CUSTOMER_SUPPORT');

-- AlterTable
ALTER TABLE "SupportRequest" DROP COLUMN "category",
ADD COLUMN     "category" "TriageCategory",
DROP COLUMN "department",
ADD COLUMN     "department" "Department";
