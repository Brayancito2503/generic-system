# Delta for Distribution Payments and Returns

**Capability**: `distribution-payments-returns`
**Change**: `distribution-lots-fefo-transfers`

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

The sale document keeps one line per requested product line, records each line's lot allocations, and restores a returned unit to the lot it actually came from.

## MODIFIED Requirements

### Requirement: Payment methods, credit sales, receivables, and returns

Sales MUST record payment method, paid amount, and balance (credit sales create a receivable). Returns/voids MUST restore stock and be audited, and every returned unit MUST return to the exact lot it was sold from, read from the sale line's stored allocations, so the expiry timeline of that lot is not silently rewritten. A return MUST write one return ledger row per restored lot at that lot's original cost, and the over-return guard MUST be evaluated per sale line and per allocation when a line drew from several lots, cumulative across prior returns. All money math MUST be server-side.

(Previously: a return restored the quantity to the sale branch's single stock row with no lot awareness, wrote one return row per requested product line, and snapshotted the sale line's cost.)

#### Scenario: Cash sale with tender

- GIVEN a cart and a cash payment
- WHEN the sale is registered
- THEN paid/change are computed server-side and the receivable is zero

#### Scenario: Credit sale

- GIVEN a cart paid partially or not at all
- WHEN the sale is registered
- THEN a balance/ receivable is persisted and tracked

#### Scenario: Return restores stock

- GIVEN a completed sale with items
- WHEN a return/void is processed for a sold quantity
- THEN stock is restored and the return is recorded against the sale

#### Scenario: Return over quantity

- GIVEN a sale with N units of an item
- WHEN a return exceeds N
- THEN the server rejects with 409 and stock is unchanged

#### Scenario: Returned unit goes back to its own lot

- GIVEN a sale line that drew 5 units from lot A and 7 from lot B
- WHEN 5 units of that line are returned
- THEN lot A alone is restored by 5, lot B is untouched, and one return ledger row records lot A at lot A's original cost

#### Scenario: Over-return measured per allocation

- GIVEN a sale line that drew 5 units from lot A and 7 from lot B
- WHEN a return of 9 units is submitted
- THEN the server responds 409 and no lot and no ledger row changed

#### Scenario: Returning a product not on the sale

- GIVEN a completed sale
- WHEN a return names a product the sale never contained
- THEN the server responds 400 and nothing is written

## ADDED Requirements

### Requirement: A sale line is never collapsed, and it owns its lot allocations

Two request lines that reference the same product MUST persist as two sale lines; the sale path MUST NOT merge them. Each sale line MUST reference its lot allocations, and its recorded cost MUST be the quantity-weighted cost of those allocations so margins stay accurate after later cost changes. A sale line MUST NOT gain a tenant column, and tenant-scoped reads of a line, including the sales-velocity aggregate, MUST reach it through its sale. A product that does not belong to the session tenant MUST be rejected before any stock or sale row is written, and a client-supplied `tenantId` MUST be ignored.

#### Scenario: Duplicate product lines persist separately

- GIVEN a request with two lines of the same product, 2 and 3 units
- WHEN the sale is registered
- THEN the sale persists two lines with their own allocations and the reported line count matches the request

#### Scenario: Line cost is the weighted allocation cost

- GIVEN a line of 12 that drew 5 units at 2.00 and 7 units at 4.00
- WHEN the sale is stored
- THEN the line's cost is 3.17

#### Scenario: Non-lot product gets one implicit allocation

- GIVEN a product without lot control
- WHEN it is sold
- THEN the line carries a single allocation against that branch's implicit lot, and the flow is otherwise unchanged

#### Scenario: Cross-tenant product rejected

- GIVEN a session for tenant A
- WHEN the request references a product owned by tenant B
- THEN the server responds 400, nothing is written, and no tenant B data is read

## Open Questions

- Whether an operator may request a specific lot at the point of sale, rather than FEFO choosing it, is still unanswered and is carried in the `distribution-fefo` spec. This delta specifies the automatic case, under which the request stays one product plus a quantity per line.
