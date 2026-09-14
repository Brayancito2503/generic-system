-- Distribución P0: campos de pago en ventas y modelos de facturación financiera
-- DDL 100% aditivo: no se elimina ni se recrea ninguna tabla ni columna.
-- Requiere backup de la base antes de aplicar manualmente (nunca `prisma migrate dev` unsupervised).

-- AlterTable "Sale": método de pago y montos (defaults no nulos → las filas existentes persisten)
ALTER TABLE "Sale" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "Sale" ADD COLUMN "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "balance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable "PurchaseOrderItem": cantidad recibida (flujo receive de órdenes de compra)
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "receivedQty" INTEGER NOT NULL DEFAULT 0;

-- NOTA: `@@unique([tenantId, invoiceNumber])` en "Sale" YA existe
-- (migración 20260910070000_invoice_correlative) — no se re-aplica.

-- CreateTable "InvoicingConfig"
CREATE TABLE "InvoicingConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caiNumber" TEXT NOT NULL,
    "rangeFrom" TEXT NOT NULL,
    "rangeTo" TEXT NOT NULL,
    "limitDate" TIMESTAMP(3),
    "companyTaxId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoicingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable "Receivable"
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "originalAmount" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable "ReceivablePayment"
CREATE TABLE "ReceivablePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable "SaleReturn"
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "reason" TEXT,
    "totalRefund" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable "SaleReturnItem"
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refundAmount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: una configuración fiscal por tenant
CREATE UNIQUE INDEX "InvoicingConfig_tenantId_key" ON "InvoicingConfig"("tenantId");

-- CreateIndex "Receivable_tenantId_idx"
CREATE INDEX "Receivable_tenantId_idx" ON "Receivable"("tenantId");

-- CreateIndex "Receivable_saleId_idx"
CREATE INDEX "Receivable_saleId_idx" ON "Receivable"("saleId");

-- CreateIndex "ReceivablePayment_receivableId_idx"
CREATE INDEX "ReceivablePayment_receivableId_idx" ON "ReceivablePayment"("receivableId");

-- CreateIndex "ReceivablePayment_tenantId_idx"
CREATE INDEX "ReceivablePayment_tenantId_idx" ON "ReceivablePayment"("tenantId");

-- CreateIndex "SaleReturn_tenantId_idx"
CREATE INDEX "SaleReturn_tenantId_idx" ON "SaleReturn"("tenantId");

-- CreateIndex "SaleReturn_saleId_idx"
CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");

-- CreateIndex "SaleReturnItem_returnId_idx"
CREATE INDEX "SaleReturnItem_returnId_idx" ON "SaleReturnItem"("returnId");

-- CreateIndex "SaleReturnItem_itemId_idx"
CREATE INDEX "SaleReturnItem_itemId_idx" ON "SaleReturnItem"("itemId");

-- AddForeignKey "InvoicingConfig_tenantId_fkey"
ALTER TABLE "InvoicingConfig" ADD CONSTRAINT "InvoicingConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "Receivable_tenantId_fkey"
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "Receivable_saleId_fkey"
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "Receivable_personId_fkey"
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey "ReceivablePayment_tenantId_fkey"
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "ReceivablePayment_receivableId_fkey"
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "SaleReturn_tenantId_fkey"
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "SaleReturn_saleId_fkey"
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "SaleReturn_cashSessionId_fkey"
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey "SaleReturnItem_returnId_fkey"
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey "SaleReturnItem_itemId_fkey"
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;