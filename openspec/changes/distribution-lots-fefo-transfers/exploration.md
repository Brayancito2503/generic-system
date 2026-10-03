# Exploration: distribution-lots-fefo-transfers — Lotes (FEFO) + Traspasos entre sucursales

**Phase**: explore (research only — no code, schema, migration, or i18n file was modified).
**Verified against**: `dc42129` (HEAD). Every claim below is anchored to a file path and line range read in this session.
**Verified absent**: zero matches for `lotId|lotNumber|FEFO|expiresAt|expiryDate|lotCode` in `src/**` and `prisma/schema.prisma`; zero matches for `lot|lote|batch|expir|transfer|traspas` in `openspec/specs/*/spec.md`. Fase 3 is greenfield.

---

## Quick path (read in this order)

1. [Current state](#1-current-state-audit-of-the-stock-model) — 7 stock write paths, one ledger helper, and one blocking prerequisite already known to the repo.
2. [Lots](#2-lotes--batches-with-expiry-product-decisions-required) — 2 viable models, 1 excluded, 8 product questions.
3. [FEFO](#3-fefo-consumption-first-expired-first-out) — what the sale path must actually do, and the one structure that cannot express a split line.
4. [Transfers](#4-traspasos-inter-branch-transfers) — branches exist as a model but **cannot be created through the product**.
5. [Open questions](#5-open-questions-ranked-by-architectural-impact) — 4 product decisions that change the architecture vs 9 we can decide.
6. [Slices](#6-proposed-decomposition) — 9 work units, 3 over the 400-line budget.

---

## 1. Current state: audit of the stock model

### 1.1 Where stock lives

| Table | Role | Evidence |
|---|---|---|
| `Item` | Catalog. `cost Decimal(10,2)`, `price`, `saleUnit ItemSaleUnit?`. **Tenant-wide — carries no `branchId`.** | `prisma/schema.prisma:159-183` |
| `Inventory` | The stock table. `stock Decimal(10,2)`, `minAlert Int`, `@@unique([tenantId, itemId, branchId])`. **One row per item × branch. No lot dimension.** | `prisma/schema.prisma:185-196` |
| `InventoryMovement` | Kardex ledger. `branchId` + `itemId` + `type` + signed `quantity` + `costSnapshot` + `refId`. **No `lotId`.** | `prisma/schema.prisma:203-222` |
| `Branch` | Exists as a real model, `@@index([tenantId])`. | `prisma/schema.prisma:104-119` |
| `SaleItem` | Sale line. `quantity`/`price`/`cost` Decimal. **No `tenantId`** (reached through `sale`), and **no `branchId`** (reached through `sale.cashSession`). | `prisma/schema.prisma:259-277` |

### 1.2 The seven stock write paths (all in `prisma-distribution.repository.ts`, 2988 lines)

| # | Path | Method : line | Stock write | Ledger row | Cost source |
|---|---|---|---|---|---|
| 1 | Item alta | `createInventoryItem` : 524 | `tx.inventory.create` : 560 | `INITIAL` : 570 | `input.cost` |
| 2 | Item edit | `updateInventoryItem` : 599 | **forbidden** — 400 at : 615 | — | — |
| 3 | PO receive | `receivePurchaseOrder` : 853 | `stock: { increment: qty }` : 944 | `RECEIVE` : 948 | `poItem.cost` → re-averages `Item.cost` : 933-943 |
| 4 | Sale | `registerSale` : 1938 | `updateMany` + `stock: { gte }` guard : 2033-2041 | `SALE`, one per `SaleItem` : 2121 | `Item.cost` → `SaleItem.cost` : 2094 |
| 5 | Return | `createSaleReturn` : 2268 | `updateMany` + `increment` at sale branch : 2350 | `RETURN`, one per line : 2424 | `SaleItem.cost` : 2432 |
| 6 | Adjustment | `createInventoryAdjustment` : 2751 | `stock: { increment }` : 2789 | `ADJUSTMENT` : 2793 | `Item.cost` : 2801 |
| 7 | Physical count | `createInventoryCountBatch` : 2831 | `stock: { increment: diff }` : 2871 | `ADJUSTMENT` (MERMA/SOBRANTE) : 2875 | `Item.cost` : 2883 |

**Single choke point — good news.** Every one of these 7 paths writes its ledger row through one helper, `recordMovement(tx, params)` (`: 116-134`), whose `MovementParams` (`: 98-109`) is the complete field list of a movement. Adding a lot dimension to the ledger is **one field in one interface + one column**, not seven edits. Paths 1, 3, 7 write the ledger row inline (`tx.inventoryMovement.create` at : 570 is via the helper, but : 2793 and : 2875 are direct calls with the same field set) — so the helper is *near*-universal, not universal, and paths 6/7 must be folded into it or kept in lockstep.

**No float drift — already correct.** Every quantity-bearing guard uses `Prisma.Decimal` (`: 898`, `: 938`, `: 969`, `: 2038`, `: 2328`) and every ranking compares with `comparedTo` (`: 515-517`, `: 969`) rather than float subtraction. FEFO must reuse these, not invent a parallel style.

### 1.3 Branch resolution is asymmetric — this is the real constraint

| Operation | How the branch is resolved | Client-supplied? | Evidence |
|---|---|---|---|
| Sale | **Open cash session's branch** — `cashSession.findFirst({ tenantId, status: 'OPEN' })` | No | : 1961-1967 |
| Return | **Sale's cash session branch** — `sale.cashSession.branchId` | No | : 2291, : 2347 |
| Item alta | **First branch of tenant** — `orderBy: { createdAt: 'asc' }` | No | : 247-252, : 528 |
| Open cash session | `firstBranchOfTenant(tenantId, input.branchId \|\| undefined)` | Yes | : 1468 |
| PO create | `input.branchId`, tenant-guarded | Yes | : 1027, schema `distribution.ts:66` |
| Adjustment / count | `input.branchId`, tenant-guarded | Yes | : 2767, : 2843 |
| **Inventory list** | **No branch dimension at all** | No | : 483-487 |

Consequences that matter for Fase 3:

- **A sale at branch B requires a cash session open at B.** There is no `UNIQUE` partial index on `(tenantId, branchId) WHERE status='OPEN'` — `openCashSession` guards duplicates via `findFirst` + a 409 in app code. Two branches can hold two open sessions; `registerSale` then picks an **arbitrary** one (`findFirst` with no `orderBy`, : 1962). Real defect once branch B exists.
- **`createInventoryItem` always stocks the oldest branch** (: 528). A second branch never gets an `Inventory` row for an existing product.
- **`getInventory` returns one row per `Inventory` row, keyed `id: row.item.id`** (: 491). With the same item in branches A and B, the list returns **two rows with the same `id` and the same `unitsSold30d`**. The velocity sort (: 506-519) then ranks the duplicate twice. This is a latent multi-branch read defect that becomes user-visible the day a second branch exists. The archived apply log already recorded the missing branch surface — `openspec/changes/distribution-complete/apply-progress.md:212`, deviation 3: *"No branch endpoint exists (content): PO create requires `branchId` but no branch-listing API exists."*

### 1.4 Weighted-average cost — the conflict with lots, stated plainly

`Item.cost` is **tenant-wide** (`prisma/schema.prisma:166`, no `branchId`). But the weighted average is computed from a **branch-scoped** stock (`: 933-938`):

```
newCost = (inventory.stock·item.cost + qty·lineCost) / (inventory.stock + qty)
```

and written back to the single tenant-wide `Item.cost` (`: 940-943`).

**Finding (read, not executed):** with two branches, receiving into branch B rewrites the one `Item.cost` using branch B's stock. Branch A's stock is then reported and sold at a cost derived from branch B. This is a pre-existing defect that does not need lots to exist — but lots make it unignorable, because a lot's cost is a *per-lot* fact and `Item.cost` is a single scalar.

**The costing decision Fase 3 must make:** does `Item.cost` remain the source of truth (lots inherit it), or does a lot-level cost become the source of truth and `Item.cost` become a derived rollup? Downstream consumers that read it: `SaleItem.cost` snapshot (: 2094), daily-close `lineCost` (: 2655), daily-close `mermaCost` (: 2619-2627), adjustment `costSnapshot` (: 2801, : 2883), return `costSnapshot` (: 2432). Five consumers, all in one file.

### 1.5 Blast radius of introducing a per-lot dimension

| Area | Files | Why it changes |
|---|---|---|
| Schema | `prisma/schema.prisma` | New model or new unique key; `InventoryMovement.lotId`; possibly `SaleItem.lotId` |
| Migration | `prisma/migrations/<ts>_*/migration.sql` | Additive-only, hand-applied — `DATABASE.md:18-29`: the DB has **no `_PrismaMigrations` table**; `prisma migrate dev` must not be run unsupervised |
| Domain entities | `src/core/entities/distribution.ts` (443 lines) | `InventoryStockItem`, `InventoryMovementEntity`, `SaleLineEntity`, `MermaSummary` |
| Port | `src/core/ports/distribution-repository.port.ts` (505 lines) | `IDistributionRepository` — new methods + input contracts |
| Adapter | `src/infrastructure/db/repositories/prisma-distribution.repository.ts` (2988 lines) | All 7 write paths; `recordMovement`; `getInventory`; `getDailyCloseReport` |
| Schemas | `src/core/schemas/distribution.ts` (413 lines) | New Zod contracts; `listMovementsQuerySchema` already accepts `TRANSFER_OUT`/`TRANSFER_IN` (: 294-303) |
| Routes | `src/app/api/distribution/**` (22 route files) | New endpoints; `registerSale` payload unchanged if FEFO is server-side |
| UI | `InventoryView.tsx` (484), `SalesPOSView.tsx` (680), `InventoryCountView.tsx` (245), `InventoryMovementsView.tsx` (424), `DistributionModuleApp.tsx` (167) | Lot columns, expiry badges, new tab |
| i18n | `messages/es.json` + `messages/en.json` (732 lines each) | Every new key in **both** locales — a hard per-slice cost |
| Tests | 4 existing repo suites + 4 route suites | Prisma client is mocked at the db layer with hand-built tx mocks — a new model means new mock surface in each |

---

## 2. Lotes / batches with expiry — product decisions required

### 2.1 Model options

| Option | Shape | Migration cost | Blast radius |
|---|---|---|---|
| **A — `Lot` owns the stock** | New `Lot` model (`tenantId`, `itemId`, `branchId`, `code`, `expiryDate?`, `manufactureDate?`, `cost`). `Inventory.stock` becomes a rollup or is retired. | New table + backfill from `Inventory` + rewrite of all 7 write paths. Highest. | Every read that reads `Inventory.stock` changes: `getInventory` (: 498), `getDashboard` low-stock (: 324-330), `isLowStock` (: 500). |
| **B — `Inventory` gains `lotId?`** | `@@unique([tenantId, itemId, branchId, lotId])`; a null/sentinel `lotId` row represents "no lot". Stock stays in `Inventory`. | New column + new unique index + backfill. Medium. | `getInventory` must now **group** rows per item or it returns N rows per item — this also fixes §1.3's duplicate-row defect. Allocation logic replaces the single `updateMany` guard. |
| **C — lot inside `Item.attributes` (JSONB)** | `{ expiryDate, lotCode }` on the item. | Trivial. | **Excluded by the project's own rules.** No FK, no index, no referential integrity, and FEFO would need to order by a JSONB date — unqueryable in Prisma with a usable index. Also breaks Rule #1-style isolation guarantees on the new dimension and Rule #2 (no `any`/untyped JSONB). Recorded here so the option is visibly *considered and rejected on rule grounds*, not silently dropped. |

**A vs B is a product decision we should not make.** Option A gives a clean lot ledger and natural "all lots of this item at this branch" queries but makes every existing stock read a join or a rollup. Option B keeps every existing read shape and confines the change to allocation, at the price of a nullable key in the unique constraint and a "null lot" sentinel row that every reader must understand.

### 2.2 Open product questions (these need a HUMAN decision)

| # | Question | Why it is a product decision | Anchor |
|---|---|---|---|
| L1 | Is a lot **mandatory per item** or **opt-in per item**? | Opt-in needs a per-item flag (a new `Item` column, and it interacts with `saleUnit`/legacy items). Mandatory forces a lot decision on every purchase receive, changing the PO flow. | `createInventoryItem` : 524-597; `receivePurchaseOrder` : 906-962 |
| L2 | Does a lot carry `expiryDate`, `manufactureDate`, a supplier lot code, or all three? | Changes which columns are nullable, which changes FEFO's ordering key and the "no expiry" rule. | — |
| L3 | **Multiple lots of the same item simultaneously?** | If yes, `Inventory`/`Lot` becomes 1-to-N and every list read changes. If no, a lot is just extra metadata on one row. | `Inventory @@unique` : 195 |
| L4 | **Partial quantities across lots** — a sale of 12 units consuming 5 from lot A and 7 from lot B? | This is the decision that forces a structural change: `registerSale` **merges duplicate itemIds into one line** (: 1946-1959) and `saleLineSchema` is `{itemId, quantity}` (`schemas:211-214`). Today 1 sale line = 1 item = 1 `Inventory` row. A split line needs either N `SaleItem` rows or a new `SaleItemLot` allocation table. | : 1946-1959, : 2032-2049 |
| L5 | How do lots interact with `Decimal(10,2)` and `Item.saleUnit` (weight vs unit)? | For `KILOGRAMO`/`LIBRA` items, "5 kg from lot A" is a fractional lot draw. Technically exact with `Decimal`; but does a *lot* of a weighed good have a meaningful expiry, or only a piece-counted good? | `Item.saleUnit` `schema:171`; `quantity2dp` `schemas:19-29` |
| L6 | Is a lot opened per **purchase order line** (one receive = one lot) or can the operator split a receive across lots? | Changes `ReceivePurchaseOrderInput` (`port:167-176`) and the `RECEIVE` ledger row count. | : 873-904 |
| L7 | Can a lot be **closed/blocked** (quarantine, damaged seal) independent of its expiry? | A state field changes FEFO's candidate filter and adds a UI affordance. | — |
| L8 | What happens to **existing stock** when the tenant turns on lots (backfill)? | Decide before the migration, not after: one synthetic "MIGRATION" lot per existing `Inventory` row, or leave those items lot-exempt forever. | `prisma/seed.ts:107` |

---

## 3. FEFO consumption — what the sale path must actually do

### 3.1 The structural blocker

`registerSale` performs **one** atomic guard per line: `inventory.updateMany({ where: { ..., stock: { gte: qty } }, data: { stock: { decrement: qty } } })` and throws 409 when `count === 0` (: 2033-2048). FEFO replaces that with:

1. Read candidate lots for `(tenantId, itemId, branchId)` ordered by `expiryDate ASC NULLS LAST` + a stable tiebreak.
2. Walk them, taking `min(remaining, lot.qty)` from each.
3. One guarded decrement per lot, each keeping its own `gte` guard.
4. If the sum of all candidate lots is short → 409, whole transaction rolls back.

The `$transaction` at : 1997 preserves the all-or-nothing property, so the current race-safety is not lost. What **is** lost: `updateMany`'s single-statement atomicity. With N sequential guarded decrements inside the transaction the outcome is still correct under Postgres READ COMMITTED, but the failure mode moves from "one statement returns count 0" to "statement k throws mid-loop" — the code must not leak partial work.

### 3.2 FEFO rules that need a decision

| # | Question | Options |
|---|---|---|
| F1 | Items with **no** expiry date on any lot | (a) consume them **last** (safest, standard), (b) consume them **first** (FIFO by `createdAt`), (c) reject FEFO for that item |
| F2 | **Earliest-expiring lot has insufficient quantity** | (a) cascade into the next lot (recommended), (b) 409 and let the operator pick |
| F3 | Lot is **already expired** (`expiryDate < today`) but has stock | (a) skip it, (b) consume it first (never waste), (c) 409 and force an adjustment first |
| F4 | Is FEFO **automatic or operator-selectable**? | Automatic keeps the sale payload unchanged (`: 216-225`) and `SalesPOSView.tsx` untouched. Selectable adds a `lotId` per line to `saleLineSchema` and a lot picker to the POS cart. |
| F5 | Do **tied** expiry dates order by anything? | Needs a deterministic tiebreak or the same sale allocates differently run to run. `createdAt ASC` is the obvious candidate. |

### 3.3 What the kardex must record per lot

`recordMovement`'s `MovementParams` (`: 98-109`) gains `lotId?: string | null`, and the ledger writes **one row per lot allocation**, not per `SaleItem` (: 2121-2132). Three consumers change behavior:

| Consumer | Today | With per-lot rows |
|---|---|---|
| `mermaCost` (`: 2619-2627`) | Σ `costSnapshot·|qty|` over ADJUSTMENT rows | **Unchanged** — it filters `type: 'ADJUSTMENT'` only (: 2608). Lot gains do not inflate merma. |
| `getMermaSummary` (`: 501-504` port) | Same filter | Unchanged |
| `getDashboard` low-stock (: 324-330) | One `Inventory` row per item | Row count multiplies → the count inflates unless grouped |
| `listInventoryMovements` (`: 2910+`) | One row per movement | Returns N rows per sale line. Correct, but the UI (`InventoryMovementsView.tsx`, 424 lines) must show which lot moved. |

**Return path, explicitly:** `createSaleReturn` restores stock to the sale branch with **no lot awareness** (`: 2346-2362`) and snapshots `SaleItem.cost` (`: 2432`). Under FEFO a returned near-expiry good must go back to *its* lot, not to "whatever the allocator picks" — otherwise the expiry timeline silently rewrites itself. That requires `SaleItem.lotId` (or an allocation table) so the return can read the original allocation. This is a **product** decision, not a technical one: exact-lot restore (better audit, more work) vs re-allocate (cheaper, rewrites history).

---

## 4. Traspasos — inter-branch transfers

### 4.1 Do branches exist? YES as a model. NO as a product capability.

| Fact | Evidence |
|---|---|
| `Branch` model exists, `@@index([tenantId])`, relations to Inventory/InventoryMovement/PurchaseOrder/Employee/CashSession | `prisma/schema.prisma:104-119` |
| The seed creates exactly **one** branch, "Sucursal Central Managua" | `prisma/seed.ts:83-86` |
| Tenant creation creates exactly one branch, hardcoded name `'Sucursal Principal'` | `src/app/api/admin/tenants/route.ts:71-74` |
| **No branch CRUD exists in the distribution vertical.** The only `branch.create` under `src/` is the tenant-provisioning line above. No `GET /api/distribution/branches`, no `POST`. | verified by grep for `branch.create|branch.findMany|branches|sucursal` across `src/` |
| The gap is **already known and documented** | `openspec/changes/distribution-complete/apply-progress.md:212` — deviation 3: *"No branch endpoint exists (content): PO create requires `branchId` but no branch-listing API exists. `SuppliersView` derives it from server data: first PO's `branchId`, else the open cash session's `branchId`."* |

> **BLOCKING PREREQUISITE (T0).** You cannot transfer between branches that the tenant cannot create. Branch CRUD (list + create, tenant-scoped) is slice **S0** and it is not optional scope creep — it is the minimum to make a transfer demonstrable. It also unblocks the missing `Inventory` row for a new branch (§4.4).

### 4.2 The ledger is already half-wired

`InventoryMovementType` already declares `TRANSFER_OUT` / `TRANSFER_IN` (`prisma/schema.prisma:49-50`), and the comment at : 41-42 says they are *"reserved for the branch-transfer milestone (Fase 3) and are not written yet."* `listMovementsQuerySchema` already accepts both as filter values (`src/core/schemas/distribution.ts:294-303`). The **read** side of the transfer ledger exists and is unused.

### 4.3 Transfer document, state machine, authorization, and stock timing

All **product** decisions; recorded with the constraint each one runs into.

| # | Question | Options | Constraint found in code |
|---|---|---|---|
| T1 | Is there a **transfer document** at all, or is a transfer just two adjustments? | Document (auditable, 2 tables) vs bare movements (cheap, no ownership) | `InventoryMovement.refId` (`: 216`) can already point at a transfer id, but nothing populates it for a transfer today. `PurchaseOrder` is the only existing document-with-`branchId` precedent (`: 337-358`). |
| T2 | **State machine**: requested → dispatched → received → closed, or simpler? | Full (4 states, in-transit stock is invisible) vs simple (dispatch = receive) | Simple is materially cheaper and matches the `PurchaseOrder` precedent (`PENDING → ORDERED → RECEIVED`, `: 346` + entity `distribution.ts:55`). |
| T3 | **Who authorizes**? | New `ALMACENERO` role vs reuse `ACCOUNTANT` / `TENANT_ADMIN` | `AccessRole` = `CASHIER|ACCOUNTANT|MANAGER` (`schema:34-38`); `MANAGER` **maps to the `TENANT_ADMIN` session role** (`repository:76-87`). `requireApiAuth` only accepts `SessionRole[]` (`src/lib/session-token.ts:6-12`, `src/lib/session.ts:40-49`). **There is no warehouse role today** — adding one is a new `AccessRole` member plus a mapping, or reuse. |
| T4 | Stock decrement on **dispatch** or on **receipt**? | Dispatch (honest in-transit, needs an in-transit bucket) vs receipt (simple, hides loss in transit) | The `$transaction` model (`: 1997`, `: 906`, `: 2842`) makes the simple option cheap: two independent transactions, no cross-branch lock. |
| T5 | What happens to a transfer that is **never received**? | Timeout + reversal, or manual cancel | Depends on T4. With receipt-side increment, an abandoned transfer simply never happened — the ledger stays clean. |
| T6 | Does `TRANSFER_IN` **re-average `Item.cost`**? | No (a transfer is not a purchase) vs yes | `RECEIVE` re-averages today (`: 940-943`). If transfers also re-average, a branch-to-branch move silently changes the tenant's cost — compounding the §1.4 defect. **Recommend no, but it changes reported margins, so it is the user's call.** |
| T7 | Does a transfer write a **cost** or move at cost? | Move at the source lot's cost | `costSnapshot` is mandatory (`NOT NULL`, `: 213`). A transfer that re-prices corrupts both branches' margins. |
| T8 | Does a transfer need a **cash** dimension? | No | `CashMovement` is IN/OUT of a session (`: 417-428`) and has no item reference — it is already excluded from the item delete guard (`apply-progress.md:277`). Out of scope by default. |

### 4.4 Hard constraints a transfer will hit

| Constraint | Evidence | Effect |
|---|---|---|
| `Inventory` rows are **not auto-created** for a new branch | `createInventoryItem` creates exactly one row, in the first branch (`: 560-568`) | Receiving into a branch with no row fails today with 400 *"No existe inventario para este producto en la sucursal indicada"* (`: 2776-2781`). Transfer receipt must auto-create a zero row, or reject. |
| `PurchaseOrder.branchId` and `CashSession.branchId` are `ON DELETE RESTRICT` | `prisma/migrations/20260909120000_init/migration.sql:380, 401` | **A branch with any PO or cash session cannot be deleted.** Branch delete needs an explicit strategy. |
| `getInventory` duplicates rows per branch | : 483-491 | Must be fixed in the same slice that makes the second branch real, or the inventory list visibly breaks. |
| Two open cash sessions pick an **arbitrary** branch for a sale | : 1961-1967, no `orderBy`, no unique index | With branch B live, POS sales can decrement the wrong branch. |
| `getDailyCloseReport` is **tenant-wide, not branch-scoped** | : 2593-2612 — no `branchId` anywhere in the `where` | A transfer's stock effect is invisible in reports. `mermaCost` is safe (ADJUSTMENT-only filter, : 2608). |

---

## 5. Open questions, ranked by architectural impact

### 5.1 Product decisions that change the architecture (MUST be answered before design)

| Rank | Question | What it forks |
|---|---|---|
| **1** | **L3/L4 — multiple lots per item, and can one sale line split across lots?** | Decides whether `Inventory` becomes 1-to-N with items. Everything else (FEFO, transfers, returns, the inventory list) inherits the answer. This is the root question. |
| **2** | **L1 — lots mandatory or opt-in per item?** | Opt-in needs a per-item flag and a lot-exempt path through all 7 write paths. Mandatory is simpler but changes the PO receive flow. |
| **3** | **1.4 — does `Item.cost` stay the source of truth, or does a lot cost become it?** | 5 downstream consumers. If lot cost wins, `Item.cost` becomes a derived rollup and every margin read changes. |
| **4** | **T2/T4 — transfer document state machine and where stock moves** | Decides whether transfers need an in-transit state (2 tables + a stock bucket) or are two independent writes (1 table). |
| **5** | **Option A vs Option B** (lot owns stock vs `Inventory.lotId`) | Migration cost and the read-side rewrite. Depends on #1. |

### 5.2 Product decisions that are cheap to change later (ask, do not block)

F1 (no-expiry ordering), F2 (insufficient earliest lot), F3 (expired-but-in-stock), F4 (FEFO automatic vs selectable), T5 (never-received), T6 (does transfer re-average cost), L7 (lot quarantine state), L2 (which lot fields exist).

### 5.3 Technical decisions we can make without asking

| Decision | Recommendation | Basis |
|---|---|---|
| Ledger extension point | Add `lotId` to `MovementParams` and fold the two direct `tx.inventoryMovement.create` calls (: 2793, : 2875) into `recordMovement` | `: 116-134` |
| Numeric style | `Prisma.Decimal` for every guard, `comparedTo` for every ordering | Existing style at : 515, : 898, : 969, : 2038 |
| Tenant isolation | `tenantId` from the session only; every lot read scoped `{ tenantId, itemId, branchId }`; lot ids never accepted as a tenant discriminator | `AGENTS.md` Rule #1, `src/lib/session.ts:51-54` |
| `SaleItem.tenantId` | **Do not add it.** A `lotId` on `SaleItem` follows the existing "reach it through `sale`" pattern (`: 272-276`) | Rule #3 + existing precedent |
| Migration discipline | Additive-only `migration.sql`, hand-applied via `DIRECT_URL`, `prisma generate`, **never** `migrate dev` | `DATABASE.md:18-29` |
| i18n | Every new key in `messages/es.json` **and** `messages/en.json` in the same commit as the view | `apply-progress.md:213`, 6/6 batches did this |
| Test mocks | The 4 repo suites mock Prisma at the db layer with hand-built tx objects — a new model adds mock surface to each | `prisma-distribution.*.test.ts` |

### 5.4 Documentation inconsistency to flag

`PLAN.md:88` defines **"FASE 3 — Onboarding multi-tenant real"**, while `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:264-267` both reference **"Fase 3"** meaning the *distribution vertical's* branch-transfer milestone. Two different "Fase 3"s in one repo. Not a code defect, but every future artifact that says "Fase 3" is ambiguous. Recommend naming this change's phase explicitly in specs (e.g. `distribution-lots-fefo-transfers`) rather than "Fase 3".

---

## 6. Proposed decomposition

Ordered by dependency. Estimates are **rough authored-line counts** (additions + deletions) for the 400-line review budget (`_shared/sdd-phase-common.md:111`); every slice that exceeds it is flagged ⚠️.

| # | Slice | Depends on | Contents | Est. lines | Budget |
|---|---|---|---|---|---|
| **S0** | Branch CRUD (the blocker) | — | `GET/POST /api/distribution/branches`, Zod contract, port methods, `BranchesView` or a branch picker, tab wiring, i18n ×2 | ~380-450 | ⚠️ borderline |
| **S1** | Multi-branch read correctness | S0 | Fix `getInventory` duplicate rows (group per item, add `branchId` to `InventoryStockItem`); deterministic open-session branch selection; auto-create the `Inventory` row for a new branch | ~120-180 | OK |
| **S2** | Lot schema + migration | Q1, Q5 answered | Prisma models (Option A or B), `InventoryMovement.lotId`, additive `migration.sql`, backfill, `prisma generate` | ~150-200 | OK |
| **S3** | Lot read/CRUD | S2 | `LotEntity`/`LotStockItem`, port methods, Zod, `GET /inventory/lots`, lot columns in `InventoryView`, i18n ×2 | ~420-500 | ⚠️ over |
| **S4** | Lot-aware receive + adjustment + count | S2, S1 | Extend `ReceivePurchaseOrderInput` / `CreateInventoryAdjustmentInput` / `CountBatchItemInput` with a lot; write `RECEIVE`/`ADJUSTMENT` rows per lot; per-lot `costSnapshot` | ~450-550 | ⚠️ over |
| **S5** | FEFO allocation engine | S2, S4 | Ordered lot read, per-lot guarded decrement, 409 cascade, split-line representation (L4), F1-F5 rules | ~350-450 | ⚠️ borderline |
| **S6** | Sale returns with lot awareness | S5 | Restore to the original lot; `SaleItem.lotId`; per-lot `RETURN` rows | ~200-280 | OK |
| **S7** | Transfer document + dispatch/receive | S0, S1, S2 | `StockTransfer` + `StockTransferItem`, state machine (T2), `TRANSFER_OUT`/`TRANSFER_IN` writes, auto-create destination `Inventory`/lot rows, T4/T6/T7 | ~500-650 | ⚠️ over |
| **S8** | Transfer UI + ledger surfacing | S7 | Transfer view, lot/expiry columns in `InventoryMovementsView`, transfer filters, i18n ×2 | ~450-550 | ⚠️ over |

**Honest budget read:** 4 of 9 slices (S3, S4, S7, S8) and 1 borderline (S0) exceed the 400-line budget. `delivery_strategy` should be resolved to `auto-chain` or `ask-on-risk` → chained. S3+S4 and S7+S8 are the natural PR boundaries; each is autonomous with its own verification and revert.

**Do not start S2 until Q1, Q3 and Q5 are answered.** The schema is the one artifact in this change that is expensive to reverse: after the backfill, changing the lot model means a second data migration on live stock.

---

## Affected areas

- `prisma/schema.prisma` — new lot model, `InventoryMovement.lotId`, transfer models
- `prisma/migrations/<ts>_*/migration.sql` — additive DDL, hand-applied
- `prisma/seed.ts` — branch/lot/transfer demo data
- `src/core/entities/distribution.ts` — `InventoryStockItem`, `InventoryMovementEntity`, `SaleLineEntity`, lot + transfer entities
- `src/core/ports/distribution-repository.port.ts` — `IDistributionRepository` methods + inputs
- `src/core/schemas/distribution.ts` — Zod contracts (ledger filter already accepts `TRANSFER_*`)
- `src/infrastructure/db/repositories/prisma-distribution.repository.ts` — 7 write paths, `recordMovement`, `getInventory`, `getDailyCloseReport`
- `src/app/api/distribution/**` — new `branches/`, `inventory/lots/`, `transfers/` routes
- `src/modules/distribution/components/{InventoryView,SalesPOSView,InventoryCountView,InventoryMovementsView,DistributionModuleApp}.tsx` — lot columns, expiry badges, new tab
- `src/modules/distribution/lib/roles.ts` — `ALL_TABS` + `RESTRICTED_TABS` if a transfer role is added
- `messages/es.json`, `messages/en.json` — every new key in both locales
- 4 repo test suites + 4 route test suites — new Prisma model mock surface

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Building the lot schema before Q1/Q3/Q5 are answered, forcing a second data migration on live stock | Med | High | Gate S2 on the open questions; treat the migration as one-way |
| R2 | Second branch makes the tenant-wide `Item.cost` / branch-scoped weighted average (§1.4) visibly wrong | **High** (already true) | High | Fix or explicitly scope in S1 before the second branch is live |
| R3 | `getInventory` duplicate rows break the inventory list and the velocity ranking the moment a second branch exists | **High** (already true) | Med | S1 is a hard dependency of S0's rollout, not a follow-up |
| R4 | Arbitrary open-session branch selection sends POS stock decrements to the wrong branch | Med | High | Deterministic selection + one-open-session-per-branch constraint in S1 |
| R5 | FEFO's N sequential guarded decrements replace one atomic `updateMany`, weakening concurrency safety | Med | High | Keep the `$transaction` all-or-nothing; add a concurrency test on the sale path |
| R6 | Lot-aware returns are skipped, so returned goods silently land in the wrong lot and rewrite expiry | Med | Med | S6 is a separate slice, not folded into S5 |
| R7 | `TRANSFER_IN` re-averages `Item.cost`, letting a branch move change tenant-wide cost | Med | Med | T6 is an explicit product question; recommend no re-averaging |
| R8 | `prisma migrate dev` is run unsupervised and wipes the DB (no `_PrismaMigrations` table) | Low | **Critical** | `DATABASE.md:23` already forbids it; additive-only hand-applied DDL, backup first |
| R9 | `prisma generate` hits `EPERM` on `query_engine-windows.dll.node` when `next dev` is running | **High** (occurred in batch 4) | Low | Stop the dev tree before generating — recorded in `apply-progress.md:153` |
| R10 | 4 of 9 slices exceed the 400-line review budget | **High** | Med | Resolve `delivery_strategy` to chained before S3 |

## Ready for proposal

**No — not yet.** Four product decisions (§5.1) change the architecture and only the user can answer them. The orchestrator should surface exactly these, in this order, and ask for the answers before `sdd-propose`:

1. Can one item have **multiple lots** at once, and can **one sale line consume several lots**? (Q1 — the root fork)
2. Are lots **mandatory or opt-in** per item? (Q2)
3. Does **`Item.cost` stay authoritative**, or does a lot's own cost become the source of truth? (Q3 — it decides whether the existing weighted-average bug is in scope)
4. **Lot model**: does a `Lot` table own the stock, or does `Inventory` gain a `lotId`? (Q5)

Everything else — the ledger `lotId` extension, Decimal discipline, tenant isolation, migration safety, i18n parity — is a technical decision already settled by the repo's own conventions and needs no input.
