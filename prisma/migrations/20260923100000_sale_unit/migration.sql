-- CreateEnum
CREATE TYPE "ItemSaleUnit" AS ENUM ('UNIDAD', 'LIBRA', 'KILOGRAMO');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "saleUnit" "ItemSaleUnit";