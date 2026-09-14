# Distribution Tax Invoicing Specification

## Purpose

Server-persisted CAI/NCF fiscal configuration and continuous invoice numbering derived from the tenant's `SaleCounter`, replacing the fake local-state form and hardcoded fiscal sequence.

## Requirements

### Requirement: Server-persisted CAI configuration and fiscal sequence

The CAI/NCF configuration form MUST persist to the server (replacing the fake local state and hardcoded sequence `000-001-01-00001249`). Invoice numbering MUST derive from the tenant's `SaleCounter`, incremented in the sale transaction, honoring `@@unique([tenantId, invoiceNumber])`.

#### Scenario: CAI saved server-side

- GIVEN a TENANT_ADMIN editing the fiscal config
- WHEN the form is submitted with a valid CAI/NCF payload
- THEN the config persists and is reloaded on next visit

#### Scenario: Fiscal invoice numbering

- GIVEN a sale registered after seed
- WHEN the invoice number is generated
- THEN it is the next `SaleCounter` value formatted per the existing pattern and unique per tenant

#### Scenario: Invalid fiscal config

- GIVEN a CAI payload with invalid format/range
- WHEN submitted
- THEN the server rejects with 400 and a validation message; nothing persists