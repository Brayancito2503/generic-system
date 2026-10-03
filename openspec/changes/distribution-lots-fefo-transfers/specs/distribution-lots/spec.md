# Distribution Lots Specification

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

Lot identity, lifecycle, and stock ownership: opt-in per-product lot control, multiple simultaneous lots per item and branch, and per-lot quantities exact to two decimals in the item's own sale unit.

## Requirements

### Requirement: Lot control is opt-in per product, and every item and branch has at least one lot

A per-product flag MUST turn lot control on. A product with lot control off MUST hold its quantity in exactly one implicit lot that has no operator code and no expiry date, and its sale, receipt, adjustment, and count flows MUST behave exactly as today. A product with lot control on MAY have several lots at the same branch at the same time. The lot MUST be the only owner of a sellable quantity; the per item and branch stock record MUST NOT keep a second, independently writable quantity, and it MUST retain the minimum-alert policy and its per item and branch identity. At most one lot may exist per tenant, item, branch, and operator code; the lot without a code is unique per item and branch.

#### Scenario: Product without lot control is unchanged

- GIVEN a product whose lot control is off
- WHEN stock is received, sold, adjusted, and counted
- THEN the quantity lives in exactly one implicit lot with no code and no expiry date
- AND every flow behaves exactly as it does today, with no lot choice anywhere

#### Scenario: Several simultaneous lots

- GIVEN a lot-controlled product at one branch
- WHEN lot A (expiry 2026-10-01, 5) and lot B (expiry 2027-01-01, 20) exist
- THEN both exist and their quantities are reported separately per lot

#### Scenario: Duplicate lot code rejected

- GIVEN a lot with code `L-1` for an item at a branch
- WHEN a second lot with the same code is created for that same item and branch
- THEN the server responds 409 and no second lot persists

#### Scenario: One quantity owner

- GIVEN any stock change on a lot
- WHEN the change is applied
- THEN the lot quantity moves by the same signed amount written to the ledger
- AND the sum of an item's lots at a branch always equals that item's reported quantity at that branch

#### Scenario: Cross-tenant lot reference

- GIVEN a session for tenant A
- WHEN a request references a lot owned by tenant B by id
- THEN the read resolves as not found, and a lot id is never accepted as a tenant discriminator

### Requirement: Lot lifecycle is creation with an identity, an expiry, and a sellable status

A lot MUST be created for a tenant-owned item at a tenant-owned branch, with an optional operator code, optional manufacture and expiry dates, its own unit cost, and a non-negative quantity. Lots MUST be read scoped to a tenant, an item, and a branch. A lot MUST be able to leave the sellable set independently of its expiry (quarantine) and to return to it; a lot that is not sellable MUST NOT be a sale candidate. A lot referenced by ledger rows MUST NOT be deleted, because the audit trail must stay readable. The exact sellable-status vocabulary is a design decision, not a behavior fixed here.

#### Scenario: Create a lot

- GIVEN a lot-controlled product at branch A
- WHEN a lot is created with a code, a manufacture date, an expiry date, a unit cost, and a quantity
- THEN it persists for that item and branch and is immediately a sale candidate

#### Scenario: Cross-tenant lot creation rejected

- GIVEN a session for tenant A
- WHEN a lot is created against an item or branch owned by tenant B
- THEN the server responds not found and no lot persists for either tenant

#### Scenario: Non-sellable lot is not a candidate

- GIVEN a lot whose status marks it not sellable while its expiry is still in the future
- WHEN a sale allocates that product
- THEN that lot is not a candidate and no stock is drawn from it

#### Scenario: Lot referenced by the ledger is not deleted

- GIVEN a lot that has ledger rows
- WHEN a delete is requested
- THEN the delete is refused and every historical ledger row stays readable

### Requirement: Lot quantities are exact to two decimals in the item's own sale unit

Every lot quantity MUST be stored and compared as a fixed two-decimal value, and no floating-point comparison may decide whether stock is sufficient. No unit conversion exists: a weighed product's lots are denominated in its own sale unit and a piece-counted product's in units, exactly as stock already is.

#### Scenario: Fractional draw on a weighed lot

- GIVEN a lot of a product sold by weight holding 10.00 kg
- WHEN 2.50 kg is sold from it
- THEN the lot holds exactly 7.50 kg

#### Scenario: No unit conversion

- GIVEN a product whose sale unit is KILOGRAMO
- WHEN its lot quantity is read
- THEN the quantity is expressed in kilograms, with no conversion to any other unit

#### Scenario: More than two decimals rejected

- GIVEN a lot quantity of 1.005
- WHEN it is submitted
- THEN the server responds 400 and no lot persists

#### Scenario: Exact-boundary sale succeeds

- GIVEN a lot holding exactly 0.30
- WHEN 0.30 is sold from it
- THEN the sale succeeds and the lot holds exactly 0.00

## Boundary of this spec

The per-lot **ledger** contract — the lot reference and lot-code snapshot on every movement row, one row per lot, and the single ledger writer — is specified in the `distribution-inventory-ops` delta, which owns the kardex. The **allocation** of lots to a sale line is specified in the `distribution-fefo` spec.
