-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INITIAL', 'RECEIVE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('MERMA', 'ROTURA', 'VENCIMIENTO', 'DESCUADRE', 'SOBRANTE');

-- AlterTable
ALTER TABLE "Inventory" ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DECIMAL(10,2);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "reason" "InventoryAdjustmentReason",
    "costSnapshot" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_branchId_itemId_createdAt_idx" ON "InventoryMovement"("tenantId", "branchId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_type_createdAt_idx" ON "InventoryMovement"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_createdAt_idx" ON "InventoryMovement"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

