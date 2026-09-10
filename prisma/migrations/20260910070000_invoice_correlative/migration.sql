-- Correlativo único de facturas por tenant
-- CreateTable "SaleCounter"
CREATE TABLE "SaleCounter" (
    "tenantId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SaleCounter_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey tenantId -> Tenant.id (cascade)
ALTER TABLE "SaleCounter" ADD CONSTRAINT "SaleCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- invoiceNumber obligatorio (los registros existentes no tienen NULL)
ALTER TABLE "Sale" ALTER COLUMN "invoiceNumber" SET NOT NULL;

-- Unicidad: una factura es única por tenant
CREATE UNIQUE INDEX "Sale_tenantId_invoiceNumber_key" ON "Sale"("tenantId", "invoiceNumber");