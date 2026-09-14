# Distribution Customers Specification

## Purpose

Customer create and edit with tenant-scoped, Zod-validated endpoints (GET search only today).

## Requirements

### Requirement: Customer create and edit

Customers MUST support create and edit (today GET search only), validated by Zod, tenant-scoped.

#### Scenario: Create customer

- GIVEN a STAFF session
- WHEN a valid customer payload is submitted
- THEN the customer is created and appears in search

#### Scenario: Edit customer

- GIVEN an existing customer
- WHEN a valid edit is submitted
- THEN fields update and search reflects the change

#### Scenario: Invalid payload

- GIVEN a customer payload missing required fields
- WHEN submitted
- THEN the server responds 400 with a validation message