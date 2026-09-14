# Distribution Suppliers Specification

## Purpose

Supplier edit and deactivate, tenant-scoped and Zod-validated (GET/POST only today).

## Requirements

### Requirement: Supplier edit and deactivate

Suppliers MUST support edit and deactivate (GET/POST only today), Zod-validated and tenant-scoped.

#### Scenario: Edit supplier

- GIVEN an existing supplier
- WHEN a valid edit is submitted
- THEN the supplier record updates

#### Scenario: Deactivate supplier

- GIVEN an active supplier
- WHEN deactivated
- THEN it is excluded from new PO selection while existing POs remain intact

#### Scenario: Invalid payload

- GIVEN a supplier payload with invalid required fields
- WHEN submitted
- THEN the server responds 400