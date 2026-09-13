# Tasks: distribution-complete — Client-Ready Distribuidora

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,800–3,400 authored; every slice except S1 exceeds 400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 5-PR feature-branch chain: S1 → S2 → S3 → S4 → S5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Delivery strategy: ask-on-risk (user-resolved → chained PRs). One slicing pass: keep the design's 5-PR chain; over-budget slices split into the work units below (each a candidate PR/commit; tests/docs/i18n ship with their unit).

Feature-branch-chain base boundaries: PR #1 (S1) base = `feature/distribution-complete` tracker (draft, no-merge); PR #2 (S2a+S2b) base = PR #1 branch; PR #3 (S3a–S3d) base = PR #2 branch; PR #4 (S4a–S4d) base = PR #3 branch; PR #5 (S5a+S5b) base = PR #4 branch. Only the tracker merges to main. If an over-budget unit pushes a PR past 400 actual changed lines at apply time (S3c ~490 → cut 270/220; S3d ~430; S2b ~280), promote that unit to its own child PR targeting the parent branch; polluted diffs are retargeted/rebase-fixed, never reviewed as mixed.

### Suggested Work Units

| Unit | Goal | Est. lines | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|-----------|----------------------|-----------------|-------------------|
| S1 | F0 env: gitignore, next.config, husky, .next | ~30 | PR 1 (base: tracker) | `npm run lint && npm run typecheck && npm run build` post-`.next`; `git check-ignore .env.local .env.production` | `npm run prepare` → `.husky/_`; commit hooks fire | per-file revert (.gitignore, next.config.ts, .husky) |
| S2a | zod dep; core schemas; api-error; session passthrough; /api/auth/me | ~370 | PR 2 (base: PR 1) | `npm run typecheck`; `/api/auth/me` returns `tenant {name, modules}` | admin login → shell shows tenant name/modules | revert foundation files |
| S2b | 14 routes: requireApiAuth+Zod+handleApiError | ~280 | PR 2 | grep `requireApiAuth` + `safeParse` per route | STAFF on tax/config → 403; unauth → 401; malformed → 400 | revert 14 route files |
| S3a | DDL schema+migration; entities; ports | ~330 | PR 3 (base: PR 2) | `npx prisma generate` succeeds | seeded smoke post-DDL (DB backup first) | revert DDL + schema |
| S3b | repo: sale-tx counter, close, 409, receive; seed upsert | ~310 | PR 3 | seed → `SaleCounter.lastNumber === 16` | first real sale = `INV-…-000017`; dup-open → 409 | revert repo/seed |
| S3c | routes: tax/config, customers, POs, employees, cash | ~490 → cut 270/220 | PR 3 | 409 dup-open / over-receive; STAFF → 403 | CAI config persists across reload | revert new routes |
| S3d | views ×6, customers tab, i18n | ~430 | PR 3 | `npm run build`; en keys render | POS walk-through | revert views |
| S4a | sales/returns/receivables routes+repo | ~300 | PR 4 (base: PR 3) | over-return → 409; stock restored | credit sale → receivable → pay | revert |
| S4b | suppliers+inventory routes | ~380 | PR 4 | branch-B update leaves branch A untouched; referenced delete → 409 | multi-branch update scenario | revert |
| S4c | dashboard trends; pagination | ~250 | PR 4 | grep zero hardcodes; page 2 | empty period → 0% trends | revert |
| S4d | views ×4, i18n | ~350 | PR 4 | `npm run build`; en render | sale; history page 2 | revert views |
| S5a | app-sidebar; settings route+view | ~320 | PR 5 (base: PR 4) | STAFF on settings → 403 | admin saves settings → persisted | revert |
| S5b | gym anti-spoof; es/en keys | ~150 | PR 5 | grep zero `powerfit-gym` | gym page shows session tenant | revert gym files + i18n |

## Phase 1 — S1 F0 Environment

- [x] 1.1 `.gitignore` M: ignore all `.env*` except `!.env.example`; verify `git check-ignore` on `.env.local`/`.env.production` [S1]
- [x] 1.2 `next.config.ts` M: remove `turbopack:{root}` hack + OneDrive comment; delete stale `.next`; `npm run prepare` → regenerates `.husky/_`; gates lint + typecheck + build [S1]

## Phase 2 — S2 Security Foundation

- [x] 2.1 Open question — SUPER_ADMIN passthrough (early): grep `requireApiAuth`/role-list consumers across `src/`; confirm none depend on strict-role denial before extending `requireApiAuth`; record finding [S2a]
- [x] 2.2 `package.json` M: add direct `zod ^3` dependency; install [S2a]
- [x] 2.3 `src/core/schemas/tenant.ts` C; `src/core/schemas/distribution.ts` C: Zod for customer/PO/employee/supplier/inventory/sale/cash-close/invoicing/settings/pagination inputs; no `any` [S2a]
- [x] 2.4 `src/lib/api-error.ts` C: `ApiError` + `handleApiError` → 400/401/403/404/409 ES messages [S2a]
- [x] 2.5 `src/lib/session.ts` M: `requireApiAuth` lets SUPER_ADMIN satisfy any roles list (blocked until 2.1 passes) [S2a]
- [x] 2.6 `src/app/api/auth/me/route.ts` M: add `tenant {name, modules}` payload [S2a]
- [x] 2.7 All 14 `src/app/api/distribution/**/route.ts` M: `requireTenantId` + `requireApiAuth(role)` + Zod + `handleApiError`; grep guard + `safeParse` per route [S2b]

## Phase 3 — S3 P0 (sale-blocking)

- [x] 3.1 Backup DB; `prisma/schema.prisma` M + `prisma/migrations/<ts>_distribution_complete/migration.sql` C: additive DDL (Sale.paymentMethod/paidAmount/balance; PurchaseOrderItem.receivedQty; InvoicingConfig; Receivable; ReceivablePayment; SaleReturn; SaleReturnItem); `prisma generate`; never unsupervised `migrate dev` [S3a]
- [x] 3.2 `src/core/entities/distribution.ts` M: cash/sale fields, invoicing/return/receivable types, `PaginatedResult<T>`; `src/core/ports/distribution-repository.port.ts` M: `CloseCashSessionInput {sessionId, physicalCount}` + customer/PO/employee/config contracts [S3a]
- [x] 3.3 `src/infrastructure/db/repositories/prisma-distribution.repository.ts` M: sale tx (stock decrement → SaleCounter++ → sale+items → receivable; `@@unique([tenantId, invoiceNumber])`; next `INV-YYYYMMDD-######` after seed 16), server-side close (expected vs physicalCount), open-session 409, PO-receive qty ≤ remaining → 409 [S3b]
- [x] 3.4 Open question — SaleCounter continuity: `prisma/seed.ts` M: upsert `SaleCounter{lastNumber: 16}` (after 16 `FAC-*`), items to 3 seeded POs, default InvoicingConfig [S3b]
- [x] 3.5 Routes: `src/app/api/distribution/tax/config/route.ts` C GET/PUT TENANT_ADMIN+Zod; `customers/route.ts` M POST; `customers/[id]/route.ts` C PATCH; `purchase-orders/route.ts` M POST; `purchase-orders/[id]/receive/route.ts` C POST (409 over-receive) [S3c]
- [x] 3.6 Open question — employee→User PIN link: `employees/[id]/route.ts` C PATCH/deactivate + User link (upsert User: personId = employee.personId, bcrypt(PIN) → posPinHash, role STAFF, same tx); `cash/route.ts` M open-409; `cash/close/route.ts` M physicalCount-only server close [S3c]
- [x] 3.7 Views: `TaxAndInvoicingView.tsx` M (server CAI, drop fake local state + hardcoded `000-001-01-00001249`), `CashRegisterView.tsx` M, `CustomersView.tsx` C, `EmployeesView.tsx` M, `SuppliersView.tsx` M (PO create/receive), `DistributionModuleApp.tsx` M (customers tab); i18n es+en [S3d]

## Phase 4 — S4 P1 (100%)

- [x] 4.1 Routes+repo: `sales/route.ts` M (paymentMethod/paidAmount server-side + pagination); `sales/[id]/returns/route.ts` C POST (409 over-qty, stock restore, audit); `receivables/route.ts` C GET; `receivables/[id]/pay/route.ts` C POST [S4a]
- [x] 4.2 Routes: `suppliers/route.ts` M PATCH; `suppliers/[id]/route.ts` C PATCH/deactivate; `inventory/route.ts` M branchId-scoped update + negative-value guards; `inventory/[id]/route.ts` M DELETE (409 if referenced) [S4b]
- [ ] 4.3 `dashboard/route.ts` + repo M: real trends period-over-period (drop `+12.4%` hardcodes), topProducts = Σ SaleItem.price·qty; pagination limit 1..100 → invalid 400, out-of-range → empty [S4c]
- [ ] 4.4 Views: `SalesPOSView.tsx` M (tender/credit), `DistributionDashboard.tsx` M (drop hardcodes), `InventoryView.tsx` M (multi-branch/delete), `SalesHistoryView.tsx` M (pagination); i18n [S4d]

## Phase 5 — S5 Base Shell + Admin

- [ ] 5.1 `app-sidebar.tsx` M: session + `tenant.modules` + role-driven nav; real tenant name in team switcher; customers tab; hide inactive modules [S5a]
- [ ] 5.2 `src/app/api/distribution/settings/route.ts` C GET/PUT TENANT_ADMIN + Zod → `Tenant.settings`; `TenantSettingsView.tsx` C; i18n [S5a]
- [ ] 5.3 `dashboard/modules/gym/page.tsx` M + `GymCheckInView.tsx` M: drop `tenantId="powerfit-gym"` hardcode + default param; tenantId from session (`/api/auth/me`) [S5b]
- [ ] 5.4 `messages/es.json` + `messages/en.json` M: every new UI string in both locales (customers, CAI, payments/returns, settings, pagination, physical-count keys) [S5b]
- [ ] 5.5 Final seeded smoke: backup → `db:seed` → login admin/PIN → first sale `INV-…-000017`; dup-open 409; STAFF tax/config + settings 403; malformed 400; over-receive/over-return 409; branch-B stock untouched; return restores stock; CAI persists reload; en renders [S5]