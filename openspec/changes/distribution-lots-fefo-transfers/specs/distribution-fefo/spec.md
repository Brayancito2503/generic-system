# Distribution FEFO Specification

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

First-Expired-First-Out allocation of a sale line across lots, the expired-lot candidate filter, and the persisted per-line allocation records. All behavior is server-derived; the operator never chooses a lot in this change.

## Requirements

### Requirement: FEFO candidate order is total and deterministic

Candidate lots for a sale line MUST be ordered by expiry date ascending, with lots that have no expiry date last, ties broken by the earliest-created lot and then by a stable identifier order. The order MUST be total, so the same line against the same lots always allocates the same way and an auditable ledger never disagrees with itself. Every quantity and date comparison MUST be exact; no floating-point comparison may decide the order or whether stock suffices.

#### Scenario: Earliest expiry first

- GIVEN lot A (expiry 2026-10-01, 5 units) and lot B (expiry 2027-01-01, 20 units)
- WHEN a line of 3 is sold
- THEN all 3 come from lot A

#### Scenario: Tied expiry dates

- GIVEN lots A and B both expiring 2026-10-01, A created first
- WHEN a line of 4 is sold
- THEN A supplies first and B supplies the remainder

#### Scenario: Lot without expiry is consumed last

- GIVEN lot A (expiry 2026-12-01, 5 units) and lot B with no expiry date (10 units)
- WHEN a line of 7 is sold
- THEN 5 come from lot A and 2 from lot B

#### Scenario: Same sale allocates the same way twice

- GIVEN identical lots and an identical line
- WHEN the sale is registered twice
- THEN both sales record the same lot order and the same per-lot quantities

#### Scenario: Weight-denominated line

- GIVEN a product sold by weight with lot A holding 10.00 kg and expiry 2026-10-01
- WHEN a line of 2.50 kg is sold
- THEN 2.50 kg come from lot A and lot A holds exactly 7.50 kg

### Requirement: A line cascades across lots and every draw is recorded

A line MUST take the lesser of its remaining quantity and the candidate lot's quantity, then continue with the next candidate until the line is covered or the candidates are exhausted. Every draw MUST persist as an allocation record that references the sale line and carries the drawn quantity and the lot's unit cost at that moment. The line's cost MUST be the quantity-weighted cost of its allocations. The sale line MUST NOT gain a tenant column; tenant-scoped reads reach a line through its sale.

#### Scenario: Split across two lots

- GIVEN lot A (5 units) and lot B (20 units)
- WHEN a line of 12 is sold
- THEN lot A supplies 5 and lot B supplies 7, and both allocations persist

#### Scenario: Weighted line cost

- GIVEN lot A (5 units at 2.00) and lot B (20 units at 4.00)
- WHEN a line of 12 is sold
- THEN the line's cost is the weighted cost of the two draws, that is `(5 × 2.00 + 7 × 4.00) / 12` = 3.17

#### Scenario: One lot covers the line

- GIVEN a single candidate lot holding 20 units
- WHEN a line of 7 is sold
- THEN exactly one allocation of 7 exists

#### Scenario: Exact boundary

- GIVEN a candidate lot holding exactly 5 units
- WHEN a line of 5 is sold
- THEN the sale succeeds and the lot holds exactly 0.00

### Requirement: Expired lots are excluded from candidates, and 409 happens only when every candidate is expired

An expired lot MUST NOT be a sale candidate, and expired stock MUST NOT be used as a fallback when unexpired stock is short. A sale MUST succeed whenever at least one unexpired candidate can cover the line. The server MUST return 409 only when every available candidate lot for that item and branch is expired, and that response MUST point the operator at a write-off, which the ledger already supports through its expiry and shrinkage adjustment reasons. A lot with no expiry date is always a candidate and is never treated as expired.

**Boundary implemented:** a lot is expired once its expiry date is the current business day **or earlier**, evaluated in the tenant's business day (America/Managua, the same timezone the daily close already uses). A lot expiring today is therefore already expired. Justification: the business has no resolution finer than a day, so a same-day window would let a sale at 23:50 dispatch goods nobody may legally sell at 09:00 the next morning, and the operator gets no chance to write them off in between.

#### Scenario: Mixed expired and valid lots still sell

- GIVEN lot A (expired yesterday, 10 units) and lot B (expiry 2027-01-01, 5 units)
- WHEN a line of 5 is sold
- THEN the sale succeeds entirely from lot B and lot A is untouched

#### Scenario: Every candidate expired returns 409

- GIVEN every lot of that item at that branch is expired
- WHEN the line is sold
- THEN the server responds 409, no stock changes, and the message points the operator at a write-off

#### Scenario: Expired stock is never a fallback

- GIVEN lot A (expired, 10 units) and lot B (expiry 2027-01-01, 2 units)
- WHEN a line of 5 is sold
- THEN the server responds 409 for insufficient candidate stock and lot A is not used

#### Scenario: Lot without expiry date is always a candidate

- GIVEN lot A (expired, 10 units) and lot B with no expiry date (10 units)
- WHEN a line of 4 is sold
- THEN the sale succeeds from lot B

#### Scenario: Expiring today is expired

- GIVEN a single lot whose expiry date is today in the tenant's business day
- WHEN a line is sold
- THEN the server responds 409 exactly as for any other expired lot

### Requirement: Sale lines are not collapsed, and a failed allocation leaves nothing behind

Two request lines that reference the same product MUST remain two persisted lines; the sale path MUST NOT merge them, because a merged line has no stable identity to hang its allocations on. When any line cannot be covered by its candidates, the whole sale MUST roll back: no stock change, no sale, no consumed invoice number, no ledger row, and no partial allocation may escape. A sale with no open cash session MUST be rejected before anything is read or written.

#### Scenario: Duplicate product lines stay separate

- GIVEN a request with two lines of the same product, 2 and 3 units
- WHEN the sale is registered
- THEN the sale persists two lines, each with its own allocations
- AND the reported line count matches the request

#### Scenario: Insufficient candidates roll the sale back

- GIVEN candidates covering 5 of a requested 12 units
- WHEN the sale is registered
- THEN the server responds 409, stock is unchanged, and no sale, invoice number, or ledger row is written

#### Scenario: No open cash session

- GIVEN no open cash session
- WHEN a sale is registered
- THEN the server responds 400 and writes nothing

### Requirement: Allocation is server-derived and tenant-scoped

The server MUST derive each line's allocations from the tenant's own lots for that item and the sale's branch. The tenant MUST come from the session and MUST NOT be accepted from the client, and a lot id MUST NOT be used as a tenant discriminator. A product or lot belonging to another tenant MUST be rejected before any stock is touched. The sale request contract in this change is one product plus a quantity per line; a client-supplied lot has no effect on allocation.

#### Scenario: Cross-tenant product rejected

- GIVEN a session for tenant A
- WHEN the request references a product owned by tenant B
- THEN the server responds 400, writes nothing, and never reads tenant B's lots

#### Scenario: Client-supplied tenant is ignored

- GIVEN a sale request whose body includes `tenantId`
- WHEN the request is processed
- THEN the session tenant governs and the submitted value has no effect

## Open Questions

- Whether an operator may **request** a specific lot, or FEFO is always automatic, is still unanswered. This spec covers the automatic case; a later increment may add a lot picker to the point-of-sale cart, which is additive and does not invalidate any behavior pinned here.
