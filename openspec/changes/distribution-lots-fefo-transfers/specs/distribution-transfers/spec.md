# Distribution Transfers Specification

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

An inter-branch transfer document with an explicit state machine, lot-level stock movement, `TRANSFER_OUT` / `TRANSFER_IN` ledger rows at the source lot's cost, and a cancel-with-reversal path for transfers that are never received.

## Requirements

### Requirement: A transfer is a tenant-owned document with an explicit state machine

A transfer MUST be a persisted document that names a source branch, a destination branch, and its lines. Its state MUST be one of pending, dispatched, received, or cancelled. The only valid transitions MUST be dispatch from pending, receive from dispatched, and cancel from pending or dispatched; received and cancelled are terminal. Any other transition MUST return 409 and change nothing. A transfer MUST be created, read, and mutated only for the session tenant, and a transfer id owned by another tenant MUST resolve as not found (404).

#### Scenario: Create a transfer

- GIVEN a tenant with branches A and B and stock of product P at branch A
- WHEN a transfer from A to B for P is created
- THEN the transfer persists in the pending state with its lines and both branches of the tenant

#### Scenario: Invalid transitions rejected

- GIVEN a pending transfer
- WHEN a receipt is submitted before dispatch
- THEN the server responds 409 and the transfer stays pending with no stock and no ledger change

#### Scenario: Cross-tenant transfer reference

- GIVEN a session for tenant A
- WHEN a request references a transfer owned by tenant B
- THEN the server responds 404 and writes nothing

#### Scenario: Invalid input rejected

- GIVEN a transfer with no lines, a non-positive quantity, source equal to destination, or a product or lot not held at the source branch
- WHEN it is submitted
- THEN the server responds 400, no transfer persists, and no stock moves

### Requirement: Dispatch moves stock out of the source branch and is recorded per lot

Dispatch MUST decrement each source lot with a guard that never allows a lot to go negative; when the source cannot cover a line the server MUST respond 409, the transfer MUST stay pending, and nothing may be written. A successful dispatch MUST move the transfer to dispatched in the same transaction as one `TRANSFER_OUT` ledger row per lot, signed negative, at that lot's unit cost, referencing the transfer. Stock in transit MUST be derived from the lines of dispatched transfers and MUST NOT be stored as a separate quantity, so no phantom balance can drift from the transfer document.

#### Scenario: Dispatch a transfer

- GIVEN a pending transfer of 5 units from lot L at branch A, lot cost 3.50
- WHEN it is dispatched
- THEN lot L holds 5 fewer units, the transfer is dispatched, and one `TRANSFER_OUT` row of -5 at cost 3.50 references the transfer

#### Scenario: Dispatch beyond available stock

- GIVEN a pending transfer of 12 units while lot L holds 5
- WHEN it is dispatched
- THEN the server responds 409, the transfer stays pending, and no stock and no ledger row changed

#### Scenario: In-transit quantity is derived

- GIVEN a dispatched transfer not yet received
- WHEN the in-transit quantity for that item is reported
- THEN it equals the sum of the dispatched transfer's line quantities, with no separately stored figure

### Requirement: Receipt moves stock into the destination branch at the same cost and never re-prices it

Receipt MUST increment the destination lot and MUST create that lot when the destination branch has no lot for the product, because a transfer document already proves the source lot exists. A successful receipt MUST move the transfer to received in the same transaction as one `TRANSFER_IN` ledger row per lot, signed positive, at the same unit cost the stock left with, and the row MUST reference the transfer. Receipt MUST NOT re-price or re-average the destination branch's cost: a branch-to-branch move is not a purchase. Receiving a transfer that is not dispatched MUST return 409, and receiving the same transfer twice MUST return 409.

#### Scenario: Receipt creates the destination lot

- GIVEN a dispatched transfer of product P to branch B, where branch B has no lot for P
- WHEN the transfer is received
- THEN the destination lot is created and holds the transferred quantity, and one `TRANSFER_IN` row records it

#### Scenario: Receipt keeps the source cost

- GIVEN stock dispatched at unit cost 3.50
- WHEN the destination branch receives it
- THEN the destination cost is unchanged by the receipt and the `TRANSFER_IN` row carries 3.50

#### Scenario: Receiving twice

- GIVEN a received transfer
- WHEN a second receipt arrives
- THEN the server responds 409 and no stock moves

### Requirement: A never-received transfer is closed by an explicit cancel that reverses the stock

A transfer that is dispatched and never received MUST be closed by an explicit cancel. Cancelling a dispatched transfer MUST restore each source lot's quantity and MUST write a reversing ledger row for every lot it had moved, so the kardex balances. Cancelling a pending transfer MUST write no stock change and no ledger row. Cancelled and received are terminal. **No timer may mutate a transfer**: the system MUST NOT auto-reverse, auto-receive, or otherwise change a transfer's stock on a timeout, because a timeout that fires after the destination already received double-counts the stock. Notifying an operator that a transfer has been waiting is acceptable; mutating it is not.

#### Scenario: Cancel a dispatched transfer

- GIVEN a dispatched transfer of 5 units from lot L, not yet received
- WHEN it is cancelled
- THEN lot L is restored by 5 units and a reversing ledger row balances the earlier `TRANSFER_OUT`

#### Scenario: Cancel a pending transfer

- GIVEN a pending transfer
- WHEN it is cancelled
- THEN no stock moves and no ledger row is written

#### Scenario: No timeout mutation

- GIVEN a dispatched transfer that is never received and that stays pending past any operational deadline
- WHEN time passes with no operator action
- THEN no stock and no ledger row changes on its own; only an explicit cancel or receipt may move stock

#### Scenario: Cancelled is terminal

- GIVEN a cancelled transfer
- WHEN a dispatch or a receipt is submitted
- THEN the server responds 409 and nothing changes

## Open Questions

- **Who may dispatch and who may receive** is still unanswered. Reusing the tenant-admin session role for dispatch and allowing the destination branch's cashier to receive costs no new role; a dedicated warehouse role would add a new access profile, a session mapping, and role-gated navigation. This spec requires only that every transfer mutation is session-authenticated and tenant-scoped; the role split is deliberately not fixed here.
- A transfer carries no cash dimension: cash movements belong to a session and carry no item reference, so money moved with goods is out of scope.
