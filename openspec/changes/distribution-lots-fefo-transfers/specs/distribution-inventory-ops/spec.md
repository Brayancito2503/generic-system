# Delta for Distribution Inventory

**Capability**: `distribution-inventory-ops`
**Change**: `distribution-lots-fefo-transfers`

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

Stock ownership moves to the lot, the product list becomes branch-explicit and lot-aggregated, the kardex gains a lot dimension, and cost becomes branch-scoped.

## MODIFIED Requirements

### Requirement: Inventory delete, multi-branch updates, and value guards

Inventory MUST support deletion, `updateInventoryItem` MUST update only the targeted branch (today it touches only `inventory[0]`), and cost/price/stock MUST reject negative values. The sellable quantity MUST be owned by lots: an update, adjustment, or count targets a specific lot inside one item and branch, and the per item and branch record MUST retain only the minimum-alert policy and its per item and branch identity, never a second independently writable quantity.

(Previously: one requirement covered delete, multi-branch updates, and negative-value guards while stock lived in a single per item and branch row with no lot dimension.)

#### Scenario: Multi-branch stock update

- GIVEN an item with stock in branches A and B
- WHEN stock is updated for branch B
- THEN only branch B changes; branch A is untouched

#### Scenario: Delete item

- GIVEN an item with no persisted transaction references
- WHEN delete is requested
- THEN the item is removed
- AND delete of an item referenced by sales/POs returns 409

#### Scenario: Negative values rejected

- GIVEN an item create/update with negative cost, price, or stock
- WHEN submitted
- THEN the server responds 400 and no change persists

#### Scenario: A lot is the quantity owner

- GIVEN an item whose stock sits in two lots at one branch
- WHEN one lot is adjusted
- THEN only that lot's quantity changes and the other lot is untouched

## ADDED Requirements

### Requirement: The product list is branch-explicit, lot-aggregated, and free of duplicate rows

The product list MUST return exactly one row per item and branch, each row naming its branch explicitly, and the item's reported quantity MUST equal the sum of that item's lots at that branch. Two branches holding the same product MUST NOT produce two rows that share an item identity, and the sales-velocity ranking MUST NOT rank the same product twice. A low-stock product MUST be counted once per item and branch, never once per lot. Every list read MUST be tenant-scoped and MUST NOT read another tenant's stock.

#### Scenario: Same product in two branches

- GIVEN product P with 10 units at branch A and 5 at branch B
- WHEN the product list is read
- THEN it returns two rows for P, one per branch, reporting 10 and 5, each carrying its own branch

#### Scenario: Velocity ranking has no duplicates

- GIVEN product P stocked at two branches and having sold units in the last 30 days
- WHEN the list is ranked by velocity
- THEN P appears once per branch and its aggregate sales figure is not counted twice

#### Scenario: Multi-lot product counts once as low stock

- GIVEN product P with 3 units across two lots at one branch and a minimum alert of 5
- WHEN the low-stock count is computed
- THEN P contributes exactly one, not two

#### Scenario: Cross-tenant stock is never read

- GIVEN a session for tenant A
- WHEN the product list is read
- THEN only tenant A's items and lots appear, whatever branch or item id the request carries

### Requirement: Every stock movement writes one kardex row per lot through a single writer

Every stock change MUST write its ledger row through the single ledger writer, and no stock path may create a ledger row directly; the two direct creations that exist today in the adjustment and physical-count paths MUST be folded into that writer. Every row MUST carry the lot it moved and a snapshot of that lot's operator code at the moment of the movement, so a later code change cannot rewrite history. Where one operation touches several lots, one row per lot MUST be written. The existing sign convention MUST be preserved: sales and losses negative, receipts, returns, and surplus corrections positive, opening stock signed as given. Row counts multiplying per lot MUST NOT change shrinkage reporting, because shrinkage reads only adjustment rows.

#### Scenario: Split sale writes one row per lot

- GIVEN a sale line that draws 5 units from lot A and 7 from lot B
- WHEN the ledger rows for the sale are listed
- THEN two negative sale rows exist, one per lot, each carrying its lot reference and its code snapshot

#### Scenario: Lot code snapshot survives a later edit

- GIVEN a ledger row written while lot L had code `L-1`
- WHEN lot L's code is later changed
- THEN the historical row still shows `L-1`

#### Scenario: No direct ledger writer remains

- GIVEN any stock mutation, including an adjustment and a physical-count difference
- WHEN it runs
- THEN its ledger row is written through the same single writer as every other mutation

#### Scenario: Shrinkage is unchanged by lots

- GIVEN a day with negative adjustment rows and with sale rows
- WHEN the day's shrinkage and the merma summary are computed
- THEN only adjustment rows contribute, exactly as before the lot dimension existed

### Requirement: Adjustments and physical counts target a lot

An adjustment MUST name the branch and the lot it changes, MUST preserve the sign-versus-reason convention, and MUST reject a loss that would push a lot below zero with 409 while writing nothing. A physical count MUST compute each line's difference against that lot's book quantity, MUST skip zero differences entirely, and MUST record a surplus or shrinkage adjustment per changed lot. A count or adjustment against a lot of another tenant MUST resolve as not found. Where the product has no lot control, the single implicit lot is the target and the behavior is unchanged.

#### Scenario: Write off an expired lot

- GIVEN a lot holding 10 units that expired
- WHEN an adjustment of -10 is submitted with the expiry loss reason
- THEN the lot holds 0 and one negative adjustment row records the write-off at that lot's cost

#### Scenario: Loss beyond lot stock rejected

- GIVEN a lot holding 3 units
- WHEN an adjustment of -5 is submitted
- THEN the server responds 409 and the lot is unchanged

#### Scenario: Physical count per lot

- GIVEN a lot whose book quantity is 10 and a counted quantity of 8
- WHEN a count batch is submitted
- THEN the lot holds 8 and one shrinkage adjustment of -2 is recorded

#### Scenario: Counted quantity equal to book writes nothing

- GIVEN a lot whose book quantity is 10 and a counted quantity of 10
- WHEN a count batch is submitted
- THEN no adjustment row and no ledger row are written for that lot

#### Scenario: Cross-tenant lot in a count

- GIVEN a session for tenant A
- WHEN a count batch names a lot owned by tenant B
- THEN the server responds not found and writes nothing for either tenant

### Requirement: Cost is scoped per item and branch, fed by real lot cost

A weighted average cost MUST be kept per item and branch, computed from that branch's own stock and fed by the real cost of the lots received, with two-decimal rounding preserved. The tenant-wide product cost MUST NOT receive a branch-derived average: receiving into one branch MUST NOT change another branch's reported cost or margin. A lot-controlled product's costing source of truth is its lot cost, not the tenant-wide product cost. Every existing item and branch pair MUST be seeded with a branch-scoped cost at cutover so no tenant's reported margin shifts on the day the change lands, and every cost-snapshot consumer — the sale line, the daily close line cost, the adjustment snapshot, the return snapshot, and the shrinkage total — MUST read the branch-scoped or lot-level value.

#### Scenario: Receiving into branch B leaves branch A's cost alone

- GIVEN product P with cost 2.00 at branch A and 10 units there
- WHEN 10 units are received into branch B at unit cost 5.00
- THEN branch B's weighted cost becomes 5.00 and branch A's stays 2.00

#### Scenario: First arrival adopts the lot cost

- GIVEN a branch with no stock of product P
- WHEN 4 units are received into a lot at unit cost 7.25
- THEN that branch's weighted cost becomes 7.25

#### Scenario: Weighted average rounds to two decimals

- GIVEN a branch holding 3 units at 2.00
- WHEN 3 units are received at 3.00
- THEN the branch's weighted cost is exactly 2.50

#### Scenario: Cutover seeds existing cost

- GIVEN a tenant that already sells product P at a single tenant-wide cost before this change
- WHEN the change is applied
- THEN every existing item and branch pair carries a branch-scoped cost equal to the cost it was reporting, and no reported margin changes on cutover day

## Open Questions

- The daily close report is still tenant-wide and does not scope by branch, so a transfer's stock effect stays invisible in that report. Branch-scoping it is a natural follow-up and is not part of this change.
- The low-stock count on the dashboard is currently a scan of one row per item and branch. It is specified here as once per item and branch; whether it is filtered by branch at the UI level is a design decision.
