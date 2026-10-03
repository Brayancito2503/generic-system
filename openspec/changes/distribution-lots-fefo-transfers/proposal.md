# Proposal: distribution-lots-fefo-transfers — Lots, FEFO, Branch-Scoped Cost, and Inter-Branch Transfers

> **Naming.** This change is `distribution-lots-fefo-transfers` and is **not** "Fase 3". The repo has two colliding "Fase 3"s: `PLAN.md:88` defines "FASE 3 — Onboarding multi-tenant real", while `prisma/schema.prisma:41-42` uses "Fase 3" for the distribution vertical's branch-transfer milestone. Every artifact in this change names the change slug, never "Fase 3".

## Intent

A real distributor cannot sell what it cannot locate, and it cannot lose money on what it cannot cost. Today the Generic System distribution vertical cannot do three things a distributor needs on day one:

1. **Track lots with expiry.** No lot, batch, or expiry field exists anywhere — zero matches for `lotId|lotNumber|batch|expiry|expiresAt|lotCode` across `src/**` and `prisma/schema.prisma`. Perishable stock (food, medicine, beverages) is sold with no expiry discipline, so near-expiry and expired goods are indistinguishable from fresh goods until the customer complains.
2. **Move stock between branches.** `TRANSFER_OUT`/`TRANSFER_IN` are declared in `prisma/schema.prisma:49-50` and accepted by `listMovementsQuerySchema` (`src/core/schemas/distribution.ts:294-303`), but nothing ever writes them — the schema comment at `:41-42` says so explicitly. A second branch cannot even be created through the product: the only `branch.create` under `src/` is tenant provisioning (`src/app/api/admin/tenants/route.ts:71`).
3. **Cost stock per branch.** `Item.cost` is tenant-wide (`prisma/schema.prisma:166`, no `branchId`), yet the weighted average is computed from a **branch-scoped** stock and written back to that single tenant-wide field (`prisma-distribution.repository.ts:933-943`).

This change adds lot control, FEFO consumption, branch management, branch-scoped cost, and inter-branch transfers, and it fixes the costing defect that a second branch makes visible.

**Grounding.** Built on `exploration.md` in this change root (verified against `dc42129`). Five product decisions are already settled and are treated as inputs, not questions: multiple simultaneous lots with a sale line that may split across them; opt-in per-product lot control; branch-scoped cost; `Lot` owns stock; branch management in scope ahead of transfers.

## Scope

### In Scope

- **Lot control (opt-in per product).** New `Lot` model owning the stock quantity; an `Item` flag makes lot control opt-in so non-perishable products (hardware, cleaning supplies) keep today's flow.
- **FEFO consumption on the sale path.** Per-lot ordered allocation, per-lot guarded decrements, and a real split-line representation so one sale line can draw from several lots.
- **Removing the sale-line merge** at `prisma-distribution.repository.ts:1946-1959`, which collapses duplicate `itemId`s into one line and destroys the lot dimension.
- **Per-lot kardex.** `lotId` on the ledger plus a lot-code snapshot; the two direct `tx.inventoryMovement.create` bypasses (`:2793`, `:2875`) folded into `recordMovement`.
- **Branch management (prerequisite, pulled in deliberately).** Create / list / edit branches with UI, ahead of transfers. Every tenant is born with exactly one branch today.
- **Branch-scoped cost (prerequisite, pulled in deliberately).** A per item × branch weighted average fed by real lot cost, replacing the tenant-wide `Item.cost` as the costing source of truth, and migrating existing cost data.
- **Inter-branch transfers** with a transfer document, a state machine, and `TRANSFER_OUT`/`TRANSFER_IN` ledger writes.
- **Lot-aware returns**, restoring a returned unit to *its* original lot.
- **Multi-branch read correctness** that the second branch makes immediately visible.

### Out of Scope

- **Branch deletion.** `PurchaseOrder.branchId` and `CashSession.branchId` are `ON DELETE RESTRICT` (`prisma/migrations/20260909120000_init/migration.sql:380, 401`), so any branch with a PO or cash session cannot be deleted and a naive endpoint would fail with a raw FK error. Branch *edit* is in scope; deletion is not.
- **Cash dimension on transfers.** `CashMovement` is IN/OUT of a session and carries no item reference (`prisma/schema.prisma:417-428`).
- **Weighed-goods unit conversion.** No conversion factor: quantity stays expressed in the item's own `saleUnit` (`schema:169-171`).
- **Customer-facing expiry display, expiry alerts/notifications, and lot traceability reporting** beyond what the kardex already supports.
- **Gym module, base shell, and non-distribution verticals.**
- **Deleting the unused `TRANSFER_*` enum values' "reserved" status** — this change makes them real, it does not remove them.

### Scope honesty

Branch management (S0) and branch-scoped cost (S2) are **prerequisites pulled in, not incidental work**. A transfer between two branches a tenant cannot create is undemonstrable, and branch-scoped cost is where FEFO's per-lot real cost has to live. The archived apply log already recorded the branch gap as a known deviation: `openspec/changes/distribution-complete/apply-progress.md:212` — *"No branch endpoint exists (content): PO create requires `branchId` but no branch-listing API exists."* This change closes it.

## Capabilities

Proposed slugs (the explore verified no lot/transfer/expiry spec exists today: zero matches for `lot|lote|batch|expir|transfer|traspas` in `openspec/specs/*/spec.md`).

### New Capabilities
- `distribution-branches` — tenant-scoped branch create / list / edit
- `distribution-lots` — lot model, opt-in lot control, per-lot stock ownership
- `distribution-fefo` — FEFO allocation, split sale lines, per-lot ledger rows
- `distribution-transfers` — transfer document, state machine, `TRANSFER_OUT` / `TRANSFER_IN`

### Modified Capabilities
- `distribution-inventory-ops` — stock owner moves to `Lot`; `getInventory` groups per item; branch-scoped cost
- `distribution-purchase-orders` — receive is lot-aware and re-averages per branch
- `distribution-payments-returns` — returns restore to the original lot
- `distribution-cash-register` — deterministic open-session branch resolution

## Approach

### A. `Lot` owns the stock quantity

`Lot` is the single owner of a sellable quantity. Concretely: `tenantId`, `itemId`, `branchId`, `code?`, `expiryDate?`, `manufactureDate?`, `cost Decimal(10,2)`, `quantity Decimal(10,2)`, a status field for quarantine, and a unique key on `(tenantId, itemId, branchId, code)`. Lots are always read scoped `{ tenantId, itemId, branchId }`; a lot id is never accepted as a tenant discriminator (Rule #1).

**One quantity owner, never two.** With opt-in lot control, a non-lot product still needs somewhere to hold quantity. Rather than keep a second quantity path (a guaranteed drift factory), every item × branch gets **at least one** `Lot` row: lot-controlled items get real lots; non-lot items get exactly one **implicit lot** (`code = null`, `expiryDate = null`) that behaves exactly like today's single `Inventory` row. `Lot.quantity` is therefore the only quantity column in the system.

**What happens to `Inventory.stock`.** It stops being an owner. `Inventory` keeps `minAlert` (a per item × branch alert policy, not a quantity) and keeps its `@@unique([tenantId, itemId, branchId])` key, which is exactly the row shape the implicit lot needs. Whether the `stock` column survives as a denormalized read cache or is dropped for a `groupBy` is a **design-phase** decision with a stated tradeoff:

- `groupBy` over `Lot.quantity` — no drift possible; costs one extra aggregate query.
- Maintained `Inventory.stock` column — cheap reads; drift risk; needs reconciliation.

**Recommendation: `groupBy`.** `getInventory` already issues a second aggregate query for `unitsSold30d` (`prisma-distribution.repository.ts:489`), so aggregating stock the same way is the established pattern in this file, not a new cost model.

### B. Branch-scoped cost

A new per item × branch cost record holds the weighted average, fed by real lot cost on receive. `Item.cost` stops being the costing source of truth for lot-controlled items.

The five existing consumers of `Item.cost` all reroute, all in one file:

| Consumer | Anchor | Becomes |
|---|---|---|
| `SaleItem.cost` snapshot | `:2094` | per-allocation cost on `SaleItemLot` (weighted across the lots a line drew from) |
| daily close `lineCost` | `:2655` | reads the line's allocation cost |
| daily close `mermaCost` | `:2619-2627` | unchanged in behavior — it filters `type: 'ADJUSTMENT'` only (`:2608`), and lots add no new ADJUSTMENT rows |
| adjustment `costSnapshot` | `:2801`, `:2883` | the adjusted lot's cost |
| return `costSnapshot` | `:2432` | the original lot's cost |

The latent defect this removes: today `tx.item.update({ where: { id: item.id }, data: { cost: newCost } })` (`:940-943`) writes a **branch-B-derived** average into a **tenant-wide** field, so receiving into branch B re-costs branch A's stock. That defect exists today and needs no lots to exist; lots make it unignorable because a lot's cost is a per-lot fact and `Item.cost` is a single scalar.

**Existing cost data must be migrated** — every existing item × branch pair needs a branch-scoped cost row seeded from today's `Item.cost`, so no tenant's reported margin shifts on cutover day.

### C. FEFO allocation semantics

**The structural blocker, stated honestly.** `registerSale` merges duplicate `itemId`s into one line via `new Map<string, number>()` (`:1946-1959`), and `saleLineSchema` is `{itemId, quantity}`. Separately, stock is decremented by one atomic guarded `updateMany` per line (`:2033-2048`).

FEFO replaces the single decrement with: read candidate lots for `(tenantId, itemId, branchId)` in a deterministic order → walk them taking `min(remaining, lot.quantity)` → one guarded decrement per lot, each keeping its own `gte` guard → 409 if the candidates cannot cover the line.

**The merge must go.** For a purely automatic FEFO the merged line would technically still allocate correctly, so be clear about why it changes anyway: the sale line becomes the **parent** of the allocation rows (`SaleItemLot` references `saleItemId`), and a merged line has no stable identity to hang them on. Keeping the merge would mean the split representation is only half-built and the next change to F4 (below) re-opens `registerSale` a second time. Removing it is the honest structural cost of decision 1.

**Allocation order** (deterministic, per F5): `expiryDate ASC NULLS LAST, createdAt ASC, id ASC`. The `id` tiebreak is not decoration — without a total order the same sale allocates differently run to run, which is unacceptable in an auditable ledger. Every comparison uses `Prisma.Decimal` and `comparedTo`, reusing the style at `:515-517`, `:898`, `:938`, `:969` (no float drift — already correct today).

| Rule | Behavior | Status |
|---|---|---|
| **No expiry date** | Lot-controlled items: consumed **last** (`NULLS LAST`) — the safest ordering, and standard for perishables. Non-lot items: exactly one implicit lot, so FEFO is trivially satisfied. | Decided here (F1) |
| **Earliest-expiring lot has insufficient quantity** | **Cascade** into the next lot. 409 only when the sum of *all* candidates is short (F2). Cascading keeps a routine sale atomic; a 409 that asks the operator to arbitrate lot choice on an ordinary sale is worse than the alternative. | Decided here (F2) |
| **Tied expiry dates** | `createdAt ASC`, then `id ASC` (F5). | Decided here (F5) |
| **Already-expired lot still in stock** | **Open — see Q1.** Not decided here; it is a client-liability policy, not an engineering preference. | Open |
| **Automatic vs operator-selectable** | **Open — see Q3.** Schema supports both; automatic keeps the sale payload and `SalesPOSView.tsx` untouched. | Open |

**Split lines.** A new `SaleItemLot` allocation table (`saleItemId`, `lotId`, `quantity`, `costSnapshot`) expresses "5 from lot A, 7 from lot B" on one sale line. `SaleItem` gains **no `tenantId`** — the repo documents that pattern at `prisma/schema.prisma:272-276` (tenant-scoped reads reach sale lines through `sale`), and every lot aggregate must preserve it.

**Concurrency, honestly.** `$transaction` (`:1997`) preserves all-or-nothing, so the current race safety is not lost. What changes: `updateMany`'s single-statement atomicity is replaced by N sequential guarded decrements. Under Postgres READ COMMITTED the outcome is still correct, but the failure mode moves from "one statement returns `count === 0`" to "statement *k* throws mid-loop". The code must not leak partial work, and S5 must add a concurrency test on the sale path.

### D. What the kardex records per lot

`MovementParams` (`:98-109`) gains `lotId`, and the ledger writes **one row per lot allocation**, not per `SaleItem`. The helper is *near*-universal, not universal: `:2793` and `:2875` are direct `tx.inventoryMovement.create` calls that must be folded into `recordMovement` or kept in lockstep. That is a one-field interface change plus two call-site folds — the cheapest structural win in this change.

**`InventoryMovement` gains `lotId` AND a `lotCode` snapshot.** The repo already snapshots `costSnapshot` (`:213`) for exactly this reason: a ledger row must stay readable after the referenced record changes. A movement is an audit record, so a lot code is snapshotted on the same principle; the alternative (join `Lot` at read time) breaks the audit trail the moment a lot is archived. `lotId` stays as the relational anchor and lot delete is `RESTRICT` while movements reference it.

Downstream consumers:

| Consumer | Anchor | Effect |
|---|---|---|
| `mermaCost` | `:2619-2627` | **Unchanged** — filters `type: 'ADJUSTMENT'` only (`:2608`); extra lot rows do not inflate merma |
| `getMermaSummary` | port `:501-504` | Unchanged, same filter |
| `getDashboard` low-stock | `:324-330` | Row count multiplies per lot → **must be grouped** or the low-stock count inflates |
| `listInventoryMovements` | `:2910+` | Returns N rows per sale line — correct, but the UI must show which lot moved |

### E. Transfer state machine

**Real roles, read not invented** (`prisma/schema.prisma:34-38`, `prisma-distribution.repository.ts:76-87`, `src/modules/distribution/lib/roles.ts:10`):

- `AccessRole` = `CASHIER | ACCOUNTANT | MANAGER`. `MANAGER` maps to the `TENANT_ADMIN` session role.
- `FULL_ACCESS_ROLES` = `STAFF, TENANT_ADMIN, SUPER_ADMIN`.
- `requireApiAuth` accepts `SessionRole[]` only (`src/lib/session-token.ts:6-12`, `src/lib/session.ts:40-49`).
- **There is no warehouse role today.** Adding one is a new `AccessRole` member plus a session mapping plus `roles.ts` `RESTRICTED_TABS` work; reusing is free. This is open question Q2.

**States** mirror the existing `PurchaseOrder` precedent (`PENDING → ORDERED → RECEIVED`, `prisma/schema.prisma:346`) rather than inventing a new vocabulary:

```
PENDING ──dispatch──▶ DISPATCHED ──receive──▶ RECEIVED   (terminal)
   │                     │
   └──cancel──▶ CANCELLED ◀──cancel + stock reversal──┘
```

**Stock timing: decrement on dispatch, increment on receipt.** Decrementing on receipt would mean the source branch can still sell stock that has physically left, which is dishonest and produces negative-physical situations that no adjustment can explain. Decrementing on dispatch is the honest representation, and it is what the already-declared `TRANSFER_OUT` / `TRANSFER_IN` pair implies.

- **Dispatch** (source branch): guarded per-lot decrement, `TRANSFER_OUT` row per lot at the **source lot's cost**. This also makes transfer receipt auto-create the destination lot row, mirroring the guard at `:2776-2781` that today rejects receiving into a branch with no `Inventory` row.
- **Receive** (destination branch): increment the destination lot, `TRANSFER_IN` row per lot at the **same cost** it left with.
- **In-transit stock is derived, not stored**: the sum of `StockTransferItem` quantities in `DISPATCHED` state. No separate in-transit bucket means no drift between a phantom stock column and the transfer rows.

**Cost on transfer: move at source lot cost, and do NOT re-average.** `costSnapshot` is `NOT NULL` (`:213`), so a cost must always be written; a transfer that re-prices corrupts both branches' margins, and re-averaging would compound the tenant-wide cost defect. It does change reported margins, so it is the user's call — open question Q5.

**The never-received case: explicit cancel with reversal, no silent timeout.** A `DISPATCHED` transfer that is never received requires an explicit `CANCELLED` transition that increments the source lot back and writes a reversing ledger row, so the kardex balances. A **timeout-driven auto-reversal is rejected**: if the timeout fires after the destination already received, the reversal double-counts stock. Silence plus a timeout is how stock becomes unaccounted for. Timeout *notification* is acceptable; timeout *mutation* is not. Open question Q5.

### F. Multi-branch read correctness (prerequisite)

The second branch makes three read defects immediately visible, and they must be fixed in the same slice that makes branch B real — not after:

- `getInventory` keys rows by `id: row.item.id` (`:491`), so the same item in branches A and B yields **two rows with the same id and the same `unitsSold30d`**, and the velocity ranking (`:506-519`) ranks the duplicate twice. Fix: group per item, add `branchId` to `InventoryStockItem`.
- `registerSale` resolves its branch via `cashSession.findFirst({ tenantId, status: 'OPEN' })` (`:1961-1963`) with **no `orderBy` and no unique index** on `(tenantId, branchId) WHERE status='OPEN'`. With two open sessions the choice is arbitrary and POS sales decrement the wrong branch. Open question Q4.
- `createInventoryItem` always stocks the oldest branch (`:528`, via `firstBranchOfTenant` at `:247-252`), so a new branch never gets a row for an existing product.

## Packaging

Ten independently shippable slices, ordered by dependency. Estimates are **rough authored-line counts** (additions + deletions) against the 400-line review budget; every slice at or over 400 is flagged ⚠️.

| # | Slice | Depends on | Contents | Est. lines | Budget |
|---|---|---|---|---|---|
| **S0** | Branch CRUD | — | `GET/POST/PATCH /api/distribution/branches`, Zod contract, port methods, branch view + tab wiring, i18n ×2 | ~380-450 | ⚠️ over |
| **S1** | Multi-branch read correctness | S0 | `getInventory` grouping + `branchId`; deterministic open-session selection; auto-create the lot/`Inventory` row for a new branch | ~150-220 | OK |
| **S2** | Branch-scoped cost | S1 | Branch-scoped cost model + additive migration + backfill existing cost; reroute all five `Item.cost` consumers; remove the tenant-wide `item.update` write | ~320-400 | ⚠️ borderline |
| **S3** | Lot schema + one-way-door migration | S2 | `Lot` model, `Item` lot-control flag, `InventoryMovement.lotId` + `lotCode`, `SaleItemLot`; additive `migration.sql`; backfill existing stock as one implicit lot per item × branch | ~250-320 | OK |
| **S4** | Lot-aware receive / adjust / count | S3, S1 | Extend receive, adjustment, and count inputs with a lot; write `RECEIVE`/`ADJUSTMENT` rows per lot; per-lot `costSnapshot`; fold `:2793` + `:2875` into `recordMovement` | ~450-550 | ⚠️ **over** |
| **S5** | FEFO allocation engine | S3, S4 | Remove the `Map` merge; `SaleItemLot` split representation; ordered lot read; per-lot guarded decrement; cascade + 409; F1/F2/F5 rules; concurrency test | ~450-600 | ⚠️ **over** |
| **S6** | Lot-aware returns | S5 | Restore to the original lot via the stored allocation; per-lot `RETURN` rows | ~200-280 | OK |
| **S7** | Transfer document + dispatch / receive | S0, S1, S3 | `StockTransfer` + `StockTransferItem`; state machine; `TRANSFER_OUT`/`TRANSFER_IN` writes at source lot cost; auto-create destination rows; cancel + reversal | ~500-650 | ⚠️ **over** |
| **S8** | Lot read surface + inventory UI | S3, S4 | `GET /inventory/lots`, port + Zod contracts, lot columns and expiry badges in `InventoryView`, i18n ×2 | ~420-500 | ⚠️ **over** |
| **S9** | Transfer UI + ledger surfacing | S7 | Transfer view and workflow, transfer filters, lot/expiry columns in `InventoryMovementsView`, i18n ×2 | ~450-550 | ⚠️ **over** |

**Budget reconciliation against the explore.** `exploration.md` §6 flagged **four** slices over budget (S3, S4, S7, S8) with S0 borderline, and one more (S5) straddling 400 at ~350-450. This plan carries **five** clearly over (S4, S5, S7, S8, S9) plus S0 and S2 borderline. Two settled decisions account for the increase and neither is padding:

- **Decision 3 (branch-scoped cost) adds an entire slice (S2)** that the explore had folded into the receive path, because it reroutes five independent consumers and migrates live cost data.
- **Decision 1 (split sale lines) grows the FEFO slice** from ~350-450 to ~450-600, because the `Map` merge removal and the `SaleItemLot` representation are structural work the explore listed as part of the blocker rather than as budgeted lines.

**Recommended `delivery_strategy`: `auto-chain`.** This is a high-risk workload by the SDD forecast (5 slices over budget, 2 borderline), and the splits are already named below, so slicing is mechanical rather than a judgment call. `ask-on-risk` is unnecessary here because the risk is fully enumerated in this section; `single-pr` is not viable for S4, S5, S7, S8, or S9.

- **S0** → S0a (`GET` + port + Zod + i18n) / S0b (`POST`/`PATCH` + view + tab wiring)
- **S4** → S4a (lot-aware receive) / S4b (adjustment + count + the two ledger folds)
- **S5** → S5a (remove merge + `SaleItemLot` + single-lot allocation) / S5b (multi-lot cascade + no-expiry ordering + concurrency test)
- **S7** → S7a (document + state machine + dispatch) / S7b (receipt + cancel/reversal)
- **S8** → S8a (`GET /inventory/lots` + port/Zod) / S8b (`InventoryView` lot columns + expiry badges + i18n)
- **S9** → S9a (transfer view + i18n) / S9b (ledger lot surfacing in `InventoryMovementsView`)

Each half is autonomous with its own verification and revert, and each half carries its own tests and i18n keys so no work unit is split away from the behavior it verifies.

**Splitting is bounded — one honest pass only.** If a named half still exceeds 400 authored changed lines, stop and report the smallest honest count as a `size:exception` recommendation. Do **not** iterate to reach the number by deleting comments, blank lines, docs, or tests, or by compressing code: the budget is a review-health limit, not a code-golf target.

**Do not start S3 until Q1 is answered** — S3 is the one-way door.

## Open Questions

Ranked by how much the answer changes the architecture. The five settled product decisions are **not** re-raised here.

| Rank | Question | Why it matters | Recommendation |
|---|---|---|---|
| **Q1** | **An expired lot still has stock. Exclude it from FEFO candidates, consume it first, or block the sale?** | Changes FEFO's candidate filter and the sale path's failure mode. It is a client-liability and regulatory question, not an engineering preference, and it is the only remaining question that changes the S5 design. | Exclude expired lots from candidates; 409 only if every candidate is expired, with a message that points at an adjustment. Selling expired goods silently is the one option this proposal will not assume. |
| **Q2** | **Who authorizes a transfer — reuse `TENANT_ADMIN` (the `MANAGER` profile), or add a new `AccessRole` member?** | Reuse is free. A new role is a new `AccessRole` member plus a session mapping (`repository:76-87`) plus `roles.ts` `RESTRICTED_TABS`, which touches auth. | Reuse `TENANT_ADMIN` for dispatch, and allow the destination branch's `CASHIER` to receive. Defer a dedicated warehouse role. |
| **Q3** | **Is FEFO automatic or operator-selectable?** | Automatic keeps `saleLineSchema` and `SalesPOSView.tsx` untouched; selectable adds a `lotId` per line and a lot picker in the POS cart. The `SaleItemLot` schema supports both, so this is cheap to flip — but the POS work is not. | Automatic, with operator-selectable as a later increment. FEFO exists to prevent waste, not to add a decision to every sale. |
| **Q4** | **How is the sale's branch resolved once several branches are live — and should the one-open-session-per-branch rule become a DB constraint?** | `cashSession.findFirst({ tenantId, status: 'OPEN' })` (`:1961-1963`) has no `orderBy` and no unique index; duplicates are guarded only by a 409 in app code. Today this is a latent risk; with branch B live it is a wrong-branch stock decrement. Also: should `getDailyCloseReport` (`:2593-2612`, tenant-wide, no `branchId` in the `where`) become branch-scoped? | Deterministic selection (scope the sale to the session the POS actually opened) **and** a partial unique index on `(tenantId, branchId) WHERE status='OPEN'`. Branch-scoping the daily close is a natural follow-up. |
| **Q5** | **Never-received policy and transfer costing: can a transfer be auto-reversed on timeout, and does `TRANSFER_IN` re-average branch-scoped cost?** | Auto-reversal can double-count if the destination already received. Re-averaging on a transfer would move branch cost without a purchase, compounding the defect decision 3 removes. | No timeout mutation (explicit cancel + reversal, per §E); no re-averaging (move at source lot cost). Both change reported behavior, so the user confirms. |
| **Q6** | **Do weighed goods (`LIBRA`/`KILOGRAMO`) have lot control, or is lot control restricted to piece-counted items?** | "5 kg from lot A" is a fractional lot draw. Exact with `Decimal`, but it interacts with `Item.saleUnit` and makes expiry on a weighed good questionable. | Allow it; `Lot.quantity` is expressed in the item's own `saleUnit`, same as stock today (`schema:169-171`). Flag for confirmation. |

## Definition of Done

- A tenant can create, list, and edit branches from the product, and stock resolves correctly per branch.
- A perishable item with lot control receives into named lots with expiry dates, and the inventory list shows lot columns and expiry badges.
- A sale draws from multiple lots across one line, the allocations are persisted, and the kardex records one row per lot.
- A return restores the unit to its original lot.
- Cost is computed and reported per branch; receiving into branch B no longer re-costs branch A.
- A transfer moves stock between branches with a document, a state machine, `TRANSFER_OUT`/`TRANSFER_IN` ledger rows at source lot cost, and a cancel-with-reversal path.
- Non-lot products behave exactly as before.
- Every new i18n key exists in **both** `messages/es.json` and `messages/en.json` in the same commit as the view.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma` | Modified | `Lot` model, `Item` lot-control flag, `InventoryMovement.lotId` + `lotCode`, `SaleItemLot`, `StockTransfer` + `StockTransferItem`, branch-scoped cost model |
| `prisma/migrations/<ts>_*/migration.sql` | Added | Additive DDL + cost/lot backfill, hand-applied via `DIRECT_URL` |
| `src/core/entities/distribution.ts` | Modified | `InventoryStockItem` (+`branchId`), lot + transfer entities, allocation entity |
| `src/core/ports/distribution-repository.port.ts` | Modified | Lot/branch/transfer methods, lot-aware inputs, branch-scoped cost reads |
| `src/core/schemas/distribution.ts` | Modified | New Zod contracts (ledger filter already accepts `TRANSFER_*` at `:294-303`) |
| `src/infrastructure/db/repositories/prisma-distribution.repository.ts` | Modified | All 7 write paths, `recordMovement` + `MovementParams`, `getInventory`, `registerSale` merge, daily close, `firstBranchOfTenant` |
| `src/app/api/distribution/**` | Added / Modified | New `branches/`, `inventory/lots/`, `transfers/` routes |
| `src/modules/distribution/components/**` | Modified | `InventoryView`, `SalesPOSView`, `InventoryCountView`, `InventoryMovementsView`, `DistributionModuleApp`; new branch + transfer views |
| `src/modules/distribution/lib/roles.ts` | Modified | Only if Q2 adds a role (`ALL_TABS` / `RESTRICTED_TABS`) |
| `messages/{es,en}.json` | Modified | Every new key in both locales |
| 4 repo suites + 4 route suites | Modified | New Prisma model mock surface (Prisma is mocked at the db layer with hand-built tx objects) |

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **S3 is a one-way door.** `Lot` owning stock means migrating existing stock is the most expensive and least reversible slice; a second data migration on live stock may be needed if the model changes after the backfill. | Med | **Critical** | Gate S3 on Q1. Additive-only `migration.sql`, hand-applied, DB backup before applying, one synthetic implicit lot per existing item × branch so every pre-existing row lands somewhere valid. |
| **R2** | **The costing defect and the multi-branch read defects are read-derived, not runtime-proven.** The tenant-wide `Item.cost` write (`:940-943`), the `getInventory` duplicate rows (`:491`), and the arbitrary open-session selection (`:1961-1963`) were established by reading source in this and the explore phase. **No live-database query was run** to confirm them at runtime, by explicit constraint. | High (statically) | High | Treat as high-confidence static findings, not proven runtime behavior. S1 is the verification vehicle: it fixes the read path and its tests will empirically confirm the duplicate-row and selection defects before any branch exists in production. |
| **R3** | FEFO's N sequential guarded decrements replace one atomic `updateMany`, moving the failure mode mid-loop. | Med | High | Keep `$transaction` all-or-nothing; no partial work may escape; S5 ships a concurrency test on the sale path. |
| **R4** | 5 of 10 slices exceed the 400-line review budget (S0, S2, S4, S5, S7, S8, S9 borderline-or-over). | **High** | Med | Resolve `delivery_strategy` to chained before S0; the named S*a/S*b splits above. |
| **R5** | i18n parity: every new key must land in two locales, and `messages/*.json` are 732 lines each. | **High** | Low | Same commit as the view, per `apply-progress.md:213` (6/6 batches did this). |
| **R6** | `prisma migrate dev` is run unsupervised and wipes the DB — the DB has **no `_PrismaMigrations` table** (`DATABASE.md:18-29`). | Low | **Critical** | Already forbidden by `DATABASE.md:23`; additive-only hand-applied DDL only, backup first. |
| **R7** | `prisma generate` hits `EPERM` on `query_engine-windows.dll.node` while `next dev` runs (occurred in batch 4). | **High** | Low | Stop the dev tree before generating (`apply-progress.md:153`). |
| **R8** | A new Prisma model adds hand-built tx mock surface to 8 test suites. | High | Med | Fold mock updates into the slice that introduces the model (S3), not into later slices. |
| **R9** | Transfer costing changes reported margins (Q5), and daily close remains tenant-wide (`:2593-2612`), so a transfer's stock effect is invisible in reports. | Med | Med | Move at source lot cost, no re-average; branch-scope the daily close as a follow-up. |

## Rollback Plan

Revert any slice's PR independently; the chain is ordered so each slice is revertible alone. **S3 is the exception**: reverting it means a second data migration on live stock, so S3 requires a verified DB backup and a rehearsed reversal script **before** it is applied. S0-S2 revert cleanly (additive schema plus code). Never `migrate dev` unsupervised.

## Dependencies

No external dependencies; no new libraries. `prisma generate` after each schema change. S3 depends on Q1 being answered.

## Success Criteria

- [ ] 1. A tenant can create, list, and edit branches; no branch is created implicitly outside tenant provisioning.
- [ ] 2. `getInventory` returns one row per item with an explicit `branchId`; the velocity ranking has no duplicates.
- [ ] 3. Sale branch resolution is deterministic and enforced by a DB constraint, not app-code luck.
- [ ] 4. Lot control is opt-in per product; non-lot products keep today's behavior with no lot UI or lot rows beyond their single implicit lot.
- [ ] 5. A sale line drawing 5 from lot A and 7 from lot B persists both allocations and writes one `SALE` kardex row per lot.
- [ ] 6. Every stock mutation writes its ledger row through `recordMovement` — the two direct bypasses (`:2793`, `:2875`) are gone.
- [ ] 7. A return restores the unit to its original lot.
- [ ] 8. Cost is branch-scoped: receiving into branch B does not change branch A's cost; all five `Item.cost` consumers read the branch-scoped value.
- [ ] 9. A transfer moves stock with `TRANSFER_OUT`/`TRANSFER_IN` at source lot cost, and a cancelled transfer reverses the source stock with a balancing ledger row.
- [ ] 10. Every new i18n key exists in both locales; no `any`; `tenantId` derived from the session only and never accepted from the client; `SaleItem` still carries no `tenantId` and lot aggregates reach it through `sale`.
- [ ] 11. Migrations are additive and hand-applied; no `migrate dev`; lint, typecheck, and build clean.
