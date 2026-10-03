# Design: distribution-lots-fefo-transfers — Lots, FEFO, Branch-Scoped Cost, Inter-Branch Transfers

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is **not** the onboarding "FASE 3" (`PLAN.md:88`) and **not** the distribution "Fase 3" (`prisma/schema.prisma:41-42`, `src/core/entities/distribution.ts:266-267`). Both refer to other work.
> **Vocabulary correction.** The brief calls the weighed case `Item.saleUnit = PESO`. That enum member does not exist. The real enum is `ItemSaleUnit { UNIDAD | LIBRA | KILOGRAMO }` (`prisma/schema.prisma:68-72`, `itemSaleUnitSchema` at `src/core/schemas/distribution.ts:153`). This design uses `LIBRA`/`KILOGRAMO`; adding `PESO` is open question **Q-D2**.

> **Amendment A1 (targeted, `sdd-design`).** The sale→session mechanism left open by the first pass (**Q-D1**) is now settled by the user and pinned as **D11**: *a sale derives its cash session server-side from the authenticated user's branch, with **no new client field**.* The two specs were amended to match (`distribution-branches/spec.md:46-48`, `distribution-cash-register/spec.md:16`), so **Q-D1 is closed**. Everything A1 touches is marked **[A1]** below. Nothing else in this design changed: the lot/FEFO/transfer model, D1–D10, M1–M6, and the slice order are as originally planned, except that **S1b is split into S1b + S1c** (20 → **21** slices, still 6 migrations). The one thing A1 *reverses* is this document's own earlier recommendation on Q-D1, which argued for naming the session on the sale — see **D11** for why the user chose the other branch.

## Answer first

1. **The cash session guard is settled: one OPEN session per `(tenantId, branchId)`**, enforced by the M5 partial unique index. The tenant-wide reading is gone from both specs (amended 17:24 / 17:27), so branch B is sellable while branch A's register is open. **[A1]**
2. **[A1] A sale takes its branch from its own cashier, not from the client.** `session.userId` → `User.personId` → `Employee.branchId` → the single OPEN session of that branch. The POS client sends `{lines, discount, personId, notes, paymentMethod, paidAmount}` today (`SalesPOSView.tsx:88-95`), `registerSaleSchema` gains nothing (`schemas/distribution.ts:216-225`), and `POST /api/distribution/sales` already forwards `session.userId` (`sales/route.ts:51`) — so **the sale path needs zero client and zero route change**. See **D11**.
3. **Three `Map` merges, not two.** The sale merge (`:1946-1959`), the receive merge (`:873-886`), and a third the proposal missed: **`createPurchaseOrder` merges too (`:1035-1039`)**. All three must go; a fourth consumer the proposal missed, `createSaleReturn` (`:2274-2284`), is a different problem (allocation-directed return) and is handled in S6.
4. **`Item.cost` has seven read sites, not five.** `:496` (`getInventory` display), `:633` (client PATCH), `:1065` + `:1108` (`createPurchaseOrder` prices a **branch-B** PO from the tenant-wide scalar, and that value becomes the RECEIVE `costSnapshot` at `:910`/`:954`), `:1749`+`:1755` (`getFiscalSummary` computes gross profit from the **live** cost against **historical** prices), `:2094`, `:2655`, `:2432`, `:2801`, `:2883`.

## Technical Approach

Extend the established vertical pattern — entity (`src/core/entities/distribution.ts`) → port (`src/core/ports/distribution-repository.port.ts`) → Prisma adapter (`src/infrastructure/db/repositories/prisma-distribution.repository.ts`, 2988 lines and the de-facto home of all distribution business logic) → route (`requireApiAuth` + `requireTenantId` + Zod + `handleApiError`) → React Query view → i18n in **both** `messages/es.json` and `messages/en.json`. Money and stock math stay server-side on `Prisma.Decimal` (`:898`, `:938`, `:969`, `:2038`, `:2328`); `tenantId` comes from the session only.

**One quantity owner.** `Lot.quantity` is the only sellable-quantity column in the system. Every item × branch gets **at least one** `Lot`: lot-controlled items get real lots, every other item gets exactly one implicit lot (`code = null`, `expiryDate = null`) that reproduces today's `Inventory` row exactly. There is no second quantity path, so there is nothing to drift.

**Where the FEFO algorithm lives.** In the adapter, not in `src/core`. `Prisma.Decimal` is already the vertical's numeric model and core is Decimal-free by design; introducing a second numeric representation (integer cents) into core to host the draw loop would create exactly the divergence this change exists to remove. Core receives **types and port contracts only** — which is how Rule #3 is satisfied trivially: `src/core` gains zero imports from `src/infrastructure` or `src/modules`. No `any` (Rule #2): every new value is a plain typed interface or a `z.infer`.

## Data Model

```prisma
enum LotStatus { ACTIVE QUARANTINE }   // QUARANTINE is the only non-sellable value

model Lot {
  id             String     @id @default(uuid())
  tenantId       String
  tenant         Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  itemId         String
  item           Item       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  branchId       String
  branch         Branch     @relation(fields: [branchId], references: [id], onDelete: Cascade)
  code           String?    // operator code; null = the implicit lot
  manufactureDate DateTime?
  expiryDate     DateTime?  @db.Date   // day granularity, America/Managua
  status         LotStatus  @default(ACTIVE)
  cost           Decimal    @db.Decimal(10, 2)   // the lot's own unit cost
  quantity       Decimal    @db.Decimal(10, 2) @default(0)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  movements     InventoryMovement[]
  saleItemLots  SaleItemLot[]
  transferItems StockTransferItem[]

  @@unique([tenantId, itemId, branchId, code])
  @@index([tenantId, itemId, branchId, expiryDate])
  @@index([tenantId, branchId])
}

model SaleItemLot {
  id           String   @id @default(uuid())
  saleItemId   String
  saleItem     SaleItem @relation(fields: [saleItemId], references: [id], onDelete: Cascade)
  lotId        String
  lot          Lot      @relation(fields: [lotId], references: [id], onDelete: Restrict)
  quantity     Decimal  @db.Decimal(10, 2)
  costSnapshot Decimal  @db.Decimal(10, 2)   // the lot's cost at draw time
  createdAt    DateTime @default(now())

  // No tenantId — mirrors SaleItem (schema:272-276); reached via saleItem → sale.
  @@index([saleItemId])
  @@index([lotId])
}

model ItemBranchCost {
  id       String @id @default(uuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  itemId   String
  item     Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  branchId String
  branch   Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  cost     Decimal @db.Decimal(10, 2)

  @@unique([tenantId, itemId, branchId])
  @@index([tenantId, branchId])
}

enum StockTransferStatus { PENDING DISPATCHED RECEIVED CANCELLED }

model StockTransfer {
  id             String             @id @default(uuid())
  tenantId       String
  tenant         Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sourceBranchId String
  sourceBranch   Branch             @relation("TransferSource", fields: [sourceBranchId], references: [id])
  destBranchId   String
  destBranch     Branch             @relation("TransferDest", fields: [destBranchId], references: [id])
  status         StockTransferStatus @default(PENDING)
  notes          String?
  dispatchedAt   DateTime?
  receivedAt     DateTime?
  cancelledAt    DateTime?
  createdById    String
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  items StockTransferItem[]
  @@index([tenantId, status])
  @@index([tenantId, sourceBranchId])
  @@index([tenantId, destBranchId])
}

model StockTransferItem {
  id           String        @id @default(uuid())
  transferId   String
  transfer     StockTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  itemId       String
  item         Item          @relation(fields: [itemId], references: [id])
  lotId        String
  lot          Lot           @relation(fields: [lotId], references: [id], onDelete: Restrict)
  quantity     Decimal       @db.Decimal(10, 2)
  costSnapshot Decimal       @db.Decimal(10, 2)   // frozen at dispatch, reused at receipt
  @@index([transferId])
  @@index([itemId])
}
```

Additions to existing models:

| Model | Add |
|---|---|
| `Item` | `lotControl Boolean @default(false)` (opt-in; `false` = today's flow) |
| `InventoryMovement` | `lotId String?` + `lot Lot? @relation(..., onDelete: Restrict)`, `lotCode String?` (snapshot), `@@index([lotId])` |
| `SaleItem` | `allocations SaleItemLot[]` — **no `tenantId`**, no `branchId` (reached through `sale.cashSession`) |
| `Inventory` | **drop `stock`**. Keeps `minAlert Int` and `@@unique([tenantId, itemId, branchId])` — the alert policy and the per item × branch identity the implicit lot needs |

Two schema details that are easy to get silently wrong:

- **`onDelete: Restrict` must be written explicitly** on `InventoryMovement.lot` and `SaleItemLot.lot`. Prisma's default for an *optional* relation is `SetNull`; the spec requires that a lot referenced by the ledger cannot be deleted, and `SetNull` would silently rewrite history instead of refusing.
- **`@@unique([tenantId, itemId, branchId, code])` does not enforce the implicit-lot rule.** Postgres treats NULLs as distinct, so two `code = null` lots would both be allowed. The spec requires the code-less lot to be unique per item × branch, which needs a partial unique index in the migration:
  `CREATE UNIQUE INDEX "Lot_one_implicit_per_item_branch" ON "Lot"("tenantId","itemId","branchId") WHERE "code" IS NULL;`
  This is the same hand-applied-index pattern the repo already ships (`prisma/migrations/20260925120000_velocity_sort_index/migration.sql`).

**The `PESO`-free weighted case.** `Lot.quantity` is denominated in the item's own `saleUnit` — kilograms for a `KILOGRAMO` item, pounds for `LIBRA`, pieces for `UNIDAD`/null. There is no conversion factor, exactly as stock works today (`schema:169-171`), so FEFO and the draw loop are unit-agnostic.

**One received line is exactly one lot.** This design decides the `distribution-purchase-orders` open question: a receipt line **is** a lot's identity carrier (code, manufacture date, expiry, unit cost, quantity). Two lines of the same product are two different lots and are never merged. The same rule applies to transfer lines, which is why `StockTransferItem.lotId` is required rather than nullable.

## Architecture Decisions

| # | Decision | Options | Choice | Why |
|---|---|---|---|---|
| D1 | Lot owns stock | `Lot` table vs `Inventory.lotId?` vs JSONB | `Lot` table (settled) | Settled input 4. JSONB was excluded on rule grounds in the explore (§2.1 option C). |
| D2 | `Inventory.stock` | drop / maintain as cache / `groupBy` | **Drop the column**; `getInventory` aggregates with `groupBy` over `Lot.quantity` | The spec forbids a second independently writable quantity. A *maintained* cache is a second writer; a frozen one diverges by construction the moment any write path lands. `getInventory` already issues a second aggregate (`getUnitsSoldLast30d`, `:462-477`), so aggregating is the file's established pattern, not a new cost model. Tradeoff: one non-additive DDL step inside an additive change, with a rehearsed reversal. A two-phase add→drop is possible but leaves a guaranteed divergence window — see **Q-D3**. |
| D3 | Cash-session guard scope | tenant-wide / per branch | **Per `(tenantId, branchId)`** + `CREATE UNIQUE INDEX "CashSession_one_open_per_branch" ON "CashSession"("tenantId","branchId") WHERE "status" = 'OPEN'` | The only model under which branch B can sell. Prisma cannot express a partial index, so it ships in the hand-applied SQL — same pattern as D2's implicit-lot index. The index is safe to create **before** the code change (it enforces strictly less than today's app guard) and is the DB backstop for the 409. `getOpenCashSession` (`:1408-1416`) and `registerSale` (`:1961-1963`) become branch-scoped so the register UI and the sale write can no longer resolve *different* sessions. Sale→session binding is **D11** (settled; it used to be Q-D1). **[A1]** |
| D4 | Branch-scoped cost derivation | store average / derive live | **Store `ItemBranchCost`**, re-average on receive only | Same shape as the existing `Item.cost` re-average (`:933-938`) with the branch in the key. A live derivation would need a `SUM(quantity × cost) / SUM(quantity)` aggregate on every cost read. The spec's "cutover seeds existing cost" scenario requires a stored value anyway. |
| D5 | `Item.cost` after S2 | drop / keep as catalog default | **Keep it as the catalog default that seeds a *new* branch's cost row; never a branch-derived average** | Matches the spec: it must not *receive* a branch-derived average, and the cutover scenario requires the reported cost not to shift. Patching it (`:633`) updates the default, not any branch's cost. |
| D6 | Two `Map` merges vs three | remove two / remove three | **Three**: `:1946-1959` (sale), `:873-886` (receive), `:1035-1039` (PO create) | A merged line has no stable identity to hang a lot allocation on. All three collapse the lot dimension. |
| D7 | FEFO lost-race handling | 409 immediately / re-read once | **Re-read the remaining candidate tail once, then 409** | A 409 on a sale lot B could have covered is a false "stock insuficiente" the operator works around manually. One re-read costs one query on the race path only; capping it at once per line makes a pathological loop impossible. The simpler alternative (fail on `count === 0`, matching `:2042`) is safe but less available under contention. |
| D8 | Transfer costing | re-average / move at cost | **Move at source lot cost; no re-average** (settled) | A branch-to-branch move is not a purchase; re-averaging compounds the very defect D4 removes. `costSnapshot` is `NOT NULL` (`:213`), so a cost is always written. |
| D9 | Transfer stock timing | dispatch / receipt | **Decrement on dispatch, increment on receipt** (settled) | Receipt-side decrement lets the source sell goods that physically left. In-transit stock is **derived** (`SUM(StockTransferItem.quantity)` over `DISPATCHED`), never stored. |
| D10 | Ledger writer | extend `recordMovement` / add a second | **Extend it; fold `:2793` and `:2875` in** | `MovementParams` (`:98-109`) is the complete movement field list; one added field plus two call-site folds is the cheapest structural win in the change. |
| **D11** | **[A1]** How a sale picks its cash session | (A) client names it: `cashSessionId` in the sale body — (B) server derives it from the authenticated user's branch | **(B). No new client field. `registerSaleSchema` is unchanged.** | See below. (A) was this design's own earlier recommendation and the user rejected it: it re-introduces a client-chosen field on the one path that moves stock, and any such field is a spoofable surface. (B) has no field to spoof, and the spec property ("resolve exactly one, never an unordered lookup") is then satisfied by a database invariant rather than by a sort convention. |

### Concurrency: what actually changes

Today one atomic statement per line (`tx.inventory.updateMany` with a `stock: { gte }` guard, `:2032-2049`) either succeeds or returns `count === 0`. FEFO replaces it with N sequential guarded decrements. Under Postgres READ COMMITTED the **outcome** stays correct because the existing `prisma.$transaction` (`:1997`) is all-or-nothing. The **failure mode** moves from "one statement returns 0" to "statement *k* returns 0 mid-loop".

Two verified properties make the containment real, not assumed:

- The `SaleCounter` upsert (`:2054-2059`) is **inside** the sale transaction, so the spec's *"no consumed invoice number"* holds — a rollback rolls the counter back too.
- Nothing is written before the draw loop except in-memory money math; `Sale`, `SaleItem`, `SaleItemLot`, `Receivable`, and every ledger row are created after the loop, so a mid-loop 409 leaves no partial document.
- **[A1]** A third write precedes the loop: the D11 session claim. It buys nothing for FEFO's own atomicity (it is not a lot row and does not contend with other sales) — it exists so the sale cannot be attributed to a register that closed mid-flight. See D11.

### D11 — the sale's cash session is derived, never named **[A1]**

**The chain.** Three joins from the session to the branch, then one lookup:

    session.userId ──User.id (PK)──► User.personId ──Employee.personId──► Employee.branchId
              (@unique)                    (@unique)                          │
                                                                                ▼
                                        CashSession WHERE tenantId AND branchId AND status='OPEN'

```ts
// Step 1 — derive. `is` is REQUIRED on the optional to-one `Person.user`
// (schema:129) and accepted on the required `Employee.person`. Both joins ride
// an existing index (User.id is the PK; User.personId and Employee.personId
// are @unique), so this adds NO index and NO migration.
const employee = await tx.employee.findFirst({
  where: { tenantId, person: { is: { user: { is: { id: userId } } } } },
  select: { branchId: true, branch: { select: { name: true } } },
});
// employee === null      → no Employee record
// employee.branchId null → Employee exists with branchId IS NULL (schema:378)
```

Both "no derivable branch" shapes — no `Employee` row and `branchId IS NULL` — **deliberately collapse to one fallback.** The spec's requirement is scoped to *"when no branch can be derived from an `Employee` record"* (`distribution-branches/spec.md:48`), which covers both, and the operational argument is decisive: an employee with a null branch inside a single-branch store is in exactly the same position as an employee who does not exist, so splitting them would lock a real cashier out of selling in a store that has nowhere else to sell.

```ts
// Step 2 — fallback or refuse. Runs ONLY when step 1 yielded nothing, so the
// happy path stays at one query. This REPLACES firstBranchOfTenant (:247-252)
// for the session path: that helper silently takes the earliest branch, which
// `distribution-branches/spec.md:48` explicitly forbids. It stays in use at
// :528, because :94/:108-112 keep the earliest-branch fallback for unnamed
// stock writes.
const branches = await tx.branch.findMany({
  where: { tenantId },
  select: { id: true, name: true },
  orderBy: { createdAt: 'asc' },
});
// length === 1 → that branch (single-branch tenants keep working unchanged)
// length >= 2 → REFUSE. length === 0 → 400, today's message (:1470).
```

```ts
// Step 3 — the lookup that REPLACES the unordered findFirst (:1961-1963).
// No `orderBy` is added on purpose: M5's partial unique index makes
// (tenantId, branchId) WHERE status='OPEN' hold at most one row, so the
// result is unique by construction and a sort would only disguise the
// guarantee. That same index is this query's access path, so branch-scoped
// resolution costs no extra index. `findUnique` is unavailable because Prisma
// cannot express a partial unique index, so there is no compound key to use.
const session = await tx.cashSession.findFirst({
  where: { tenantId, branchId, status: 'OPEN' },
  select: { id: true, branchId: true },
});
```

**Where this sits relative to the transaction boundary, and why.** Steps 1–3 are the **first statements inside the existing `prisma.$transaction`** at `:1997` — moved in from their current position outside it (`:1961-1967`). The branch a sale moves stock in and the session that sale is attributed to are the *same fact*; resolving it outside the transaction means the stock writes are authorized by a fact that can be invalidated before they commit.

Moving it inside is necessary but **not sufficient**, and the design will not pretend otherwise. `closeCashSession` (`:1528-1581`) is **not** transactional: it reads, aggregates, then `update`s. Under READ COMMITTED every statement gets its own snapshot, so a read inside the transaction can still observe an open session that a concurrent close is about to close. The sale therefore **claims** the session as the first write of the transaction:

```ts
// Step 4 — claim. The lock, not the value, is the point: this is the first
// write of the tx and it holds a row lock on the session until commit, so any
// concurrent close/movement on that row blocks. `count === 0` means the
// session closed between step 3 and step 4 → no stock moves at all.
// CashSession has no `updatedAt` (schema:392-415), so the idempotent
// `notes` self-write is the cheapest existing-column no-op. The repo uses no
// raw SQL at all (zero `$queryRaw`/`$executeRaw` under src/), which is why
// this is a guarded `updateMany` and not `SELECT … FOR UPDATE`.
const claim = await tx.cashSession.updateMany({
  where: { id: session.id, tenantId, branchId, status: 'OPEN' },
  data: { notes: session.notes },
});
if (claim.count === 0) throw new ApiError(400, /* see table */);
```

**Failure behavior.** The status-code invariant this design adopts: **409 = the row you are writing collides with existing state** (a second OPEN session on a branch; insufficient stock in the FEFO loop). **400 = this request cannot be served in the current configuration and an operator must change the configuration.** Every case below is 400, and that is a decision, not an accident: `ApiError` carries `(status, message)` with no machine-readable code and `errorResponse` returns `{ error: message }` only (`src/lib/api-error.ts:13-18,41-43`), so a 400/409 split the UI cannot read buys nothing — the message is the only signal the client has. Adding a machine code to `ApiError` is a named follow-up (**R13**), not a silent part of this change.

| Condition | Detected at | Code | Message | Surfaces at |
|---|---|---|---|---|
| No derivable branch, tenant has **exactly one** branch | step 2, `length === 1` | — | — | sale continues at that branch; **backward compatible** |
| No derivable branch, tenant has **two or more** branches | step 2, `length >= 2` | 400 | `No se puede determinar la sucursal de la venta: asigna una sucursal al cajero o deja una sola sucursal` | `POST /api/distribution/sales`; same rule on `POST /api/distribution/cash` per `distribution-branches/spec.md:48` |
| Tenant has **zero** branches | step 2, `length === 0` | 400 | `El tenant no tiene sucursales configuradas` (`:1470`, unchanged) | both routes |
| No OPEN session at the derived branch | step 3, `null` | 400 | `Debe abrir la caja en la sucursal «<name>» antes de registrar una venta` | `POST /api/distribution/sales` |
| Session closed between step 3 and step 4 | step 4, `count === 0` | 400 | `La caja de «<name>» se cerró mientras se registraba la venta` | `POST /api/distribution/sales` |

**One deliberate non-detection.** When the derived branch has no open session *but another branch of the tenant does*, the response is the same 400 with the branch name, not a second code naming the other branch. A second query on the failure path could name it, but per the invariant above the UI still could not branch on it. The operator's diagnosis comes from the derived `GET /api/distribution/cash`, which shows them their own branch's register.

**What D11 does NOT fix, stated plainly.** The claim makes the **sale** side safe: a sale can never begin against a session that is closed or mid-close at claim time, and it serializes the sale against session writes. The **close** side stays read-then-write outside any transaction, so a sale whose claim lands *after* the close's aggregate (`:1547-1556`) but whose `Sale` insert commits *before* the close's `update` is still omitted from `expectedAmount`. That is a pre-existing defect, no delta spec requires it, and fixing it means moving the close into its own `$transaction` that claims the session the same way — **R11, out of scope here**, named rather than silently absorbed.

**What does not change, and that is the point.** `registerSaleSchema` (`schemas/distribution.ts:216-225`) is untouched: no `sessionId`, no `branchId`. `RegisterSaleInput.userId` **already exists** (`ports/distribution-repository.port.ts:237-238`) and `POST /api/distribution/sales` **already forwards it** (`sales/route.ts:51`), and `SalesPOSView` **already sends no session or branch field** (`SalesPOSView.tsx:88-95`). A client can therefore influence the branch **nowhere** on the sale path, and the only code that changes is inside the repository. **[A1]**

## Data Flow

```
POST /sales {lines:[{itemId,quantity}], …}   ← body has NO session/branch field [A1]
  └─ requireApiAuth → requireTenantId()  ← tenantId NEVER from the body
     └─ repo.registerSale(tenantId, input) : prisma.$transaction
        0. D11 — all three INSIDE the tx, before any write:
           a. tx.employee.findFirst(user→person→branchId)  → branch + name
           b. if null → tx.branch.findMany(tenantId); 1 ⇒ that branch, ≥2 ⇒ 400
           c. tx.cashSession.findFirst({tenantId, branchId, status:'OPEN'})  → null ⇒ 400
           d. tx.cashSession.updateMany({…status:'OPEN'})  → claim, count 0 ⇒ 400
        1. read Items for tenantId                      (400 if any missing)
        2. FOR EACH line (no merge — two lines stay two lines):
           a. candidates = tx.lot.findMany({ where: { tenantId, itemId, branchId,
                 status:'ACTIVE', quantity:{gt:0},
                 OR:[{expiryDate:null},{expiryDate:{gt: businessDayStart}}] },
                 orderBy:[{expiryDate:{sort:'asc',nulls:'last'}},{createdAt:'asc'},{id:'asc'}] })
           b. FOR EACH candidate:
                take = Prisma.Decimal.min(remaining, lot.quantity)
                tx.lot.updateMany({ where:{ id, tenantId, quantity:{gte: take} },
                                    data:{ quantity:{ decrement: take } } })
                count===0 → re-read the tail once (D7) → else 409
                allocations.push({ lotId, take, costSnapshot: lot.cost })
                remaining -= take
           c. remaining > 0 → throw 409  ⇒ whole tx rolls back, nothing escapes
        3. lineCost = Σ(qty×costSnapshot)/lineQty, .toDecimalPlaces(2)
        4. Sale + SaleItem(cost=lineCost) + SaleItemLot[]
        5. recordMovement per ALLOCATION  (one SALE row per lot, negative)
```

## Allocation algorithm — the details that matter

**Business day.** `expiryDate` is `@db.Date`; "expired" means `expiryDate <= businessDayStart('America/Managua')`, the same UTC-6 window the daily close already fixes at `:2589-2590`. A lot expiring today **is** expired. The candidate filter is therefore `expiryDate > businessDayStart` — one comparison, no timezone drift between the filter and the message. `expiryDate: null` is **always** a candidate and is never treated as expired. A `QUARANTINE` lot is not a candidate regardless of expiry.

**Decimal-exact comparison.** Every guard is a `Prisma.Decimal` method (`.lt`, `.lte`, `.gt`, `.gte`, `.comparedTo`), never a JS comparison. `Prisma.Decimal.min/max` are used exactly as `:2020` already does. Nothing in the loop touches a float.

**Order is total.** `expiryDate ASC NULLS LAST → createdAt ASC → id ASC`. The `id` tiebreak is not decoration: without a total order the same sale allocates differently run to run, which an auditable ledger cannot tolerate. Ties and exact-boundary draws (`0.30` in stock, `0.30` sold → `0.00`) are covered by the two-decimal Zod refine `quantity2dpPositive` (`src/core/schemas/distribution.ts:20-24`) that already rejects `1.005` with 400 — reused, not re-invented.

**The two 409 messages are different.** When coverage is short, one extra count on the error path distinguishes *every candidate expired* (message points the operator at a `VENCIMIENTO` write-off, which the ledger already supports) from *insufficient unexpired stock*. Expired stock is never a fallback. The extra query runs only on the failure path, so the happy path stays at one candidate query per line.

**Weight-denominated lines** need no special branch: `take = min(remaining, lot.quantity)` operates in the item's own unit, `10.00 − 2.50 = 7.50 kg` exactly. The `SaleItem` insert, the `SaleItemLot` insert, the guarded decrement, and the ledger row all receive the same `Decimal(10,2)` value.

## Interfaces / Contracts

**Entities** (`src/core/entities/distribution.ts`, no new imports): `BranchEntity`, `LotEntity`, `LotStatus`, `SaleItemLotEntity`, `ItemBranchCostEntity`, `StockTransferEntity`, `StockTransferItemEntity`, `StockTransferStatus`. Modified: `InventoryStockItem` (+`branchId`, +`lotControl`; `cost` is now branch-scoped), `InventoryMovementEntity` (+`lotId?`, `lotCode?`, `lotExpiryDate?`), `SaleLineEntity` (+`allocations`, `cost` = weighted allocation cost).

**Port** (`src/core/ports/distribution-repository.port.ts`): added `listBranches`, `createBranch`, `updateBranch`; `listLots`, `createLot`, `updateLotStatus`; `getTransfers`, `getTransfer`, `createTransfer`, `dispatchTransfer`, `receiveTransfer`, `cancelTransfer`; `getItemBranchCost`. **[A1]** `getOpenCashSession(tenantId, branchId?)` becomes `getOpenCashSession(tenantId, userId)` — the branch is derived, never passed; `getDashboard(tenantId)` becomes `getDashboard(tenantId, userId)` for the `:336` call; `OpenCashSessionInput` loses `branchId` and gains `userId`. **[A1]** `RegisterSaleInput` is **completely unchanged** — it already carries `userId` (`:237-238`), which D11 consumes instead of adding anything, and `saleLineSchema` (`:211-214`) stays as pinned by the FEFO spec. `getInventory` rows carry `branchId`; `ReceivePurchaseOrderLineInput` gains `lot?: { code?, manufactureDate?, expiryDate?, cost }`; `CreateInventoryAdjustmentInput` and `CountBatchItemInput` gain `lotId?`.

**Rule #3.** Core gains interfaces and plain types only. `Prisma.Decimal`, `$transaction`, and `tx.lot` never appear in `src/core`; the adapter converts with `.toNumber()` at the boundary, matching every existing entity. **Rule #2.** No `any`: JSONB is untouched, all Zod outputs are `z.infer`, all new state is a named interface.

## API surface

Every route: `requireApiAuth(roles)` → `requireTenantId()` → Zod `safeParse` → `handleApiError`. `tenantId` is never a query param or body field — a client-supplied one is **stripped by Zod** (none of the body schemas are `.strict()`, so unknown keys are dropped) and the repository derives the tenant from its argument.

| Route | Method | Validation | Role |
|---|---|---|---|
| `/api/distribution/branches` | GET | `noQueryParamsSchema` | `ACCOUNTANT, STAFF, TENANT_ADMIN` |
| `/api/distribution/branches` | POST | `createBranchSchema` | `TENANT_ADMIN` |
| `/api/distribution/branches/[id]` | PATCH | `updateBranchSchema` (partial + `hasAnyDefinedField`) | `TENANT_ADMIN` |
| `/api/distribution/inventory/lots` | GET | `lotListQuerySchema` `.strict()` | `ACCOUNTANT, STAFF, TENANT_ADMIN` |
| `/api/distribution/inventory/lots` | POST | `createLotSchema` | `STAFF, TENANT_ADMIN` |
| `/api/distribution/inventory/lots/[id]` | PATCH | `updateLotSchema` | `STAFF, TENANT_ADMIN` |
| `/api/distribution/transfers` | GET / POST | `noQueryParamsSchema` / `createTransferSchema` | GET: all; POST: `STAFF, TENANT_ADMIN` |
| `/api/distribution/transfers/[id]` | GET | `idParamSchema` | all |
| `/api/distribution/transfers/[id]/dispatch` | POST | `idParamSchema` | `STAFF, TENANT_ADMIN` (Q2) |
| `/api/distribution/transfers/[id]/receive` | POST | `idParamSchema` | `CASHIER, STAFF, TENANT_ADMIN` (Q2) |
| `/api/distribution/transfers/[id]/cancel` | POST | `idParamSchema` | `STAFF, TENANT_ADMIN` (Q2) |

Modified: **[A1]** `POST /api/distribution/cash` — forwards `session.userId` (`cash/route.ts:38-42`) and **drops `branchId` from `openCashSessionSchema`** (`schemas/distribution.ts:363`); the field no longer selects anything, and leaving it would be a lie. `CashRegisterView` already sends only `{ openingAmount }` (`CashRegisterView.tsx:70-72`), so **no client change**; an older client still sending `branchId` is unaffected because the schema is a non-strict object and drops unknown keys. **[A1]** `GET /api/distribution/cash` — **derived, and this reverses the earlier `cashSessionQuerySchema { branchId? }` plan**: it stays on `noQueryParamsSchema` and the repository derives the branch from the session user. That reversal is not cosmetic — `InventoryView.tsx:82-87` and `SuppliersView.tsx:83-92` already take their working `branchId` from `cashSession?.branchId`, so a client-settable `branchId` on this read would have let a client choose the branch the rest of the UI operates on. **[A1]** `GET /api/distribution` dashboard — `requireApiAuth` currently discards its payload (`dashboard/route.ts:11`) and `getDashboard(tenantId)` (`ports:301`) calls `getOpenCashSession(tenantId)` at `:336`; both now thread `userId` so the `cashInRegister` tile reports the reader's own register. **[A1]** `POST /api/distribution/sales` — **unchanged**: no new body field, no new route code. `POST /api/distribution/purchase-orders/[id]/receive` and `POST /api/distribution/purchase-orders` (`lot` on each line); `POST /api/distribution/inventory/adjustments` and `/count` (`lotId?`). `listMovementsQuerySchema` already accepts `TRANSFER_OUT`/`TRANSFER_IN` (`schemas/distribution.ts:290-307`) — no change.

**Rule #1 discipline for every new id.** `branchId`, `lotId`, and `transferId` are **branch/document references, not tenant discriminators** — exactly the existing `branchId` pattern, tenant-guarded in the repository (`tx.branch.findFirst({ where: { tenantId, id } })` at `:2767`, `:2844`). A cross-tenant id resolves as **404** and writes nothing. A lot id alone is never accepted as proof of tenant ownership.

## Migration / Rollout

> **The live database has no `_PrismaMigrations` table** (`DATABASE.md:18`) — the schema was applied by `db push`/direct SQL and `prisma/migrations/` is *documentation* of hand-applied changes. `prisma migrate dev` "falla en entornos no interactivos y puede ofrecer un reset destructivo" (`DATABASE.md:23`) and **must never run unsupervised**. The documented procedure (`DATABASE.md:25-29`) is: edit schema → `npx prisma generate` → apply DDL over `DIRECT_URL` → replicate it in `migration.sql`. `prisma generate` needs the dev tree stopped (`EPERM` on `query_engine-windows.dll.node`, `apply-progress.md:153`).

Six migrations, ordered, each additive except the last, each with a validation gate and a rehearsed reversal. S3 (M2) is the one-way door.

| # | Slice | DDL | Validation gate (must return 0 rows) | Reversal |
|---|---|---|---|---|
| **M5** | S1b | `CREATE UNIQUE INDEX "CashSession_one_open_per_branch" ON "CashSession"("tenantId","branchId") WHERE "status"='OPEN'` | Pre-check: no `(tenantId,branchId)` with 2+ OPEN rows (impossible under today's tenant-wide guard, possible in hand-edited data) | `DROP INDEX` |
| **M1** | S2a | `CREATE TABLE "ItemBranchCost"` | duplicates on `(tenantId,itemId,branchId)`; then every `Inventory` pair has exactly one row whose `cost` equals the current `Item.cost` | `DROP TABLE "ItemBranchCost"` |
| **M2** | S3a | `CREATE TYPE "LotStatus"`; `CREATE TABLE "Lot"`; `Lot_one_implicit_per_item_branch` partial unique index; `INSERT` one implicit lot per `Inventory` row with `quantity = stock`, `cost = Item.cost`, `code/expiryDate = NULL` | (a) `Σ Lot.quantity` per `(tenantId,itemId,branchId)` **= `Inventory.stock`** to the cent; (b) every `Inventory` row has ≥1 `Lot`; (c) `COUNT(DISTINCT ("tenantId","itemId","branchId"))` on `Lot` = same on `Inventory` | `DROP TABLE "Lot"; DROP TYPE "LotStatus";` — `Inventory` is untouched at this stage, so stock is intact |
| **M3** | S4a | `ADD COLUMN "InventoryMovement"."lotId"/"lotCode"`; FK `ON DELETE RESTRICT`; `CREATE INDEX`; `CREATE TABLE "SaleItemLot"` | FK present with `RESTRICT` (not `SET NULL`); one `SaleItemLot` per sale line for a split line | drop table, drop constraint, drop index, drop columns |
| **M4** | S7a | `CREATE TYPE "StockTransferStatus"`; `CREATE TABLE "StockTransfer"`, `"StockTransferItem"` | both FKs `RESTRICT` where a lot is referenced | drop both tables + type |
| **M6** | S5c | `ALTER TABLE "Inventory" DROP COLUMN "stock"` | reconciliation query from M2(a) returns 0 mismatches **at the moment of the drop** | `ADD COLUMN "stock" numeric(10,2) NOT NULL DEFAULT 0` + `UPDATE … FROM (SELECT … SUM(quantity) … GROUP BY 1,2,3)` |

**Ordering rationale.** M5 is first because it is the only index that is safe before its code lands. M1 before M2 because branch cost must exist before a lot carries cost. M6 last, alone, because it is the only non-additive step and its only safe trigger is a reconciliation that agrees to the cent.

**[A1] The migration count is unchanged at six.** Pinning the sale→session mechanism adds no DDL: M5's `CashSession_one_open_per_branch` is simultaneously the uniqueness constraint and the access path for the derived-branch lookup, and the D11 derivation chain rides `User.id` (PK) plus the two `@unique` columns `User.personId` and `Employee.personId`. S1b applies M5; S1c applies no DDL at all.

**Why M2 is the one-way door.** After M2 the live `Lot` table is the sole stock record. A later model change needs a **second data migration on live stock**, which is materially worse than a schema change. Therefore: **a verified DB backup, and the reversal script rehearsed on a restored copy, are hard gates on S3a — not best practice.** S0–S2 revert cleanly (additive schema + code). Every slice after S3 reverts by code, never by re-running a DDL reversal, because by then real lot data has accumulated.

**Two-decimal exactness of the backfill.** `Inventory.stock` is already `numeric(10,2)` and `Lot.quantity` is `numeric(10,2)`, so the copy is a bit-exact value transfer with no rounding. The same holds for `cost`.

**Rollback per slice.** Every slice is independently revertible except S3a/M2, which needs the rehearsed reversal. Never `migrate dev`.

## Work-unit slices

`delivery_strategy` is **`ask-on-risk`** — the user's preflight choice. This design therefore **overrides** the `auto-chain` recommendation at `proposal.md:187` and does not pre-resolve the chain: the slicing is presented, and the orchestrator runs the gate with the user. Estimates are honest authored changed lines (additions + deletions) against the 400-line budget, excluding the generated Prisma client. **Every slice below is under 400.** Slicing is bounded — one honest pass, no comment/test deletion to hit a number.

| # | Slice | Depends on | Contents | Est. | Budget |
|---|---|---|---|---|---|
| **S0a** | Branch read + create | — | `GET`/`POST /branches`, Zod, entity, port | 150–190 | OK |
| **S0b** | Branch edit + UI + i18n | S0a | `PATCH /branches/[id]`, `BranchesView`, tab wiring, i18n ×2 | 230–270 | OK |
| **S1a** | Multi-branch read correctness | S0a | `getInventory` grouping, `branchId` on `InventoryStockItem`, dedup velocity rank | 180–220 | OK |
| **S1b** | **[A1]** Session branch derivation | S0a | M5; `deriveSaleBranch` (D11 steps 1–2); `openCashSession` derived + per-branch 409, `OpenCashSessionInput` loses `branchId`; `registerSale` branch-scoped lookup replaces `:1961-1963`; implicit-lot row for a new branch | 240–290 | OK |
| **S1c** | **[A1]** Register atomicity + derived reads | S1b | D11 steps 3–4 (in-tx resolution + session claim); failure codes and messages; `getOpenCashSession`/`getDashboard` derived; `LEGACY_STATUS_BY_MESSAGE` cleanup (`api-error.ts:34`) | 170–210 | OK |
| **S2a** | Branch-scoped cost model | S1a | `ItemBranchCost`, M1, entity, port reads | 140–170 | OK |
| **S2b** | Reroute all cost consumers | S2a | all seven `Item.cost` sites; delete `tx.item.update` (`:940-943`) | 230–280 | OK |
| **S3a** | Lot schema + stock backfill | S2b | `Lot`, M2, validation + reversal scripts | 120–150 | OK |
| **S3b** | Lot API surface | S3a | `LotEntity`, port, Zod, `GET/POST/PATCH /inventory/lots` | 200–240 | OK |
| **S4a** | Lot-aware receive | S3b, S2b | remove the receive merge (`:873-886`) and the PO-create merge (`:1035-1039`); per-lot fill + `RECEIVE` rows; branch-only re-average; cost from the lot, not the PO line | 220–260 | OK |
| **S4b** | Lot-aware adjust + count + ledger folds | S3b | fold `:2793` and `:2875` into `recordMovement`; per-lot adjustment/count; M3 | 230–270 | OK |
| **S5a** | FEFO engine | S4a, S3b | remove the sale merge (`:1946-1959`); candidate query; draw loop; `SaleItemLot`; cascade + 409; D7 | 280–330 | OK |
| **S5b** | Per-lot ledger + line cost | S5a | one `SALE` row per allocation; weighted line cost; rollback + concurrency tests | 200–240 | OK |
| **S5c** | Retire `Inventory.stock` | S5b | M6 + reconciliation gate | 60–90 | OK |
| **S6a** | Lot-aware returns | S5b | per-allocation over-return guard; restore to the original lot; per-lot `RETURN` rows at the original cost | 200–250 | OK |
| **S7a** | Transfer document | S0a, S3b | `StockTransfer` + `StockTransferItem`, M4, state machine, create/list/get | 230–270 | OK |
| **S7b** | Dispatch | S7a, S5a | per-lot guarded decrement + `TRANSFER_OUT` at source lot cost; 409 when short | 170–210 | OK |
| **S7c** | Receive + cancel/reversal | S7b | auto-create the destination lot, `TRANSFER_IN` at the same cost, no re-average; explicit cancel + reversing rows; **no timeout mutation** | 210–250 | OK |
| **S8a** | Lot columns + expiry badges | S3b, S4a | `InventoryView` lot columns, expiry/quarantine badges, i18n ×2 | 230–280 | OK |
| **S9a** | Transfer UI | S7c | transfer view and workflow, i18n ×2 | 250–300 | OK |
| **S9b** | Ledger lot surfacing | S5b | lot code + expiry in `InventoryMovementsView` | 180–220 | OK |

**21 slices, all within budget**, each independently shippable with its own verification and revert. S3a is the one slice whose revert is a rehearsed DDL reversal rather than a code revert. **S5c is deliberately separated from S5b** so that if the reconciliation gate fails, the drop is deferred without blocking the sale path.

**[A1] Revised counts.** Pinning the mechanism takes the plan from **20 to 21 slices** (S1b split into S1b + S1c, both still under 400) and **migrations stay at 6**. M5 already carries `CashSession_one_open_per_branch`, which is simultaneously the uniqueness constraint *and* the access path for the D11 lookup, and the derivation rides existing indexes (`User.id` PK, `User.personId` and `Employee.personId` both `@unique`) — so **no new DDL and no new migration are introduced by A1**. S1c exists so S1b does not cross 400 once the derivation, the two failure codes, the in-tx claim, and the derived read are all in it; the two are separable because the sale path is deterministic after S1b alone and only gains its atomicity guarantee in S1c.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (repo) | FEFO order, cascade, expiry filter, 409 conditions, weighted line cost, per-lot ledger rows | Extend the existing hand-built `tx` mock pattern (`prisma-distribution.inventory-ledger.test.ts:9-37`: `vi.hoisted` mocks + `$transaction: fn => fn(tx)`). New suites: `prisma-distribution.fefo.test.ts`, `prisma-distribution.lot.test.ts`, `prisma-distribution.branch-cost.test.ts`, `prisma-distribution.transfer.test.ts` |
| Unit (schema) | 2dp rejection, lot payload contracts, strict lot query | `src/core/schemas/distribution.test.ts` already exists and is the home |
| Route | Tenant isolation + auth on every new route | Same shape as the 6 existing route suites (`inventory`, `adjustments`, `count`, `movements`, `daily-close`, `employees`) |
| Integration (manual, needs a live DB) | Sale-path concurrency | See below |
| Gate | lint, typecheck, no `any` (Rule #2), i18n parity in both locales | per slice; `tsc` enforces the first, a key-diff grep enforces the second |

**The sale-path concurrency test, in two honest tiers.** The existing mock runs `$transaction(fn) => fn(tx)` against shared mocks, so it **cannot express real interleaving** — claiming otherwise would be a fake test.

- **T1 (CI, always runs): guard shape and rollback.** Every lot decrement carries `quantity: { gte: take }`; a simulated `count: 0` mid-loop yields 409; and after that throw, `tx.sale.create` and `tx.saleCounter.upsert` were **never called**. This proves the failure mode is contained, not that the database serializes two writers.
- **T2 (manual, required before S5b merges, needs a live DB):** fire two concurrent `registerSale` calls against the same lot set. Assert `Lot.quantity` never goes negative, `Σ decrements` equals the sum of both sales' `SaleItemLot` rows, the `SaleCounter` shows no gap, and the kardex balances. This is the only test that empirically exercises D7.

**Tenant-isolation tests** (per new route, and for every id parameter): cross-tenant `lotId` → 404 and no write; cross-tenant `branchId` on session open → 404 and no session; cross-tenant `transferId` → 404; a body containing `tenantId` → stripped, session tenant governs, no second tenant's row is read.

**[A1] D11 session-binding tests.** New suite `prisma-distribution.session-binding.test.ts`, same `vi.hoisted` tx-mock pattern. Adding `employee: { findFirst }` and `cashSession: { updateMany }` to the mocks in the two **existing** sale suites (`fractional` `:36-59`, `sale-unit`) is required; moving the lookup inside the transaction is *free*, because those suites spread one `tx` object into `prisma` (`:57-63`), so the same `cashSession.findFirst` mock already answers on both clients.

| # | Test | Asserts | Fails today because |
|---|---|---|---|
| D11-1 | Single-branch tenant, user with **no** `Employee` row | sale succeeds at the tenant's only branch, 201 | passes today by accident; **locks the backward-compatibility guarantee** |
| D11-2 | `Employee.branchId` is `null`, single-branch tenant | identical to D11-1 — the two collapse deliberately | `branchId` is nullable (`schema:378`) and today's code never reads it |
| D11-3 | Two branches, user with **no** `Employee` row | 400, message names the configuration fix, **no** `tx.lot` call, **no** `tx.sale.create` | today the sale succeeds at whichever branch the unordered row gave |
| D11-4 | User's branch B open, branch A also open | the sale's `cashSession.findFirst` is called with `{ tenantId, branchId: 'B', status: 'OPEN' }` and the decrement runs at B | today the `where` has no `branchId` (`:1961-1963`) |
| D11-5 | **No `orderBy` is added** | the `findFirst` call carries no `orderBy` and no `take` | — this is a *regression guard on the guarantee itself*: M5 makes the result unique, so adding a sort would let someone later relax M5 without noticing |
| D11-6 | Claim lost (`updateMany.count === 0`) | 400, and `tx.lot.updateMany`, `tx.sale.create`, `tx.saleCounter.upsert` were **never** called | no claim exists today |
| D11-7 | Claim precedes the first stock write | call-order assertion: `cashSession.updateMany` before any `lot.updateMany` | — pins the transaction-boundary position of D11 |
| D11-8 | Cross-tenant `userId` | `employee.findFirst` is called with the **session** `tenantId`; an `Employee` row whose `branchId` belongs to another tenant resolves to no session and 400 | `Employee.branchId` has no FK to `Branch.tenantId`, so the tenant guard must come from the `where` (Rule #1) |

**The costing and multi-branch defects were read-derived, not runtime-proven.** No live-database query was run to confirm them; they were established by reading source in this and the explore phase. These tests make them **empirical**:

| Read-derived defect | Anchor | The test that proves it | Why it currently fails |
|---|---|---|---|
| Branch-B receive rewrites tenant-wide `Item.cost` | `:933-943` | S2b: item costed 2.00 at A with 10 units, B empty; receive 10 into B at 5.00 → B = 5.00, **A still 2.00**, and **`tx.item.update` is never called** | The last assertion is the real one: today's code issues `item.update` with a branch-B-derived average into a tenant-wide field |
| `getInventory` returns duplicate rows for one item across branches | `:490-504` | S1a: two `Inventory` rows for one item → two rows with **distinct `branchId`**, and the velocity sort ranks the product once per branch | Both rows key `id: row.item.id`, so they share an id and the same `unitsSold30d`; the sort ranks the duplicate twice |
| Open-session resolution is arbitrary and internally inconsistent | `:1961-1963` vs `:1408-1416` | **[A1]** S1b+S1c: two open sessions at different branches → the sale decrements the cashier's own branch **and** `getOpenCashSession` and `registerSale` resolve the **same** session | `registerSale` has no `orderBy` while `getOpenCashSession` orders by `openedAt desc`; today they agree only by accident of the tenant-wide 409, and they would disagree the moment a second open session exists |
| `getFiscalSummary` profit uses the live cost against historical prices | `:1747-1757` | S2b: change `Item.cost` after a sale → the historical month's profit is unchanged | Profit is `Σ (SaleItem.price − Item.cost) × qty` today; it must read the `SaleItem.cost` snapshot |
| PO receive ledgers branch-B goods at branch-A's cost | `:1065`, `:1108`, `:910`, `:954` | S4a: PO for branch B received at lot cost 5.00 → the `RECEIVE` row carries 5.00, and the PO line's tenant-wide cost is not used as the snapshot | `poItem.cost` is frozen from the tenant-wide `Item.cost` at PO create, then becomes the receive `costSnapshot` |

## Threat Matrix

**N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is introduced.** The change is HTTP route handlers, a Prisma adapter, React views, and DDL that an operator applies by hand over `DIRECT_URL`. Every row of `references/threat-matrix.md` is N/A for this reason: no documentation-like path is resolved or typed from user input, no repository is selected, no commit/push/PR is automated, no file is executed or classified. `prisma generate` and the DDL apply are operator-run commands documented in `DATABASE.md`, not designed automation.

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R0** | ~~The spec forbids the only cash-session model that makes branch B sellable.~~ **CLOSED [A1].** Both specs were amended (`distribution-branches/spec.md:48`, `distribution-cash-register/spec.md:16`) to one OPEN session per branch with a server-derived branch, and the sale→session property is pinned. The residual risk is now R11/R12 | — | — | Q-D1 answered; D11 pins the mechanism |
| **R11** | **[A1]** `closeCashSession` (`:1528-1581`) is **not** transactional: it aggregates `expectedAmount` (`:1547-1556`) *before* its `update`. D11's claim makes the sale side safe, but a sale whose claim lands after that aggregate and whose `Sale` insert commits before the close's `update` is still omitted from a closed register's expected total | Med | **High** (money) | **Not fixed by D11, deliberately out of scope** — pre-existing, and no delta spec requires it. Named follow-up: move the close into its own `$transaction` that claims the session first, identical to D11 step 4. Re-open if a test reproduces the under-count |
| **R1** | **S3a/M2 is a one-way door.** After the backfill, `Lot` is the only stock record; a later model change needs a second migration on live stock | Med | **Critical** | Backup + **rehearsed reversal on a restored copy** are hard gates. M2's validation is three zero-row queries, and the reversal leaves `Inventory` untouched |
| **R2** | The costing and multi-branch defects are **read-derived, not runtime-proven** (no live-DB query was run) | High (static) | High | The five tests in the testing table make each one empirical, and each fails on today's code — that is the point. S1a is the earliest verification vehicle, before any second branch exists in production |
| **R3** | FEFO's N sequential guarded decrements replace one atomic `updateMany`; the failure mode moves mid-loop | Med | High | `$transaction` all-or-nothing; the `SaleCounter` is inside the tx (`:2054-2059`); T1 proves no partial escape, T2 exercises real contention |
| **R4** | **A third `Map` merge exists** at `:1035-1039` (`createPurchaseOrder`), and it freezes the tenant-wide `Item.cost` into the PO line cost that later becomes the RECEIVE snapshot | High | High | S4a removes all three merges and takes the receive cost from the lot. Listed in the testing table with a test that fails today |
| **R5** | `getFiscalSummary` (`:1747-1757`) reports gross profit from the **live** `Item.cost` against **historical** prices, so any re-average retroactively corrupts a filed month | High | High | S2b reroutes it to the `SaleItem.cost` snapshot. Not in the proposal's five-consumer list; found in this phase |
| **R6** | 20 slices is a lot of reviews, and `prisma generate` after each schema change hits `EPERM` on `query_engine-windows.dll.node` while `next dev` runs (occurred in batch 4) | High | Low | Stop the dev tree before generating (`apply-progress.md:153`); fold mock updates into the slice that introduces the model |
| **R7** | i18n parity: `messages/{es,en}.json` are 732 lines each and every new key must land in both in the same commit as the view | High | Low | Same commit, per `apply-progress.md:213` (6/6 batches) |
| **R8** | A new Prisma model adds hand-built tx mock surface to 4 repo suites + 6 route suites | High | Med | Each model ships inside the slice that introduces it (S3a/S4b/S7a), never as a later catch-up slice |
| **R9** | `prisma migrate dev` run unsupervised wipes the DB — there is **no `_PrismaMigrations` table** (`DATABASE.md:18-23`) | Low | **Critical** | Already forbidden; additive-only hand-applied DDL over `DIRECT_URL`, backup first |
| **R10** | The daily close stays tenant-wide (`:2585-2612` has no `branchId` in the `where`), so a transfer's stock effect is invisible in the report | Med | Med | Out of scope per `distribution-inventory-ops` Open Questions; branch-scoping the close is the named follow-up |
| **R12** | **[A1]** `openCashSessionSchema` still accepts a client `employeeId` (`schemas/distribution.ts:365`) and `openCashSession` writes it verbatim (`:1477`), so a client can point a session at **another** employee even though it can no longer spoof the branch. Recorded at `distribution-branches/spec.md:117` | Med | Med | **Carried forward unchanged, deliberately not re-litigated here.** A1 removes the *branch* spoof only. Follow-up: drop the field, or require it to match the session user's `Employee` — the same server-derived chain D11 uses |
| **R13** | **[A1]** `ApiError` carries `(status, message)` with no machine-readable code and `errorResponse` returns `{ error: message }` only (`api-error.ts:13-18,41-43`). Every D11 failure is therefore a 400 that the client can only read by matching Spanish message text | Med | Low | D11 accepts this deliberately (one code + one actionable message beats two codes the UI cannot tell apart). Follow-up: add a `code` discriminator to `ApiError`; D11's five failure rows then map to codes with no repository change |

## Open Questions

- [x] ~~Q-D1 (was BLOCKING). Is the OPEN-session guard tenant-wide or per `(tenantId, branchId)`, and when more than one is open, which session does a sale bind to?~~ **[A1] RESOLVED — both halves.**
  - *Guard:* **per `(tenantId, branchId)`**, M5 partial unique index. The specs were amended to match; no longer a design question.
  - *Binding:* the **server derives it** from the authenticated user's branch (D11). **This reverses the recommendation this design originally made**, which argued for `cashSessionId` in the sale body. The user chose the derived mechanism, and the reason it is the better one is now recorded in D11: a client-named session is a spoofable field on the one path that moves stock, and a client that can name any of the tenant's open registers can re-create the wrong-till risk this change exists to remove. The derived chain needs no field, and `RegisterSaleInput.userId` + the route's existing `session.userId` pass-through made it nearly free.
  - *Consequence to respect downstream:* `sdd-tasks` plans **S1b and S1c**, and must not reintroduce a `sessionId` or `branchId` field on the sale path to make a slice testable — D11-4 asserts the derived `where` instead.
- [ ] **Q-D2. Is a peso-denominated lot in scope?** The brief names `Item.saleUnit = PESO`, but the enum is `UNIDAD | LIBRA | KILOGRAMO` (`schema:68-72`). `KILOGRAMO`/`LIBRA` cover the weighed case with no schema change. A literal `PESO` means a new enum member, an additive enum migration, and a `saleUnitLabelOf` case (`repository:187-191`) — state whether that is in or out.
- [ ] **Q-D3. `DROP COLUMN Inventory.stock` now (D2) or two-phase?** This design recommends one step after a reconciliation gate, because any two-phase split leaves a window where `Inventory.stock` and `Σ Lot.quantity` diverge by construction. The alternative is add-lot → move-writes → drop later, accepting that window and adding a standing reconciliation query. Also gated on R1.
- [ ] **Q2 (carried).** Who may dispatch and who may receive a transfer? Reusing `TENANT_ADMIN` for dispatch and the destination branch's `CASHIER` for receipt costs no new role. A dedicated warehouse role means a new `AccessRole` member plus the `MANAGER→TENANT_ADMIN` session mapping (`repository:76-87`) and `roles.ts` `RESTRICTED_TABS` — it touches auth.
- [ ] **Q3 (carried).** May an operator **request** a specific lot at the point of sale? This design implements the automatic case (Q3 open in both `distribution-fefo` and `distribution-payments-returns`). `SaleItemLot` supports a later `lotId` per line without invalidating anything pinned here.
- [ ] **Q5 (carried).** Confirm the two transfer behaviors this design already fixes as a consequence of the settled inputs: **explicit cancel with a reversing ledger row** and **no timeout mutation** (a timeout that fires after the destination received double-counts stock), and **no re-average on `TRANSFER_IN`** (D8/D9). Flagged because each changes reported behavior.
- [x] ~~Q6 (weighed goods and lot control)~~ — **resolved by this design:** lot control is allowed on weighed items; `Lot.quantity` is denominated in the item's own `saleUnit` with no conversion factor, exactly as stock already is (`schema:169-171`). Confirmation only.

## Next step

`sdd-tasks`. **[A1]** Q-D1 is closed, so the only remaining hard gate is **R1's** backup + rehearsed-reversal acceptance before `S3a`. It must forecast the **21-slice** plan against the 400-line budget with the standard guard lines, carrying `delivery_strategy: ask-on-risk` (the user's choice, which overrides the `auto-chain` recommendation at `proposal.md:187`) to the user's gate — and it must plan **S1b and S1c** as two slices, since D11's in-tx claim and failure taxonomy no longer fit inside the original S1b without crossing 400.

## Key Learnings

1. **[A1]** A sale can resolve its cash session with no client field at all: `RegisterSaleInput.userId` already existed, the route already forwarded `session.userId`, and `User.personId` → `Employee.personId` → `Employee.branchId` rides three existing indexes, so the whole mechanism needed no schema change, no migration, and no POS change.
2. **[A1]** Moving a lookup inside `$transaction` is not by itself an atomicity fix under READ COMMITTED; the guarantee came from adding a guarded `updateMany` claim on the session row as the transaction's first write, because `closeCashSession` runs outside any transaction.
3. **[A1]** A partial unique index can serve as both the constraint and the access path, so the new branch-scoped session lookup needs no `orderBy` — and omitting that `orderBy` is itself a testable guarantee (D11-5).
4. `createPurchaseOrder` merges duplicate item lines too, so there are three `Map` merges to remove rather than the two the proposal counted.
5. `getFiscalSummary` computes gross profit from the live `Item.cost` against historical sale prices, so any cost re-average retroactively corrupts a filed month.
6. Prisma defaults an optional relation to `onDelete: SetNull`, so an explicit `onDelete: Restrict` is required on the movement-to-lot foreign key or lot deletion silently rewrites the audit trail.
