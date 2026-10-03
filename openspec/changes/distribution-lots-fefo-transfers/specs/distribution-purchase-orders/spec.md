# Delta for Distribution Purchase Orders

**Capability**: `distribution-purchase-orders`
**Change**: `distribution-lots-fefo-transfers`

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

Purchase order creation and receiving, made lot-aware: a received line lands in a named lot with its own expiry and cost, writes one ledger row per lot, and re-averages the receiving branch's cost instead of the tenant-wide cost.

## MODIFIED Requirements

### Requirement: Purchase order create and receive workflow

POs MUST support creation and receiving. Receiving a PO MUST increase the stock of the order's branch and advance the PO status; quantities MUST be validated. For a product with lot control on, each received line MUST identify the lot it fills, with its own code, manufacture and expiry dates, unit cost, and quantity; a lot-controlled receive line MUST NOT be merged with another line of the same product, because two lines may be two different lots. Receiving MUST write one receipt ledger row per lot, each at the received unit cost, and MUST re-average the receiving branch's scoped cost only. For a product without lot control the receive behaves exactly as today, landing in that branch's single implicit lot. A receive into a branch that holds no stock record for the product MUST still be rejected with 400, exactly as today.

(Previously: receiving merged duplicate product lines into one quantity, wrote a single receipt row per product at the order-line cost, and wrote the resulting average back to the tenant-wide product cost.)

#### Scenario: Create PO

- GIVEN a valid supplier and items
- WHEN a PO is created
- THEN the PO persists in an open/received workflow state

#### Scenario: Receive PO adds stock

- GIVEN an open PO
- WHEN receiving is submitted with valid quantities
- THEN inventory stock increases and the PO status advances

#### Scenario: Over-receive rejected

- GIVEN a PO partially received
- WHEN a receive request exceeds the remaining PO quantity
- THEN the server rejects with 409 and stock is unchanged

#### Scenario: Cross-tenant PO

- GIVEN a request referencing another tenant's PO id
- WHEN the route resolves it
- THEN it returns 404 (tenant isolation)

#### Scenario: Receive into two lots of the same product

- GIVEN an open PO line for product P
- WHEN a receipt fills two lots, one expiring 2026-10-01 with 5 units and one expiring 2027-01-01 with 7 units
- THEN both lots are created and filled, and two receipt ledger rows are written, one per lot, each at its own received cost

#### Scenario: Receive re-averages only the receiving branch

- GIVEN product P costing 2.00 at branch A
- WHEN 10 units are received into branch B at unit cost 5.00
- THEN branch B's cost becomes 5.00 and branch A's stays 2.00

#### Scenario: Product without lot control is unchanged

- GIVEN an open PO for a product with lot control off
- WHEN it is received
- THEN the quantity lands in that branch's single implicit lot and one receipt row is written, exactly as today

## ADDED Requirements

### Requirement: A receipt is validated per line, not per merged product

Each received line MUST be validated on its own against the order's still-pending quantity for that product, and the over-receive guard MUST be evaluated per line rather than against a merged total. A line naming a product that is not on the order MUST be rejected with 400 and write nothing. A line whose quantity is not positive, or carries more than two decimals, MUST be rejected with 400. No line may be merged into another before validation, and no partial receipt may persist when any line is rejected.

#### Scenario: Over-receive detected on one line

- GIVEN a PO line for 10 units of product P with 8 already received
- WHEN a receipt asks for 3 units of P
- THEN the server responds 409 and no line of that receipt persists

#### Scenario: Product not on the order rejected

- GIVEN an open PO
- WHEN a receipt names a product that is not on the order
- THEN the server responds 400 and nothing is written

#### Scenario: Fractional received quantity accepted

- GIVEN a PO line for a product sold by weight
- WHEN a receipt of 10.50 is submitted
- THEN the receipt succeeds and the ledger records exactly 10.50

## Open Questions

- Receiving into a branch with no stock record for the product currently fails with 400. A transfer receipt creates the missing record instead, because the transfer document proves the source stock exists. Whether a purchase-order receipt should also create it is not decided here; this delta preserves today's rejection.
- Whether one order line may be split across several lots in a single receipt, or whether each received line is exactly one lot, is a design decision. This delta requires only that distinct lines are never merged.
