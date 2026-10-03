# Distribution Branches Specification

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

Tenant-scoped branch create, list, and edit, plus the branch a cash session operates on. Today every tenant is born with exactly one branch at provisioning and cannot create another through the product, so multi-branch behavior is undemonstrable.

## Requirements

### Requirement: Branches are tenant-owned and managed only through the session

A branch MUST be created, listed, and edited only for the session's tenant. The tenant MUST be derived server-side; a client-supplied `tenantId` MUST be ignored. Listing MUST return only the session tenant's branches. A branch id owned by another tenant MUST resolve as not found (404), never as that branch. Branch deletion is NOT part of this change: no delete operation is exposed, so a branch that carries purchase orders or cash sessions keeps its history.

#### Scenario: Create a branch

- GIVEN an authenticated tenant session
- WHEN a branch is created with a name
- THEN the branch persists for the session tenant and appears in the branch list
- AND it is created explicitly; no branch is created implicitly outside tenant provisioning

#### Scenario: Cross-tenant branch reference

- GIVEN a session for tenant A
- WHEN a request references a branch id owned by tenant B
- THEN the server responds 404 and writes nothing

#### Scenario: Client-supplied tenant is ignored

- GIVEN a create or edit request whose body includes `tenantId`
- WHEN the request is processed
- THEN the session tenant governs and the submitted value has no effect

#### Scenario: Edit a branch

- GIVEN a branch owned by the tenant
- WHEN its name or address is edited
- THEN only the submitted fields change; omitted fields stay untouched and a null address clears it

#### Scenario: Branch deletion is not exposed

- GIVEN a branch that has purchase orders or cash sessions
- WHEN a delete is attempted
- THEN no branch delete operation exists and the branch with its history remains

### Requirement: The branch a cash session operates on is resolved server-side and tenant-guarded

A cash session's branch MUST be derived server-side from the authenticated user's `Employee` record, and a client-supplied branch id MUST NOT select the branch. A branch that does not belong to the session tenant MUST be rejected without creating a session. When no branch can be derived from an `Employee` record, the session MUST fall back to the tenant's branch when the tenant has exactly one, which is today's behavior for single-branch tenants; a tenant with two or more branches and no derivable branch MUST NOT open a session, because silently taking the earliest-created branch is exactly the wrong-branch risk this change removes. At most one OPEN session per branch MUST be allowed: a second open session for the same branch MUST fail with 409, while another branch of the same tenant MUST be able to hold its own open session. The database MUST enforce that uniqueness with a partial unique index on `(tenantId, branchId)` where `status = 'OPEN'`, so a concurrent open cannot slip past an application-only check.

#### Scenario: Session opened at the employee's branch

- GIVEN a tenant with branches A and B
- WHEN a session is opened by a user whose `Employee` record names branch B
- THEN the session belongs to branch B and its branch is the only branch it can sell for

#### Scenario: Client-supplied branch does not select the branch

- GIVEN a user whose `Employee` record names branch B
- WHEN an open request's body names branch A
- THEN the session belongs to branch B and the submitted branch id has no effect

#### Scenario: Each branch holds its own open session

- GIVEN branch A already has an OPEN session
- WHEN a session is opened by a user whose `Employee` record names branch B
- THEN branch B receives its own OPEN session and branch A's session is untouched

#### Scenario: Second open session on the same branch

- GIVEN branch B already has an OPEN session
- WHEN another open request resolves to branch B
- THEN the server responds 409 and creates no second session for branch B

#### Scenario: Cross-tenant branch on session open

- GIVEN a session for tenant A
- WHEN the authenticated user's `Employee` record names a branch owned by tenant B
- THEN the server responds not found, no session is created, and no branch of tenant B is read

#### Scenario: No employee record falls back to the tenant's only branch

- GIVEN a tenant with exactly one branch A and a user with no `Employee` record
- WHEN a session is opened
- THEN the session belongs to branch A, exactly as today

#### Scenario: No employee record and several branches is rejected

- GIVEN a tenant with branches A and B and a user with no `Employee` record
- WHEN a session is opened
- THEN the server refuses to open a session and creates none, rather than choosing a branch on the user's behalf

### Requirement: A new branch inherits no stock

Stock MUST never be shared between branches implicitly. A branch created after products exist MUST start with zero stock for every existing product, and every stock read MUST be explicit about the branch it reads. When a stock-writing operation names no branch, the tenant's earliest branch remains the documented fallback; that fallback MUST NOT be read as inheritance between branches.

#### Scenario: New branch starts empty

- GIVEN a tenant with product P stocked at branch A
- WHEN branch B is created
- THEN P's quantity at branch B is zero and branch A's quantity is unchanged

#### Scenario: Branch-scoped read

- GIVEN product P with 10 units at branch A and 5 at branch B
- WHEN the stock of branch B is read
- THEN the result is 5, never 15

#### Scenario: Unnamed stock write keeps the earliest-branch fallback

- GIVEN a product created with no branch named
- WHEN it is created with opening stock
- THEN the opening stock lands in the tenant's earliest branch, exactly as today

## Open Questions

- **Decided.** One OPEN session per **branch**, not per tenant. The branch is derived from the authenticated user's `Employee` record and never from the client, and uniqueness is enforced by a partial unique index on `(tenantId, branchId)` where `status = 'OPEN'`. A user with no derivable branch still opens a register when the tenant has exactly one branch, and is refused when it has two or more. The sale-side consequence is specified in the `distribution-cash-register` delta.
- **Still open.** `openCashSessionSchema` also accepts a client-supplied `employeeId` (`src/core/schemas/distribution.ts:365`), which `openCashSession` writes to the session as-is (`prisma-distribution.repository.ts:1477`). Now that the branch comes from the authenticated user, whether that field is dropped or must match the session user is not decided here.
