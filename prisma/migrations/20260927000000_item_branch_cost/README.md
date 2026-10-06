# M1 — ItemBranchCost migration

- Authored only; never applied.
- Creates table ItemBranchCost with unique (tenantId,itemId,branchId) and indexes.
- Seeds from existing Item.cost for every (tenantId,itemId,branchId) pair present in Inventory.
- Reversal: DROP TABLE "ItemBranchCost".

See openspec/changes/distribution-lots-fefo-transfers/tasks.md for details.
