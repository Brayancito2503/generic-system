# Distribution Purchase Orders Specification

## Purpose

Purchase order creation and receiving workflow that advances status and increases branch stock with validated quantities (GET list only today).

## Requirements

### Requirement: Purchase order create and receive workflow

POs MUST support creation and receiving (GET list only today). Receiving a PO MUST increase inventory stock for the tenant's branch and advance the PO status; quantities MUST be validated.

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