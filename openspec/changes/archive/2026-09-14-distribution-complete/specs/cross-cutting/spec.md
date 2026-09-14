# Cross-Cutting Specification

## Purpose

Change-wide engineering rules that apply to every distribution capability and the base shell for this change: multi-tenant isolation, additive database and seed integrity, and i18n completeness.

## Requirements

### Requirement: Multi-tenant isolation (all capabilities)

Every query and mutation MUST include `tenantId` derived server-side from the session (`requireTenantId`); clients MUST NOT send `tenantId` in query/body. Money math (totals, tax, change, differences) MUST be computed server-side. JSONB payloads MUST use Zod schemas / typed interfaces, never `any`.

#### Scenario: Strict isolation

- GIVEN a STAFF session for tenant A
- WHEN a request references a record id of tenant B
- THEN the query returns 404/empty (never tenant B data)

#### Scenario: Anti-spoofing

- GIVEN a request whose body includes a `tenantId` field
- WHEN the route processes it
- THEN the client-supplied value is ignored; the session tenant governs

### Requirement: Additive database changes and seed integrity

Schema changes MUST be additive only (new tables/columns/FKs; no destructive reset). `prisma migrate dev` MUST NOT run unsupervised; apply via documented additive migration + `prisma generate`. The seed MUST initialize a real `SaleCounter` for the distribuidora tenant so the first post-seed invoice continues numbering without restarting or colliding with historical `FAC-*` invoices.

#### Scenario: Counter continuity after seed

- GIVEN a fresh demo seed with 16 `FAC-*` sales
- WHEN the first real sale is registered
- THEN its invoice number follows the historical sequence (no duplicate, no restart at 000001)
- AND `SaleCounter` is incremented in the same transaction as the sale

### Requirement: i18n completeness

All new UI strings MUST have both `es` and `en` keys in `messages/`; no new hardcoded strings in views.

#### Scenario: Locale render

- GIVEN a view with new UI copy and the `en` locale active
- WHEN the view renders
- THEN the English key is displayed (never the raw key or Spanish fallback)