-- M5 — one OPEN cash session per BRANCH (not per tenant).
--
-- The tenant-wide application guard is replaced by a per-branch one: branch B
-- must be able to sell while branch A's register is open. Prisma cannot express
-- a partial (predicate) unique index, so this ships as hand-written SQL — the
-- same pattern already used by `20260925120000_velocity_sort_index`.
--
-- SAFE TO APPLY BEFORE THE CODE CHANGE: the index enforces strictly LESS than
-- today's application guard. It only forbids two OPEN sessions on the SAME
-- branch, and today's guard already forbids two OPEN sessions in the whole
-- tenant — so no currently-valid state becomes invalid.
--
-- PRE-CHECK (must return 0 rows before applying):
--   SELECT "tenantId", "branchId", COUNT(*) AS open_rows
--   FROM "CashSession"
--   WHERE "status" = 'OPEN'
--   GROUP BY "tenantId", "branchId"
--   HAVING COUNT(*) > 1;
-- This is impossible under today's tenant-wide guard but IS possible in
-- hand-edited data, and it would make this CREATE UNIQUE fail.
--
-- This index is ALSO the access path for the server-derived branch lookup, so
-- the D11 chain needs no extra index.
--
-- REVERSAL: DROP INDEX "CashSession_one_open_per_branch";
CREATE UNIQUE INDEX "CashSession_one_open_per_branch"
  ON "CashSession"("tenantId", "branchId")
  WHERE "status" = 'OPEN';
