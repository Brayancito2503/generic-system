-- M1: Create ItemBranchCost table + seed from existing Item.cost per (tenantId, itemId, branchId)
-- This migration is authored only and must NOT be applied automatically.

CREATE TABLE "ItemBranchCost" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "cost" DECIMAL(10, 2) NOT NULL,
  CONSTRAINT "ItemBranchCost_pkey" PRIMARY KEY ("id")
);

-- Seed: every Inventory row gets its own ItemBranchCost row seeded from the current
-- Item.cost (frozen catalog baseline). Idempotent via the NOT EXISTS anti-join.
--
-- TENANT ISOLATION (AGENTS.md Rule #1): the Item join MUST be tenant-scoped and the
-- Branch MUST belong to the same tenant. The three FKs below each validate a column
-- independently, so a hand-edited Inventory row whose branchId points at another
-- tenant's branch would otherwise insert a cross-tenant cost row silently -- FKs
-- pass, unique index passes, nothing complains.
INSERT INTO "ItemBranchCost" ("id", "tenantId", "itemId", "branchId", "cost")
SELECT
  gen_random_uuid()::text AS "id",
  i."tenantId",
  i."id" AS "itemId",
  inv."branchId",
  i."cost"
FROM "Inventory" inv
INNER JOIN "Item" i
  ON i."id" = inv."itemId"
 AND i."tenantId" = inv."tenantId"
WHERE EXISTS (
  SELECT 1
  FROM "Branch" b
  WHERE b."id" = inv."branchId"
    AND b."tenantId" = inv."tenantId"
)
AND NOT EXISTS (
  SELECT 1
  FROM "ItemBranchCost" ibc
  WHERE ibc."tenantId" = i."tenantId"
    AND ibc."itemId" = i."id"
    AND ibc."branchId" = inv."branchId"
);

CREATE INDEX "ItemBranchCost_tenantId_branchId_idx" ON "ItemBranchCost"("tenantId", "branchId");
CREATE UNIQUE INDEX "ItemBranchCost_tenantId_itemId_branchId_key" ON "ItemBranchCost"("tenantId", "itemId", "branchId");

ALTER TABLE "ItemBranchCost"
  ADD CONSTRAINT "ItemBranchCost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemBranchCost"
  ADD CONSTRAINT "ItemBranchCost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemBranchCost"
  ADD CONSTRAINT "ItemBranchCost_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reversal: DROP TABLE "ItemBranchCost" (cascades indexes/constraints)
-- ROLLBACK (manual): DROP TABLE "ItemBranchCost";