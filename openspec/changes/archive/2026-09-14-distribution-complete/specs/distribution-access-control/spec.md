# Distribution Access Control Specification

## Purpose

Role guards and Zod validation on every distribution route; config-management mutations are admin-only.

## Requirements

### Requirement: Role guards and Zod on all distribution routes

Every `api/distribution/**` route MUST run `requireTenantId` plus a role guard (`requireApiAuth`), and MUST validate inputs with Zod. Config-management routes (tax/CAI) MUST require TENANT_ADMIN; POS operational routes MAY allow STAFF.

#### Scenario: Admin-only config mutation

- GIVEN a STAFF session editing tax rates or CAI config
- WHEN the mutation is submitted
- THEN the server responds 403; TENANT_ADMIN succeeds

#### Scenario: Unauthenticated request

- GIVEN no session cookie
- WHEN any distribution route is called
- THEN the server responds 401

#### Scenario: Zod rejection

- GIVEN a malformed body on any distribution route
- WHEN processed
- THEN the server responds 400 with a validation message