# Design: distribution-complete — Client-Ready Distribuidora

Contract: `openspec/changes/distribution-complete/proposal.md` + the 16 delta specs under `specs/` (read `cross-cutting` first: tenant isolation, additive DDL, seed integrity, i18n completeness).

## Technical Approach

Repeat the proven distribution pattern per capability: entity (`src/core/entities/distribution.ts`) → port (`I*Repository` in `src/core/ports/distribution-repository.port.ts`) → Prisma adapter (`src/infrastructure/db/repositories/prisma-distribution.repository.ts`) → route (`requireTenantId` + `requireApiAuth` + Zod) → React Query in view (`apiGet`/`apiSend` from `src/modules/distribution/api.ts`) → i18n keys in `messages/{es,en}.json`. Money math and `tenantId` stay server-side; schema changes are additive DDL + `prisma generate`; seed upserts `SaleCounter` at 16 so invoices continue after the 16 historical `FAC-*` sales (`cross-cutting`: counter continuity).

## Architecture Decisions

| Decision | Options | Choice | Why |
|---|---|---|---|
| Zod home | per-route / shared lib | `src/core/schemas/distribution.ts` + `tenant.ts` | Core-agnostic; routes import; matches AGENTS.md JSONB/Zod rule (zod is NOT a direct dependency yet — add to package.json in S2) |
| Error contract | inline per route | `src/lib/api-error.ts` (`ApiError` + `handleApiError`) → 400/401/403/404/409 ES messages | Uniform contract; repo throws typed errors; routes map deterministically |
| Admin guard | strict `requireApiAuth(['TENANT_ADMIN'])` | extend `requireApiAuth` so SUPER_ADMIN satisfies any roles list | Avoid locking out super admin; small additive auth change (proposal: Med risk) |
| Invoice format | CAI-range `000-001-01-N` | keep `INV-YYYYMMDD-######` from seeded `SaleCounter` | Spec: "existing pattern"; CAI range fields remain informational |
| Payments/returns | columns vs tables | new `Receivable`+`ReceivablePayment`, `SaleReturn`+`SaleReturnItem` | Auditable, tenant-scoped, additive-only |
| Cash close | keep trusting client totals | server computes expected/difference from movements+sales; input only `physicalCount` | Anti-tamper (`distribution-cash-register` domain 3) |
| Schema delivery | `prisma migrate dev` | documented additive DDL + `prisma generate`, manual apply | No `_PrismaMigrations`; never unsupervised (proposal, F0 spec) |
| Shell data | new endpoint | extend `/api/auth/me` with `tenant {name, modules}` | Exists already; session-derived, no client tenantId |
| Pagination | cursor | classic page/limit: `PaginatedResult<T> {items, page, limit, hasMore}` | Spec asks page + has-more; limit 1..100 → invalid 400, out-of-range → empty list |

## Data Flow

```
POST /sales {paymentMethod, paidAmount} → repo.$transaction:
  stock decrement → SaleCounter++ → Sale+items → Receivable if balance>0
POST /purchase-orders → status ORDERED; POST /[id]/receive:
  validate qty ≤ remaining (receivedQty) → inventory increment → status RECEIVED
POST /cash/close {sessionId, physicalCount} → expected = opening + Σmovements(IN−OUT) + Σsales; diff = physicalCount − expected
GET /dashboard → aggregate sales; trends = period-over-period pct from data; topProducts revenue = Σ SaleItem.price·qty (sale-time prices)
```

## Database Changes (additive DDL only)

| Model | Add |
|---|---|
| `Sale` | `paymentMethod String @default("CASH")`, `paidAmount Decimal(10,2) @default(0)`, `balance Decimal(10,2) @default(0)` |
| `PurchaseOrderItem` | `receivedQty Int @default(0)` |
| `InvoicingConfig` (new) | `tenantId @unique`, `caiNumber`, `rangeFrom`, `rangeTo`, `limitDate?`, `companyTaxId`, `legalName` |
| `Receivable` (new) | `tenantId, saleId, personId`, `originalAmount`, `balance`, `status` |
| `ReceivablePayment` (new) | `receivableId`, `amount`, `method`, `createdAt` |
| `SaleReturn` (new) | `tenantId, saleId, cashSessionId?, reason?, totalRefund` |
| `SaleReturnItem` (new) | `returnId, itemId, quantity, refundAmount` |

Employee→User link requires NO DDL: `User.personId @unique` and `posPinHash` already exist (verified in `prisma/schema.prisma`); link = upsert User with `personId = employee.personId`, bcrypt(PIN), role STAFF (same tx as employee update).

**Seed (`prisma/seed.ts`)**: upsert `SaleCounter{lastNumber:16}` (verified: seed writes `FAC-${invoiceSeq++}` → next real sale = `INV-…-000017`); add items to the 3 seeded POs; default `InvoicingConfig` row.

## File Changes per Slice (5 chained PRs — each gated on the 400-line budget)

**S1 F0 env (~30)** — `distribution-f0-environment-stabilization` + `cross-cutting`: `.gitignore` M (`.env*` + `!.env.example`); `next.config.ts` M (remove `turbopack:{root}` hack + OneDrive comment); `.husky/_` regenerate (`npm run prepare`); delete stale `.next`.

**S2 Security foundation (~650)** — `distribution-access-control`: `package.json` M (+`zod` ^3, install); `src/core/schemas/distribution.ts` C; `src/core/schemas/tenant.ts` C; `src/lib/api-error.ts` C; `src/lib/session.ts` M (SUPER_ADMIN passthrough); `src/app/api/auth/me/route.ts` M (tenant payload); all 14 existing `api/distribution/**/route.ts` M (`requireApiAuth` by role + Zod + `handleApiError`).

**S3 P0 sale-blocking (~1400)** — `distribution-tax-invoicing`, `distribution-cash-register`, `distribution-customers`, `distribution-purchase-orders`, `distribution-employees`: `src/core/entities/distribution.ts` M (CashSession/Sale fields, invoicing/return/receivable entities, `PaginatedResult<T>`); `src/core/ports/distribution-repository.port.ts` M (customer/PO/employee/config/close input contracts); `prisma-distribution.repository.ts` M (new methods, server-side close, open-session 409, counter + `@@unique([tenantId, invoiceNumber])` in sale tx); routes: `tax/config/route.ts` C (GET/PUT, TENANT_ADMIN), `customers/route.ts` M POST, `customers/[id]/route.ts` C PATCH, `purchase-orders/route.ts` M POST, `purchase-orders/[id]/receive/route.ts` C POST, `employees/[id]/route.ts` C (PATCH / deactivate / link-PIN), `cash/route.ts` M (409), `cash/close/route.ts` M (physicalCount); views: `TaxAndInvoicingView.tsx` M (server CAI, drop fake local state + hardcoded `000-001-01-00001249`), `CashRegisterView.tsx` M, `CustomersView.tsx` C, `EmployeesView.tsx` M, `SuppliersView.tsx` M (PO create/receive), `DistributionModuleApp.tsx` M (add customers tab).

**S4 P1 100% (~1280)** — `distribution-payments-returns`, `distribution-suppliers`, `distribution-inventory-ops`, `distribution-dashboard-real`, `distribution-pagination`: `sales/route.ts` M (paymentMethod/paid, pagination), `sales/[id]/returns/route.ts` C POST (409 over-qty, stock restore, audit), `receivables/route.ts` C GET, `receivables/[id]/pay/route.ts` C POST, `suppliers/route.ts` M PATCH, `suppliers/[id]/route.ts` C (PATCH/deactivate), `inventory/route.ts` M (branchId-scoped update, negative guards), `inventory/[id]/route.ts` M (DELETE, 409 if referenced), `dashboard/route.ts` + repo M (real trends, topProducts from SaleItem); views: `SalesPOSView.tsx` M (payment/tender), `DistributionDashboard.tsx` M (drop `+12.4%` hardcodes), `InventoryView.tsx` M, `SalesHistoryView.tsx` M (pagination).

**S5 Base shell + admin (~470)** — `tenant-dynamic-shell`, `admin-tenant-settings`, `gym-anti-spoof-hygiene`: `app-sidebar.tsx` M (session + `tenant.modules` + role-driven nav, real tenant name in team switcher); `DistributionModuleApp.tsx` M (real tenant header via session); `api/distribution/settings/route.ts` C (TENANT_ADMIN, Zod → `Tenant.settings`) + `TenantSettingsView.tsx` C; `dashboard/modules/gym/page.tsx` M + `GymCheckInView.tsx` M (drop `tenantId="powerfit-gym"` hardcode + default param; tenantId from `/api/auth/me`); `messages/es.json` + `en.json` M (customers, CAI, payments/returns, settings, pagination, physical-count keys; every new UI string both locales).

## Interfaces / Contracts

```ts
CloseCashSessionInput { sessionId: string; physicalCount: number } // expected/difference removed from client input
RegisterSaleInput + paymentMethod: 'CASH'|'CARD'|'TRANSFER'|'CREDIT', paidAmount: number
PaginatedResult<T> { items: T[]; page: number; limit: number; hasMore: boolean } // limit 1..100; out-of-range → empty; invalid → 400
```
`ApiError` mapping: 400 validation (Zod), 401 unauth, 403 role, 404 not-found/cross-tenant, 409 conflict (dup open session, over-receive, over-return, referenced delete, insufficient stock). Invoice `INV-YYYYMMDD-######` next after seed `lastNumber` 16.

## Testing Strategy

| Gate | Checks |
|---|---|
| lint / typecheck / build | per slice; S1 must make gates pass post-`.next` deletion |
| grep guards | `requireApiAuth` in every `api/distribution/**/route.ts`; Zod `safeParse` in every route; zero `powerfit-gym` in gym files; zero `+12.4%`-style hardcodes; zero `any` in changed files (`tsc` enforces) |
| seeded smoke | backup DB → `db:seed` → login admin/PIN → first real sale = `INV-…-000017`; duplicate open → 409; STAFF on `tax/config`/`settings` → 403; malformed body → 400; over-receive/over-return → 409; branch-B stock update leaves branch A untouched; return restores stock; CAI config persists across reload; en locale renders new keys |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary introduced. Rows (documentation-like paths, git repo selection, commit/push state, PR commands) are all N/A: the change is HTTP-route / Prisma / UI code; `db:seed` and Husky `prepare` are ops commands, not designed automation.

## Migration / Rollout

Backup DB → apply documented additive DDL → `prisma generate` → `db:seed` → smoke. Never `prisma migrate dev` unsupervised. Each slice ships as its own chained PR with independent revert; S2 foundation lands before S3–S5 routes depend on it.

## Open Questions

- [ ] SUPER_ADMIN passthrough modifies `requireApiAuth` semantics (auth-touching; proposal Med risk) — verify no consumer/tests depend on strict role lists.
- [ ] Seed additions (PO items, default `InvoicingConfig`, `SaleCounter:16`) are technically required for demo flows but were only implied by the spec's counter scenario — recorded as implementation detail, not new requirements.
- [ ] Invoice stays `INV-*` while CAI range is informational — confirm fiscal expectations with tenant before demo.
- [ ] Login tenant-scoping (P2) and test-runner setup remain out of scope per proposal.