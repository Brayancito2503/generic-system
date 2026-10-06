# Apply Progress — distribution-lots-fefo-transfers (PR 1)

**Phase:** apply · **Slices in scope:** S0a, S0b, S1a, S1b, S1c · **Status:** complete

PR 1 covers branch management, branch-explicit inventory, and D11 — one OPEN cash
session per `(tenantId, branchId)` with the register's branch derived
server-side. Slices S2a and later are **not** implemented here.

---

## Slice status

| Slice | Scope | Status |
|---|---|---|
| S0a | `Branch` entity, port, Zod schemas, repository CRUD, `POST/GET /api/distribution/branches` | done |
| S0b | `GET/PATCH /api/distribution/branches/[id]`, `BranchesView.tsx`, role gate, symmetric `en`/`es` messages | done |
| S1a | `InventoryStockItem.branchId`, branch-explicit `getInventory`, duplicate-free rows, velocity ranks each product once | done |
| S1b | M5 migration + server-derived session branch (D11 steps 1–2), `OpenCashSessionInput` loses `branchId` and gains `userId`, per-branch 409, branch-scoped sale lookup, zero-stock rows for a new branch | done |
| S1c | D11 steps 3–4 in-transaction (session claim as the transaction's first write), failure codes/messages, derived `getOpenCashSession`/`getDashboard`, `LEGACY_STATUS_BY_MESSAGE` cleanup | done |

---

## Files created or modified

### Migrations

| File | Notes |
|---|---|
| `prisma/migrations/20260926090000_cash_session_one_open_per_branch/migration.sql` | **M5.** `CREATE UNIQUE INDEX "CashSession_one_open_per_branch" ON "CashSession"("tenantId","branchId") WHERE "status" = 'OPEN';` — authored only, never applied. Ships a pre-check query, a reversal note, and the safe-to-apply-before-the-code-change rationale. |

### Core (`src/core`)

| File | Change |
|---|---|
| `src/core/ports/distribution-repository.port.ts` | Branch CRUD contracts; `OpenCashSessionInput` loses `branchId`, gains `userId`; `getOpenCashSession(tenantId, userId)` and `getDashboard(tenantId, userId)` now take the session user. |
| `src/core/schemas/distribution.ts` | Branch schemas added; `branchId` dropped from `openCashSessionSchema` (the non-strict object strips an older client's key instead of rejecting it). |
| `src/core/entities/distribution.ts` | `BranchEntity`; `InventoryStockItem.branchId`. |
| `src/core/schemas/distribution.test.ts` | Branch schema coverage. |

### Infrastructure (`src/infrastructure`)

| File | Change |
|---|---|
| `src/infrastructure/db/repositories/prisma-distribution.repository.ts` | Branch CRUD; `deriveSaleBranch` (D11 steps 1–2); `openCashSession` derived + per-branch 409; `registerSale` branch-scoped lookup and in-transaction D11 steps 3–4 with the guarded session claim; `getOpenCashSession`/`getDashboard` branch-derived; zero-`Inventory` rows per existing product when a branch is created. |
| `.../prisma-distribution.session-binding.test.ts` | **New.** D11-1…D11-8. |
| `.../prisma-distribution.branch.test.ts` | Branch persistence + the R3 zero-stock provisioning tests. |
| `.../prisma-distribution.fractional.test.ts` | `employee.findFirst` / `branch.findMany` / `cashSession.updateMany` added to the transaction mock surface. |
| `.../prisma-distribution.sale-unit.test.ts` | Same mock-surface addition. |
| `.../prisma-distribution.velocity-sort.test.ts` | S1a velocity/duplicate-row coverage. |

### API routes (`src/app/api/distribution`)

| File | Change |
|---|---|
| `branches/route.ts` | **New.** `GET`/`POST` branches. |
| `branches/route.test.ts` | **New.** Route coverage. |
| `branches/[id]/route.ts` | **New.** `GET`/`PATCH` branch, tenant-scoped. |
| `cash/route.ts` | `POST` forwards `session.userId` (no client branch); `GET` resolves the register at the caller's own branch. |
| `cash/route.test.ts` | **New.** Proves `userId` is forwarded and a client `branchId` cannot select a branch. |
| `dashboard/route.ts` | Threads `requireApiAuth`'s payload; `getDashboard(tenantId, session.userId)`. |
| `dashboard/route.test.ts` | **New.** |
| `inventory/route.test.ts` | Fixture gains the now-required `branchId`. |

### UI, messages, shared (`src/modules`, `messages`, `src/lib`)

| File | Change |
|---|---|
| `src/modules/distribution/components/BranchesView.tsx` | **New.** Branch management view. |
| `src/modules/distribution/components/DistributionModuleApp.tsx` | Wires the branches view into the module. |
| `src/modules/distribution/lib/roles.ts` | Branch-management role gate. |
| `src/modules/distribution/components/InventoryView.tsx` | Create payload typed as `Omit<CreateInventoryItemInput, 'userId'>` — an alta's stock row is branch-scoped server-side, so the client cannot name a branch. |
| `messages/en.json`, `messages/es.json` | Symmetric branch-management keys. |
| `src/lib/api-error.ts` | Removed the now-unreachable legacy `'Debe abrir la caja antes de registrar una venta'` mapping (D11 replaced it with the per-branch message). |

### Untouched (parallel work, deliberately not modified)

`README.md`, `docs/`, and `openspec/changes/**` other than this file.

---

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/infrastructure/db/repositories/prisma-distribution.session-binding.test.ts` | **17 passed** (RED before S1c: 12 failed / 5 passed) |
| `npx vitest run src/app/api/distribution/cash/route.test.ts src/app/api/distribution/dashboard/route.test.ts src/infrastructure/db/repositories/prisma-distribution.session-binding.test.ts` | **32 passed** |
| `npx vitest run src/infrastructure/db/repositories/prisma-distribution.session-binding.test.ts src/infrastructure/db/repositories/prisma-distribution.branch.test.ts src/app/api/distribution/cash/route.test.ts src/app/api/distribution/branches/route.test.ts` | **46 passed** |
| `npx vitest run src/infrastructure/db/repositories/prisma-distribution.fractional.test.ts src/infrastructure/db/repositories/prisma-distribution.sale-unit.test.ts src/infrastructure/db/repositories/prisma-distribution.inventory-ledger.test.ts` | **24 passed** |
| `npm test` | **30 files, 273 tests passed** (32.09s) |
| `npm run typecheck` | clean |
| `npm run lint` | clean |

`git diff --stat` (tracked files only): **18 files changed, 870 insertions(+), 86 deletions(-)**.
That figure excludes untracked files; the new files added by PR 1 total 1 126
lines (cash route test 166, dashboard route test 74, session-binding suite 421,
branch suite 180, M5 migration 28, plus the pre-existing untracked branch route,
route test, `[id]` route and `BranchesView`).

---

## Deliberately deferred

- **S2a and later** (FEFO engine, lots, transfers, lot-aware returns) are out of
  this PR's scope.
- **M5 was authored, not applied.** No `prisma migrate`/`db push`/deploy ran and
  no live-database query was made. The pre-check in the migration file must be
  run and return 0 rows by an operator before applying it.
- **`closeCashSession` is still read-then-write outside any transaction.** D11's
  claim makes the *sale* side safe, but a sale whose claim lands after the close's
  aggregate can still be omitted from `expectedAmount`. Pre-existing defect,
  tracked as **R11**, and out of scope by design.
- **The concurrency claim is proven by shape, not by real interleaving.** The CI
  mock (`$transaction: fn => fn(tx)`) cannot express two concurrent writers. The
  session-binding suite pins the guard's shape, its first-write position, and that
  nothing is written when the claim is lost; it does **not** prove Postgres
  serialization. Live-DB concurrency evidence stays the **G5/T2** gate before
  S5b.
- **No machine-readable error code.** `ApiError` carries `(status, message)`
  only, and the UI cannot branch on a code it cannot read. Tracked as **R13**.
- **`firstBranchOfTenant` was kept.** It still serves the unnamed-stock-write
  paths; only the cash/sale paths moved to derived branches.

## Notes on the design as written

- D11's step-3 snippet selects `{ id: true, branchId: true }` while step 4 writes
  `data: { notes: session.notes }`. The select therefore also reads `notes`;
  without it the claim cannot compile, and it changes no guarantee.
- `getDashboard` deliberately tolerates an underivable branch (returns no
  register) while `getOpenCashSession` stays strict. The dashboard is a
  tenant-wide read whose viewer may be a manager with no `Employee` row, and
  failing that whole page would be a regression no spec asks for. Only the cash
  endpoints surface the actionable 400.

---
---

# Apply Progress — distribution-lots-fefo-transfers (PR 2)

**Phase:** apply (corrective retry, attempt 2) · **Slices in scope:** S2a, S2b · **Status:** complete

PR 2 gives cost a BRANCH dimension: an `ItemBranchCost` model, and the reroute of
every live `Item.cost` consumer plus **deletion** of the tenant-wide write. Builds
on PR 1 (`27de604`).

> Attempt 1 of this slice built the accessor but wired nothing to it and reported
> `success`. It was reverted here and redone from the failing test up.

---

## Slice status

| Slice | Scope | Status |
|---|---|---|
| S2a | `ItemBranchCost` entity, port method, **schema model** + M1 migration authored | done |
| S2b | Reroute **9** `Item.cost` read sites (8 rerouted, 1 deliberately out of scope); delete the tenant-wide `tx.item.update` write | done |

---

## What actually changed in behavior

**The tenant-wide write is gone.** `receivePurchaseOrder` no longer computes a
weighted average against the tenant-wide `Item.cost` and writes it back. It
resolves the RECEIVING branch's cost first, then writes only
`ItemBranchCost(tenantId, itemId, branchId)`. `tx.item.update` is not called from
the receive path at all.

**`Item.cost` is now a frozen catalog seed.** It is written exactly once, by
`tx.item.create` when a product is created. No code path updates it. That is a
CREATE, not an UPDATE — the column is `NOT NULL` with no default, and M1 seeds
every existing pair from it, so removing the seed would leave the column
meaningless. Its only remaining role is the fallback seed in `resolveBranchCost`.

**The manual cost edit moved too.** `updateInventoryItem` used to write
`input.cost` into `Item.cost` via the catalog PATCH — a second tenant-wide write
the slice list did not name. It now writes the named branch's `ItemBranchCost`
and **requires a `branchId`** (400 `Debe indicar la sucursal para actualizar el
costo` otherwise), mirroring the `minAlert` guard that already existed. `cost`
was removed from the `itemData` payload entirely.

### Read sites — measured, not estimated

Enumerated by grepping `item.cost` in the repository. **9 sites**, 8 rerouted,
1 left alone on purpose:

| # | Site | Consumer | Action |
|---|---|---|---|
| 1 | `getInventory` | inventory list cost | one `branchCostMap` query per distinct branch; falls back to the seed |
| 2 | `createInventoryItem` | alta response | seeds the branch cost in the same tx and reports it |
| 3 | `updateInventoryItem` | PATCH response | reports the named branch's cost |
| 4 | `receivePurchaseOrder` | **the weighted average** | **resolved before the write; the write is branch-scoped** |
| 5 | `createPurchaseOrder` | PO subtotal + PO line cost | priced from the ordering branch |
| 6 | `createInventoryAdjustment` | ledger `costSnapshot` | the adjusted branch's cost |
| 7 | `createInventoryCountBatch` | ledger `costSnapshot` | the counted branch's cost |
| 8 | `registerSale` | `SaleItem.cost` snapshot | the **selling** branch's cost (D11-derived) |
| 9 | `getFiscalSummary` | fiscal profit | **NOT touched — see below** |

Sites 6 and 7 were **not** in the slice brief's list of 8; the design's line
numbers are stale and its "seven read sites" undercounts. Nine is what the file
contains.

### `getFiscalSummary` — deliberately untouched (R5)

Profit is `Σ (SaleItem.price − Item.cost) × qty`: the live tenant-wide cost
against **historical** prices. It is wrong today and still wrong, and S2b makes
it wrong in a new static way (the scalar no longer moves on a receive).

Routing it through `resolveBranchCost` would **not** fix it: the query has no
branch dimension, so any branch cost picked there would be arbitrary *and* would
re-introduce live re-pricing against historical prices. It needs the
`SaleItem.cost` snapshot, which this repository already writes and which S2b has
just re-pointed at the selling branch. Left alone, with a comment marking it.

---

## Files created or modified

### Migrations

| File | Notes |
|---|---|
| `prisma/migrations/20260927000000_item_branch_cost/migration.sql` | **M1.** `CREATE TABLE "ItemBranchCost"` + seed from `Item.cost` per existing `(tenantId,itemId,branchId)` in `Inventory`, plus indexes, FKs and a reversal note. **Authored only, never applied.** |
| `prisma/migrations/20260927000000_item_branch_cost/README.md` | Notes for M1. |

### Schema

| File | Change |
|---|---|
| `prisma/schema.prisma` | **Added the missing `model ItemBranchCost`** — see the note below. Attempt 1 added the three relations but never the model, so `npx prisma validate` FAILED on this tree and `prisma generate` had no `itemBranchCost` delegate. `npm test` / `typecheck` / `lint` do not run `prisma validate`, which is how a broken schema passed three gates. |

### Core (`src/core`)

| File | Change |
|---|---|
| `src/core/entities/distribution.ts` | `ItemBranchCostEntity`. |
| `src/core/ports/distribution-repository.port.ts` | `getItemBranchCost()` on the port. |

### Infrastructure (`src/infrastructure`)

| File | Change |
|---|---|
| `.../prisma-distribution.repository.ts` | New `BranchCostDb` type + `branchCostMap` / `resolveBranchCost` / `writeBranchCost` helpers. Receive, inventory, alta, PATCH, PO create, sale, adjustment and count-batch rerouted. Tenant-wide write deleted. `getItemBranchCost` normalized (the inline `import('...')` type and the `globalThis.prisma` fallback hack are gone; it uses the typed client and the compound unique). |
| `.../prisma-distribution.branch-cost.test.ts` | **Rewritten.** 13 tests: cross-branch isolation, the same-branch weighted average, 2dp rounding, first arrival into an empty branch, the manual branch-scoped PATCH (accepted with a branch, rejected with a 400 without one), plus one behavioral test per rerouted read site. |

### Mock surfaces (5 files)

`itemBranchCost: { findMany, findUnique, upsert }` added to the mocked Prisma
client — the same mock-surface growth PR 1 recorded for D11.

| File | Change |
|---|---|
| `.../fractional.test.ts` | Mock surface; **the assertion that pinned the deleted `item.update({ data: { cost } })` now asserts the branch-scoped `upsert` and `itemUpdate` not called.** |
| `.../inventory-ledger.test.ts` | Mock surface. |
| `.../sale-unit.test.ts` | Mock surface. |
| `.../session-binding.test.ts` | Mock surface. |
| `.../velocity-sort.test.ts` | Mock surface; renamed the now-false test "reports cost from the catalog while the branch cost model is still unbuilt" → "reports the frozen catalog seed for a branch with no `ItemBranchCost` row yet", and added a test that two branches of one product report different costs. |

### Untouched

`README.md`, `docs/` (own commit `cb52510`). No `messages/*.json` change: the new
400 is a repository `ApiError`, and every sibling repository error is a Spanish
literal rather than a next-intl key.

---

## Work unit evidence

### RED → GREEN

| Stage | Command | Result |
|---|---|---|
| Baseline | `npm test` | 31 files, **275** tests passed |
| Schema gate | `npx prisma validate` | **FAILED** — `Type "ItemBranchCost" is neither a built-in type…` (×3) |
| RED (written first) | `npx vitest run …branch-cost.test.ts` | **7 failed / 3 passed** (of the 10 tests written first) |
| GREEN (focused) | `npx vitest run …branch-cost.test.ts` | **13 passed (13/13)** — the 2 `updateInventoryItem` PATCH tests were added after the first GREEN, so RED was re-observed for them at 2 failed / 11 passed before wiring |
| GREEN (full) | `npm test` | 31 files, **287** tests passed (12.38s) — baseline 275 + 12 net |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | clean |
| Lint | `npm run lint` (ESLint 9) | clean |
| Schema gate | `npx prisma validate` | **valid** |
| Client | `npx prisma generate` | ran with **no `next dev`** process alive (G3) |

Runtime harness: **N/A** — no live database. No `migrate dev`, `migrate reset`,
`db push` or `migrate deploy` ran, and no live-DB query was made (G1). The
branch-cost behavior is proven against a mocked Prisma client, which cannot
express a partial index nor real concurrency; see the residual risks below.

### Rollback boundary

- **S2b (code only, no DDL):** revert `prisma-distribution.repository.ts` to
  read/write `Item.cost`, drop the three helpers, and revert the six test files'
  mock surfaces. `ItemBranchCost` rows become orphaned but harmless — M1 is
  independent and can stay applied.
- **S2a (model + M1):** `DROP TABLE "ItemBranchCost"` (cascades its indexes and
  FKs) plus a code revert. Nothing else in the system reads it.
- No rollback touches PR 1's branch/session work.

### Diff

`git diff --stat` (tracked): **10 files changed, 624 insertions(+), 34 deletions(-)**,
of which **198** is this PR 2 record. Code and tests are the remaining ~426.
Untracked and new: `migration.sql` 41, migration `README.md` 6,
`branch-cost.test.ts` 499.

---

## Residual risks and deferred work

- **M1 is authored, NOT applied.** The app reads `ItemBranchCost` on every
  inventory, PO, sale and adjustment path, so the DDL must be applied over
  `DIRECT_URL` before this code runs — per `DATABASE.md:25-29`, not via
  `prisma migrate`. Until then the code degrades to the frozen `Item.cost` seed
  and behaves exactly as it does today (no crash only because the table is
  queried, not assumed: **if the table does not exist, every one of these paths
  throws**). The seed fallback covers a missing ROW, not a missing TABLE.
- **A branch created after M1 gets no `ItemBranchCost` rows.** PR 1 provisions
  zero-stock `Inventory` rows for existing products on branch creation and this
  slice did not extend that to costs. Those pairs report the frozen catalog seed
  until their first receive, which then adopts the incoming cost. Deterministic
  and not a wrong-number-where-a-right-one-existed case (no branch cost has ever
  been written for them), but it is a visible gap.
- **`getFiscalSummary` (R5) is still wrong**, now statically instead of
  live-mutating. Needs the `SaleItem.cost` snapshot, not a branch-scoped read.
- **The CI mock cannot prove the M1 seed.** `$transaction: fn => fn(tx)` and a
  hand-written `itemBranchCost` mock say nothing about the real
  `INSERT … SELECT … WHERE NOT EXISTS` idempotency, nor about the unique index
  under concurrency. Live-DB evidence for M1 is still an operator gate.
- **No machine-readable error code** for the new 400. Pre-existing **R13**.
- **`Item.cost` is now dead weight** for every pair M1 covered. It is kept only
  as the create-time seed and the missing-row fallback; a later slice can drop
  the column once no path reads it as a fallback.