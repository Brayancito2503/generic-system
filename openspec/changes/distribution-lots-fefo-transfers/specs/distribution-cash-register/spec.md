# Delta for Distribution Cash Register

**Capability**: `distribution-cash-register`
**Change**: `distribution-lots-fefo-transfers`

> **Phase name.** This artifact belongs to change `distribution-lots-fefo-transfers`. It is NOT the onboarding "FASE 3" (`PLAN.md:88`) and NOT the distribution "Fase 3" cited at `prisma/schema.prisma:41-42` and `src/core/entities/distribution.ts:266-267`.

## Purpose

Server-side cash session close with one open session per branch and persisted movements, plus a session branch that is always derived from the authenticated user's `Employee` record and never selected by the client.

## MODIFIED Requirements

### Requirement: Server-side cash close with single open session

The close endpoint MUST compute totals and difference server-side from persisted movements plus the cashier's physical count; it MUST NOT trust client `expectedAmount`/`difference`. At most one OPEN session per branch MUST be allowed, enforced by a partial unique index on `(tenantId, branchId)` where `status = 'OPEN'`: opening a second session for a branch that already has an open one MUST fail with 409, while a different branch of the same tenant MUST be able to open its own. A session's branch MUST be derived server-side from the authenticated user's `Employee` record and MUST NOT be selected by a client-supplied branch id: a branch that does not belong to the session tenant MUST be rejected without creating a session, and when no branch can be derived the tenant's only branch is used, while a tenant with two or more branches and no derivable branch MUST NOT open a session. A sale MUST take its branch from the open session and MUST NOT accept a branch from the client, so a sale can only ever move stock in the branch the register is actually working in. A sale MUST resolve exactly one open session and MUST NOT choose among several open sessions with an unordered lookup, so that the branch a sale moves stock in stays unambiguous once a tenant can hold one open session per branch.

(Previously: the requirement covered only the honest close, the tenant-wide duplicate-open 409, and the tampered-client case; the session branch's tenant guard, the server-derived branch source, the per-branch uniqueness rule, and the sale's branch source were unspecified.)

#### Scenario: Honest close

- GIVEN an open cash session with persisted movements
- WHEN the cashier submits a physical count
- THEN the server computes expected total and difference and persists the close record

#### Scenario: Duplicate open session on the same branch

- GIVEN branch B already has an OPEN cash session
- WHEN a new open request arrives for a user whose `Employee` record names branch B
- THEN the server responds 409 and does not create a second session for branch B

#### Scenario: A second branch opens its own session

- GIVEN branch A already has an OPEN cash session
- WHEN a session is opened for a user whose `Employee` record names branch B
- THEN branch B's session is created and branch A's session is unchanged

#### Scenario: Tampered client values

- GIVEN a close request whose body claims a fabricated `expectedAmount`/`difference`
- WHEN the server closes the session
- THEN server-derived totals override the client values

#### Scenario: Session branch is tenant-guarded

- GIVEN a session for tenant A
- WHEN the authenticated user's `Employee` record names a branch owned by tenant B
- THEN the server responds not found and no session is created

#### Scenario: Sale branch comes from the session, not the client

- GIVEN an open session at branch B
- WHEN a sale request carries a branch of tenant A that is not B
- THEN the sale moves stock in branch B and the client's branch has no effect

#### Scenario: The sale's open session is selected deterministically

- GIVEN two OPEN sessions, at branch A and at branch B of the same tenant
- WHEN a sale is registered
- THEN the server resolves exactly one session rather than taking whichever row an unordered lookup returns, so the branch the sale moves stock in is unambiguous

## ADDED Requirements

### Requirement: Every cash-register route is session-authenticated and tenant-scoped

Opening, moving, and closing a session MUST require an authenticated session and MUST operate only on sessions owned by the session tenant. A session id owned by another tenant MUST resolve as not found and write nothing. A cash movement or close against a session that is not open MUST be rejected, and the totals reported by the register MUST stay derived from persisted rows.

#### Scenario: Unauthenticated request

- GIVEN no session cookie
- WHEN any cash-register route is called
- THEN the server responds 401

#### Scenario: Cross-tenant session id

- GIVEN a session for tenant A
- WHEN a movement or close names a session owned by tenant B
- THEN the server responds not found and writes nothing

#### Scenario: Movement on a closed session

- GIVEN a closed session
- WHEN a cash movement is submitted against it
- THEN the server rejects it and the persisted movements of that session are unchanged

## Open Questions

- **Decided.** The guard is one OPEN session per **branch**, enforced by a partial unique index on `(tenantId, branchId)` where `status = 'OPEN'`, and the branch is derived from the authenticated user's `Employee` record rather than from a client-supplied id. A sale still takes its branch from the open session and never from the client, and it no longer relies on the tenant-wide 409 to make its session unique.
- **Still open.** *Which* open session a sale selects is not decided. Today `registerSale` finds the session with an unordered `findFirst({ tenantId, status: 'OPEN' })` (`prisma-distribution.repository.ts:1961-1963`) and `registerSaleSchema` carries neither a `sessionId` nor a `branchId` (`src/core/schemas/distribution.ts:216-225`), so per-branch uniqueness makes that lookup ambiguous. The property this delta fixes is the ambiguity itself: the sale MUST resolve exactly one session deterministically instead of accepting an arbitrary row. The mechanism — naming the session on the sale, or deriving it from the authenticated user's branch — is a design decision that must be settled before the multi-branch sale path is built.
