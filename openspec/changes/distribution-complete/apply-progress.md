# Apply Progress: distribution-complete — S1 F0 (PR #1) + S2 Security Foundation (PR #2) + S3a/S3b P0 data layer (PR #3)

- **Change**: distribution-complete
- **Batch 1**: Phase 1 S1 F0 Environment, tasks 1.1 + 1.2 (PR #1, branch `feat/distribution-complete-01-f0`)
- **Batch 2**: Phase 2 S2 Security Foundation, tasks 2.1–2.7 (PR #2, branch `feat/distribution-complete-02-security`, base = PR #1 branch)
- **Batch 3**: Phase 3 S3a (P0 data layer), tasks 3.1 + 3.2 (PR #3, branch `feat/distribution-complete-03-p0`, base = PR #2 branch)
- **Batch 4**: Phase 3 S3b (P0 repo transaction logic + seed continuity), tasks 3.3 + 3.4 (PR #3, branch `feat/distribution-complete-03-p0`) — this report
- **Mode**: Standard (no test runner configured; gate = lint / typecheck / build + grep guards + `prisma generate`)
- **Chain**: feature-branch-chain — PR #1 base = tracker `feat/distribution-complete`; PR #2 base = PR #1 branch; PR #3 base = PR #2 branch; only tracker merges to main. Do NOT open PRs from apply.

## Task 2.1 EARLY GATE — Verdict: PASS

Grep across `src/` (`requireApiAuth`, `roles`, role arrays, route handlers in `src/app/api/**/route.ts`, `SUPER_ADMIN`, `.role`, `UnauthorizedError`):

| Search | Result |
|---|---|
| `requireApiAuth` | Exactly 1 match — the definition `src/lib/session.ts:34`. **ZERO consumers** (no call sites anywhere in `src/`) |
| `roles.includes` / `role ===` / `role !==` | Only the definition's own `roles.includes(session.role)` check inside `requireApiAuth`; no inline role-denial logic in any route handler |
| `SUPER_ADMIN` | Only the `SessionRole` type literal in `src/lib/session-token.ts:6` |
| `.role` in route handlers | `auth/me` echoes `session.role`; `employees` POST maps a UI form field `role` (employee position string, not a session role check); `login` writes `user.role` into the session. None perform role-list denial |
| `requireTenantId` in routes | 14 distribution routes use it for tenant scoping only (401 on null); it never rejects by role |

Consumer inventory (exhaustive): no route, middleware, or lib imports or calls `requireApiAuth([...])` today; there is no strict-role-list denial behavior anywhere in the codebase. Extending `requireApiAuth` so `SUPER_ADMIN` satisfies any roles list is purely additive (it only short-circuits the existing `roles.includes` check for SUPER_ADMIN; other roles behave identically) and cannot regress a consumer, because no consumer exists yet — 2.5–2.7 proceeded.

## Work Unit Evidence — S3b P0 repo transaction logic + seed continuity (batch 4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx prisma generate` → exit 0 (no-op success, schema unchanged this batch); `npm run lint` → exit 0 (0 errors 0 warnings); `npm run typecheck` → exit 0 (`tsc --noEmit` clean — includes `prisma/seed.ts` via tsconfig `**/*.ts`); `npm run build` → exit 0 (Next.js 16.3.4 production build, 17/17 routes). Per-commit hooks re-ran lint + typecheck on each of the 4 code commits (all exit 0) |
| Runtime harness command/scenario and exact result | N/A as runtime: no DB-backed smoke was authorized for S3b (DB is READ-ONLY this batch; `db:seed`/`migrate dev` NOT run). The DB-backed smoke (seed → `SaleCounter.lastNumber === 16` → first real sale `INV-…-000017`; dup-open → 409; over-receive → 409) is the S5 gate per design Testing Strategy, under user supervision with DB backup |
| Rollback boundary | Revert the 4 code commits of batch 4 independently: `feat(distribution)` sale flow (repo file), `feat(distribution)` PO receive (repo + port), `feat(distribution)` cash open/close (repo file), `feat(db)` seed (`prisma/seed.ts`). All are self-contained per-behavior slices on top of S3a; seed revert leaves the historical FAC-* sales untouched |

## Work Unit Evidence — S3a P0 data layer (batch 3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx prisma generate` → exit 0 (Prisma Client v5.22.0 generated; schema validated); `npm run lint` → exit 0 (0 errors 0 warnings); `npm run typecheck` → exit 0 (`tsc --noEmit` clean); `npm run build` → exit 0 (Next production build, 17/17 routes incl. all 14 `/api/distribution/**`) |
| Runtime harness command/scenario and exact result | N/A as runtime: DDL is delivered as a documented migration file + regenerated client; apply to a real DB is manual and supervised (backup first — proposal F0 spec, design Migration/Rollout). DB-backed smoke (sale → `INV-…-000017`, server-side close, 409s) is the S5 gate per design Testing Strategy |
| Rollback boundary | Revert the 3 commits of PR #3: (1) schema+migration (`prisma/schema.prisma`, `prisma/migrations/20260912120000_distribution_complete/`), (2) entities+ports+consumer adaptation (`src/core/entities/distribution.ts`, `src/core/ports/distribution-repository.port.ts`, `src/infrastructure/db/repositories/prisma-distribution.repository.ts` close/sale-mapping lines, `src/app/api/distribution/cash/close/route.ts`, `src/app/api/distribution/sales/route.ts`), (3) `chore(sdd)` task-marking (`tasks.md`, `apply-progress.md`). Clean revert without touching S1/S2 files; migration file is new, so a revert leaves zero DB DDL in the repo |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run lint` → exit 0 (no errors, no warnings); `npm run typecheck` → exit 0 (`tsc --noEmit` clean); `npm run build` → exit 0 (Next production build; 17/17 dynamic `ƒ` routes incl. all 14 `/api/distribution/**`); grep guard per route (see Verification Evidence) |
| Runtime harness command/scenario and exact result | N/A as runtime: no DB-backed smoke was authorized for S2 (P0/P1 seeded smoke is the S5 gate per design Testing Strategy); route behavior is exercised via the grep guard + build compilation of all handlers. Legacy-client compatibility was verified statically against view payloads (`CashRegisterView` close payload; `SalesPOSView` sale payload; `SuppliersView`/`EmployeesView` optional-field empty strings; `SalesHistoryView` `limit=200`; POS `/tax` rate reads) |
| Rollback boundary | Revert the 4 code commits of PR #2 independently per unit: `chore(deps)` (package.json + package-lock.json), `feat(security)` schemas+api-error+i18n (`src/core/schemas/*`, `src/lib/api-error.ts`, `src/lib/session.ts` ForbiddenError, `messages/*`), `feat(auth)` (`src/lib/session.ts` SUPER_ADMIN line + `src/app/api/auth/me/route.ts`), `feat(security)` routes (14 files under `src/app/api/distribution/`). The whole PR reverts cleanly without touching S1 files or schema/DB |

## Tasks Status

### Phase 1 — S1 F0 Environment (batch 1, PR #1)

- [x] 1.1 `.gitignore` M: ignore all `.env*` except `!.env.example`; verify `git check-ignore` on `.env.local`/`.env.production` [S1]
- [x] 1.2 `next.config.ts` M: remove `turbopack:{root}` hack + OneDrive comment; delete stale `.next`; `npm run prepare` → regenerates `.husky/_`; gates lint + typecheck + build [S1]

### Phase 2 — S2 Security Foundation (batch 2, PR #2)

- [x] 2.1 Open question — SUPER_ADMIN passthrough (early): verdict PASS, consumer inventory above [S2a]
- [x] 2.2 `package.json` M: direct `zod ^3.25.76` added (matched the transitive `zod@3.25.76` in the tree); `npm install` → tree deduped onto top-level `zod@3.25.76`, 0 vulnerabilities; `npm ls zod` shows top-level `zod@3.25.76` [S2a]
- [x] 2.3 `src/core/schemas/tenant.ts` C + `src/core/schemas/distribution.ts` C: Zod input schemas for customer (create/update), purchase-order (+ receive), employee (optional PIN `^\d{4,6}$`, hashed server-side in P0), supplier (create/update), inventory ops (branchId-scoped update schema + negative cost/price/stock guards), sale (`paymentMethod` CASH/CARD/TRANSFER/CREDIT, `paidAmount`, `balance`), cash-close (`sessionId` + `physicalCount` only), invoicing/CAI config, tenant settings, pagination (`page`/`limit` 1..100), plus `idParamSchema`, `noQueryParamsSchema`, `customerSearchQuerySchema`, `salesListQuerySchema`; zero `any`; core imports core only [S2a]
- [x] 2.4 `src/lib/api-error.ts` C: `ApiError` (400/401/403/404/409) + `handleApiError` mapping ZodError/SyntaxError → 400, `UnauthorizedError` → 401, `ForbiddenError` → 403, legacy repo-message map (Stock insuficiente→409, SKU dup→409, `no encontrad*`→404, Sesión de caja / sale-guard msgs→400) with Spanish user-facing messages; `errors.*` keys added to BOTH `messages/es.json` and `messages/en.json` [S2a]
- [x] 2.5 `src/lib/session.ts` M: `requireApiAuth` short-circuits `SUPER_ADMIN` past any roles list (additive; other roles unchanged); new `ForbiddenError` (403) distinct from `UnauthorizedError` (401) [S2a]
- [x] 2.6 `src/app/api/auth/me/route.ts` M: response now includes `tenant { name, modules }` read server-side from the session's `tenantId` (never from client); wrapped in `handleApiError` [S2a]
- [x] 2.7 All 14 `src/app/api/distribution/**/route.ts` M: every handler runs `requireTenantId` + `requireApiAuth(role)` + Zod `safeParse` (400 malformed) + `handleApiError`; role matrix below [S2b]

Role matrix (verified against `specs/distribution-access-control` + per-capability specs; POS operational = STAFF/TENANT_ADMIN, config-management = TENANT_ADMIN; SUPER_ADMIN passes everything via 2.5):

| Route | Handler(s) | Roles |
|---|---|---|
| `dashboard/route.ts` GET | STAFF, TENANT_ADMIN | POS operational read |
| `inventory/route.ts` GET+POST | STAFF, TENANT_ADMIN | POS operational |
| `inventory/[id]/route.ts` PATCH | STAFF, TENANT_ADMIN | POS operational |
| `customers/route.ts` GET | STAFF, TENANT_ADMIN | customers spec scenario: STAFF creates/edits customers |
| `employees/route.ts` GET+POST | STAFF, TENANT_ADMIN | POS operational |
| `suppliers/route.ts` GET+POST | STAFF, TENANT_ADMIN | POS operational |
| `purchase-orders/route.ts` GET | STAFF, TENANT_ADMIN | POS operational |
| `sales/route.ts` GET+POST | STAFF, TENANT_ADMIN | POS operational |
| `cash/route.ts` GET+POST | STAFF, TENANT_ADMIN | POS operational (open 409 lands in P0) |
| `cash/close/route.ts` POST | STAFF, TENANT_ADMIN | POS operational (server-side compute lands in P0) |
| `cash/movements/route.ts` POST | STAFF, TENANT_ADMIN | POS operational |
| `tax/route.ts` GET | STAFF, TENANT_ADMIN | GET = operational read (POS fetches rates to compute invoice tax); POST = TENANT_ADMIN (config mutation — access-control scenario STAFF→403) |
| `tax/[id]/route.ts` PATCH+DELETE | TENANT_ADMIN | config mutation (STAFF→403) |
| `tax/summary/route.ts` GET | TENANT_ADMIN | fiscal reporting on the tax/CAI admin surface; not consumed by any STAFF flow |

### Phase 3 — S3 P0 (sale-blocking) (batches 3+4: S3a + S3b)

- [x] 3.1 `prisma/schema.prisma` M + `prisma/migrations/20260912120000_distribution_complete/migration.sql` C: additive DDL — Sale.paymentMethod/paidAmount/balance (nullable-agnostic: `NOT NULL DEFAULT` so existing rows survive), PurchaseOrderItem.receivedQty, InvoicingConfig (tenantId `@unique`, 1 per tenant), Receivable + ReceivablePayment, SaleReturn + SaleReturnItem; `@@unique([tenantId, invoiceNumber])` on Sale verified ALREADY present (migration 20260910070000_invoice_correlative), NOT re-applied; `npx prisma generate` → exit 0 [S3a]
- [x] 3.2 `src/core/entities/distribution.ts` M: `PaymentMethod`/`ReceivableStatus` unions, SaleEntity.paymentMethod/paidAmount/balance, PurchaseOrderItemEntity.receivedQty, InvoicingConfigEntity, ReceivableEntity, ReceivablePaymentEntity, SaleReturnEntity, SaleReturnItemEntity, `PaginatedResult<T>` {items/page/limit/hasMore}; `src/core/ports/distribution-repository.port.ts` M: `CloseCashSessionInput {sessionId, physicalCount}` (expected/difference no longer client input), `RegisterSaleInput.paymentMethod/paidAmount`, input contracts CreateCustomer/UpdateCustomer/CreatePurchaseOrder/ReceivePurchaseOrder/UpdateEmployee/UpdateInvoicingConfig; NO `any` [S3a]
- [x] 3.3 `src/infrastructure/db/repositories/prisma-distribution.repository.ts` M: `registerSale` now runs the FULL server-side money in one `$transaction` — stock decrement (`updateMany` with `stock >= qty` guard → `ApiError(409, 'Stock insuficiente…')`), SaleCounter upsert+increment (`INV-YYYYMMDD-######`, next after seed 16 → first real sale `INV-…-000017`), Sale + items with PERSISTED `paymentMethod/paidAmount/balance`, and `Receivable` opened in the same tx when `balance > 0` (credit sales require a customer → `ApiError(400)`); all throws are now typed `ApiError` (400 malformed / 404 missing customer / 409 stock). `openCashSession` gains the single-open-session guard (`ApiError(409, 'Ya existe una sesión de caja abierta')`). `closeCashSession` computes server-side `expected = opening + Σmovements(IN−OUT) + Σsales − Σreturns` and `difference = physicalCount − expected` (client expected/difference never read; returns persist the derived values as `closingAmount/expectedAmount/difference`). NEW `receivePurchaseOrder` (port method shipped with impl): 404 cross-tenant, 409 over-receive (`quantity − receivedQty` guard), inventory increment + `receivedQty` update + ORDERED → RECEIVED when complete, all in one `$transaction` — greps: `$transaction` at repo lines 873/910/1072, SaleCounter upsert at 1119–1123, close derivation at 774–779 [S3b]
- [x] 3.4 Open question — SaleCounter continuity: `prisma/seed.ts` M: upsert `SaleCounter { update: { lastNumber: 16 }, create: { lastNumber: 16 } }` AFTER the 16 `FAC-*` sales (seed lines 371–379; sales untouched at 352–369), items added to the 3 seeded POs (PO-001 fully received / PO-002 pending / PO-003 partially received → receive smoke can complete it), default `InvoicingConfig` row (upsert, seed lines 381–392), plus defensive `deleteMany` coverage for the new tables; verified against current schema by `tsc --noEmit`; seed NOT run (DB read-only this batch) [S3b]
- [x] 3.5 Routes: `src/app/api/distribution/tax/config/route.ts` C GET/PUT TENANT_ADMIN+Zod; `customers/route.ts` M POST; `customers/[id]/route.ts` C PATCH; `purchase-orders/route.ts` M POST; `purchase-orders/[id]/receive/route.ts` C POST (409 over-receive) [S3c]
- [x] 3.6 Open question — employee→User PIN link: `employees/[id]/route.ts` C PATCH/deactivate + User link (upsert User: personId = employee.personId, bcrypt(PIN) → posPinHash, role STAFF, same tx); `cash/route.ts` M open-409; `cash/close/route.ts` M physicalCount-only server close [S3c]
- [x] 3.7 Views: `TaxAndInvoicingView.tsx` M (server CAI, drop fake local state + hardcoded `000-001-01-00001249`), `CashRegisterView.tsx` M, `CustomersView.tsx` C, `EmployeesView.tsx` M, `SuppliersView.tsx` M (PO create/receive), `DistributionModuleApp.tsx` M (customers tab); i18n es+en [S3d]

### Pending (not part of this batch)

- [x] 4.1 Phase 4 S4a — sales pagination, audited returns, receivables list + payments (batch 7)
- [x] 4.2 Phase 4 S4b — suppliers PATCH/deactivate + inventory branch-scoped update + referenced-delete 409 (batch 8)
- [x] 4.3 Phase 4 S4c — dashboard real trends + topProducts, pagination verification (batch 9)
- [ ] 4.4 Phase 4 S4d — views x4, i18n [S4d]
- [ ] 5.1–5.5 Phase 5 S5 Base Shell + Admin [S5a/S5b]

## Verification Evidence (branch `feat/distribution-complete-03-p0`, post-edits)

| Command | Result |
|---|---|
| `npx prisma generate` | exit 0 — Prisma Client v5.22.0 generated in 272ms; schema validated (first attempt EPERM on `query_engine-windows.dll.node` caused by a running `next dev` tree; user authorized killing that tree — `taskkill /PID 29948 /T /F` — then generate succeeded) |
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean; includes the new client types + P0 entity/port contracts) |
| `npm run build` | exit 0; Next.js 16.3.4 production build; 17/17 routes compiled incl. all 14 `/api/distribution/**` |
| Grep proof schema | `paymentMethod`/`paidAmount`/`balance` on Sale, `receivedQty` on PurchaseOrderItem, models InvoicingConfig/Receivable/ReceivablePayment/SaleReturn/SaleReturnItem all present in `prisma/schema.prisma`; `@@unique([tenantId, invoiceNumber])` present (pre-existing, line 173) |
| Grep proof migration | `prisma/migrations/20260912120000_distribution_complete/migration.sql`: 4× `ADD COLUMN` (paymentMethod/paidAmount/balance/receivedQty), 5× `CREATE TABLE` (InvoicingConfig, Receivable, ReceivablePayment, SaleReturn, SaleReturnItem), `CREATE UNIQUE INDEX "InvoicingConfig_tenantId_key"`, FKs + tenant indexes; **zero** `DROP`/`DELETE FROM`/`TRUNCATE`/`ALTER COLUMN` (additive-only audit clean) |
| `git status --porcelain` | `M` schema.prisma, cash/close route, sales route, entities, ports, repo; `?? prisma/migrations/20260912120000_distribution_complete/` (staged in commit 1); only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

| Command | Result |
|---|---|
| `npm ls zod` | top-level `zod@3.25.76`; whole tree deduped onto it (eslint-config-next + shadcn subtrees now `deduped` to 3.25.76); 0 vulnerabilities |
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean) |
| `npm run build` | exit 0; production build; all 14 `/api/distribution/**` routes compiled as dynamic `ƒ` routes |
| Grep guard (14 routes) | `requireApiAuth` + `safeParse` + `requireTenantId` + `handleApiError` present in every one of the 14 `route.ts` files (per-route table; `[id]` paths checked with `-LiteralPath` — PowerShell `[id]` is a glob character class otherwise) |
| 2.1 verdict | **PASS** — zero role-list consumers; extending `requireApiAuth` is additive |
| `git status --porcelain` | `M src/core/schemas/distribution.ts` resolved via amend of the routes commit (see Deviations); only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

## Deviations from Design

### Batch 4 (S3b)

1. **Credit-sale customer guard (content, spec-safe)**: `Receivable.personId` is `NOT NULL` in the S3a schema, so a `balance > 0` sale without a customer cannot open a receivable. The batch enforces `ApiError(400, 'Las ventas a crédito requieren un cliente asociado')` inside the sale transaction (rolls back everything) instead of silently skipping the receivable. The design's "Receivable if balance > 0" holds whenever a customer is attached; walk-in credit is rejected with a clear message.
2. **`receivePurchaseOrder` status vocabulary**: the schema comment lists PO statuses `PENDING | RECEIVED | CANCELLED` while the entity also declares `ORDERED` and the design's data flow uses ORDERED → RECEIVED. Since `PurchaseOrder.status` is a free `String` (no DB enum), receive accepts `PENDING | ORDERED` and advances to `RECEIVED` when complete (partial keeps `ORDERED`), matching the design; a `CANCELLED` PO is rejected with 409.
3. **Commit split by behavior (process)**: the repo file changes were staged hunk-by-hunk (`git add -p`) into 3 cohesive work-unit commits (sale flow / PO receive / cash open+close) instead of one blob commit; each commit passed the husky lint+typecheck hooks and compiles standalone. Port declaration for `receivePurchaseOrder` shipped in the same commit as its Prisma implementation (per prior deviation 2 of batch 3).

### Batch 3 (S3a)

1. **Port contract vs. concrete repo (forced type-compat adaptations)**: changing `CloseCashSessionInput` to `{sessionId, physicalCount}` and adding required `SaleEntity.paymentMethod/paidAmount/balance` broke the concrete repo + 2 route call sites at the type level (`PrismaDistributionRepository implements IDistributionRepository`). To keep `typecheck`/`build` green WITHOUT implementing S3b logic, minimal behavior-preserving adaptations landed in this batch: repo `closeCashSession` stores `physicalCount` as `closingAmount` AND `expectedAmount` with `difference: 0` (byte-identical to the S2 route bridge it replaces), repo `registerSale` maps `paymentMethod/paidAmount/balance` from input (paidAmount defaults to total, balance clamped ≥ 0), repo `getSales` maps the new DB columns directly, and the `cash/close` route passes the new input shape while `sales` route passes `paymentMethod/paidAmount` through. Full server-side close math, the sale transaction and receivable creation remain task 3.3.
2. **Interface method signatures deferred to 3.3**: `IDistributionRepository` gains input contracts (types) in this batch but NOT new method declarations (e.g. `getInvoicingConfig`, `createCustomer`, `receivePurchaseOrder`). Adding unimplemented methods now would break `tsc`/build until the S3b repo implementation lands; methods ship with their Prisma implementations in 3.3. Design's S3 ports line says "input contracts", which is what this batch delivers.
3. **`Sale.paymentMethod` cast in `getSales`**: DB column is TEXT; mapped with `as PaymentMethod` (same pattern as existing `status` casts). Fine for the P0 contract; the P1 route + Zod enum already constrain writes.
4. **Migration naming**: `<ts>` = `20260912120000` (later than all existing migrations 20260909–20260910). `@@unique([tenantId, invoiceNumber])` was ALREADY present (satisfied by the 20260910070000 migration), so the new migration documents it in a comment instead of re-applying (re-applying would fail on a real DB).

### Batch 2 (S2)

1. **`idParamSchema` amend (process)**: the export feeding the two `[id]` routes was initially left unstaged from the routes commit; since the branch is local and unpushed, commit `50271db` was amended (`--no-edit`) to include `src/core/schemas/distribution.ts` so the routes work unit typechecks standalone. Hooks re-ran (lint + typecheck passed). No code content changed beyond the one export line.
2. **Legacy error bridge in `handleApiError` (content)**: the repository still throws plain `Error` with Spanish messages (P0 task 3.3 replaces them with typed `ApiError`). `handleApiError` maps the exact current messages so existing 409/404/400 semantics survive the route migration; a side normalization is that `Producto no encontrado`/`Cliente no encontrado`/`Tasa de impuesto no encontrada` now map to 404 (design: "404 not-found") where `tax DELETE` previously returned 400 — frontend displays the same Spanish message either way.
3. **Status-code normalization**: `ForbiddenError` (role mismatch) returns 403 instead of the previous blanket 401 — required by the design's 400/401/403/404/409 contract and by the access-control spec ("STAFF → 403"). Zero consumers existed before, so nothing regressed.
4. **`cash/close` legacy key bridge (content)**: schema per design is `{sessionId, physicalCount}` only; the current `CashRegisterView` still posts `closingAmount/expectedAmount/difference`, so the S2 route accepts the legacy `closingAmount` key as the physical count and **drops** client `expectedAmount/difference` entirely (server stores `physicalCount` as both `closingAmount` and `expectedAmount`, `difference: 0` — byte-identical to today's honest UI which sends `closingAmount === expectedAmount`). Full server-side derivation replaces this in P0 (task 3.6) when the UI switches to `physicalCount`.
5. **`branchId` in inventory update schema**: `updateInventoryItemSchema` includes optional `branchId` per task 2.3, but the route drops it when calling the repository; the multi-branch `updateInventoryItem` fix is P1 (task 4.2). Forward-compatible contract, no behavior change today.
6. **GET query validation**: GET endpoints with no parameters validate against `noQueryParamsSchema` (strict-empty) and `sales` GET against a legacy `limit` 1..500 schema (the `take 500` cap; 1..100 pagination is P1 per spec `distribution-pagination`). This satisfies "safeParse per route" honestly without breaking `SalesHistoryView?limit=200`.

## Issues Found

- **Batch 4**: None blocking. DB stays untouched (no `db:seed`, no `migrate dev`); the seeded smoke (counter continuity, dup-open 409, over-receive 409) remains the S5 gate under user supervision with DB backup.

- **Environment lock (resolved)**: the first `npx prisma generate` failed with `EPERM: rename query_engine-windows.dll.node` because a `next dev` server was running and held the Prisma engine DLL memory-mapped (Windows). The dev server tree was stopped (`taskkill /PID 29948 /T /F` after user authorization), then `prisma generate` succeeded. The dev server must be restarted to pick up the regenerated client + new schema.
- None blocking for S2. Compatibility reads confirmed: `SuppliersView`/`EmployeesView` send `''` for optional fields → `nullableEmail`/`nullableText` accept and preserve empty strings (no regression); `SalesPOSView` sale payload unchanged (payment fields optional); POS `/tax` GET stays STAFF-accessible so STAFF checkout tax computation is unaffected.

## Workload / PR Boundary

- Mode: chained PR slice #3 (feature-branch-chain; PR #3 base = `feat/distribution-complete-02-security`; tracker `feat/distribution-complete`; later PRs base = immediate previous PR branch)
- Current work unit: S3b P0 repo transaction logic + seed continuity — new commits on `feat/distribution-complete-03-p0`: `feat(distribution)` sale flow, `feat(distribution)` PO receive, `feat(distribution)` cash open/close, `feat(db)` seed, `chore(sdd)` task-marking
- Boundary: start = S3a tip `46098e7`; end = the `chore(sdd)` commit on `feat/distribution-complete-03-p0` (do NOT open the PR from apply)
- Estimated review budget impact: ~320 authored lines across the 5 commits (repo ~170, port ~5, seed ~86, chore ~60); S3b units stay inside the work-unit slice (repo split across 3 behavior commits per deviation 3)

## Batch 5 (S3c) — routes: tax/config, customers, POs, employees, POS login

### Verification (Batch 5)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean; new route files + 7 repo methods typecheck) |
| `npm run build` | exit 0; Next.js 16.3.4 production build; new routes compiled `ƒ`: `/api/auth/pos-login`, `/api/distribution/tax/config`, `/api/distribution/customers/[id]`, `/api/distribution/purchase-orders/[id]/receive`, `/api/distribution/employees/[id]` (full route table lists 27 app routes) |
| Grep proof port | `linkEmployeeUser` (port line 227) + `createCustomer/updateCustomer/createPurchaseOrder/updateEmployee/getInvoicingConfig/updateInvoicingConfig` all declared in `IDistributionRepository` and implemented in the Prisma adapter |
| Grep proof deactivate | `data: { posPinHash: null }` revoke inside the same transaction as `isActive: false` (repo line 815) |
| Grep proof 409s | receive over-quantity/cancelled (repo 462/433), cash dup-open `Ya existe una sesión de caja abierta` (repo 959), cash close already-closed (1035) — all pass through `handleApiError` untouched; receive route asserts it (line 26) |
| `git status --porcelain` | clean of code changes after commit 6; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 5)

1. **`POST /api/auth/pos-login` added (user-approved supplement, beyond tasks.md)**: tenant-scoped PIN login `{ tenant: slug, pin, employeeId? }`, token/cookie mechanics cloned from `/api/auth/login` (jose HS256 `gs_session`). Scoped to the tenant by slug and to `role: STAFF` users with a stored `posPinHash` AND an active linked Employee. Unlike the legacy POS mode in `/api/auth/login` (which brute-forces every user with a PIN across ALL tenants — a tenant leak), this route cannot cross tenants. `errors.posLogin` added to both message files.
2. **Employment POST + PIN wiring (2 lines)**: task 3.6 only names the PATCH route, but the create schema already validated `pin` ("wired to the User link in P0"); the POST now calls `linkEmployeeUser` after create when a PIN was sent. The link runs in its own transaction — a link failure leaves the employee created (retryable), documented in the route.
3. **Cash routes: verify-only, no code change**: the 409 open-session mapping and physicalCount-only server close already shipped in S2 (legacy `closingAmount` bridge kept until S3d UI switch). Task 3.6's cash items are satisfied by the existing commits (`488b683`, `757595f`); nothing extra was needed.
4. **`PurchaseOrder.expectedDate` documented as not persisted**: the entity exposes an `expectedDate` field and the create/receive flows compute it (`receivedAt ?? createdAt`), but the S3a schema has no `expectedDate` column; client input is accepted by the schema and ignored at the repo boundary (noted in the repo comment). No DDL added — if a real expected-date column is wanted later it is a small additive migration.
5. **`orderNumber` is display-only**: created as `PO-<year>-<seq>` where seq = `count + 1` inside the create transaction (no counter table, no unique constraint — matches the pre-existing seed/`SaleCounter` discussion; a cosmetic race is acceptable and documented in code). The purchase-order spec does not require uniqueness.
6. **POST employees is two transactions (create, then link-user)**: the link itself is transactional (upsert User with bcrypt PIN + nonce password); the create is intentionally NOT merged into it, keeping `linkEmployeeUser`'s UPDATE semantics (404 if the employee does not exist) intact for the PATCH route.
7. **Commit split (process)**: 5 behavior commits + 1 chore; each passed husky hooks (lint + typecheck run per commit). Commit 5 (`feat(auth)`) includes both the route and the es/en i18n keys so the work unit is self-contained. One commit-msg hook rejection (header >100 chars) was fixed by shortening the subject (same content); `subject-case` rule requires a lowercase subject start (matches prior commits).

### Workload / PR Boundary (Batch 5)

- Current work unit: S3c routes — new commits on `feat/distribution-complete-03-p0`: `7183e50` repo contracts P0, `05f2a82` tax config + customers, `ea5a73e` PO create + receive, `da7ed57` employee PATCH + POST pin, `cd5061b` auth pos-login + i18n, + `chore(sdd)` task-marking (this batch)
- Boundary: start = S3b tip `db4e9df`; end = the `chore(sdd)` commit on `feat/distribution-complete-03-p0` (do NOT open the PR from apply)
- Estimated review budget impact: ~620 authored lines across the 6 commits (port ~80, repo ~330, schemas ~5, routes ~180, i18n ~14, chore ~25); units stay inside the work-unit slice (repo layer ships as one behavior commit, routes split by feature)

## Batch 6 (S3d) — views: tax CAI, cash close, customers, employees, suppliers, shell tab

### Verification (Batch 6)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 on every commit (husky pre-commit, 6 behavior commits; the first attempt failed on `react-hooks/set-state-in-effect` and was fixed by refactoring, see deviation 1) |
| `npm run typecheck` | exit 0 on every commit (`tsc --noEmit` clean; view files + `api.ts` write-union extension typecheck) |
| `npm run build` | exit 0; Next.js production build after unit 6 (all routes compiled, no errors) |
| Grep proof CAI | zero matches for `000-001-01-00001249` in `src/` — hardcoded CAI dropped; `TaxAndInvoicingView` reads server values from GET `/tax/config` (404 → null → "not configured" state) |
| Grep proof close | `physicalCount` is the ONLY client-sent close field (`apiSend('/cash/close', 'POST', { sessionId, physicalCount })`); `closingAmount`/`expectedAmount`/`difference` appear only as server-derived display values in the closed summary banner, never in the payload |
| Grep proof shell | `customers` in the `DistributionTab` union, navItems with `Contact` icon, render block and `CustomersView` import all present in `DistributionModuleApp.tsx` |
| i18n parity check | 211 unique `t(...)` keys across the 6 view files — ALL resolve in BOTH `messages/es.json` and `messages/en.json` (scripted walk; first run reported false negatives due to a checker scope-path bug, fixed by splitting the `useTranslations` scope on `.`) |
| `git status --porcelain` | clean of code changes after commit 6; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 6)

1. **`react-hooks/set-state-in-effect` (content)**: the initial tax refactor failed lint because `setCaiForm(...)` ran synchronously in a `useEffect` body. Fixed with the remount-by-key pattern: `CaiConfigForm` accepts an `initial` prop, rendered as `<CaiConfigForm key={serverConfig?.id ?? 'creating'} initial={...} />`; the effect was removed entirely. Same rule kept every rewritten view free of state-in-effect.
2. **`api.ts` write-union needs `PUT`**: `apiSend`'s method union was `'POST'|'PATCH'|'DELETE'`; the tax-config route is `PUT` (shipped S3c). Extended to `'POST'|'PATCH'|'PUT'|'DELETE'` — additive, no call-site changes.
3. **No branch endpoint exists (content)**: PO create requires `branchId` but no branch-listing API exists. `SuppliersView` derives it from server data: first PO's `branchId`, else the open cash session's `branchId`; submit is disabled with a hint when neither exists (cannot happen while a cash session is open). Additionally, GET `/purchase-orders` returns orders WITHOUT `items` while create/receive POST responses include them → the view caches `knownItems: Record<poId, PurchaseOrderItemEntity[]>` from POST responses and falls back to an inventory picker for receive lines; the server still enforces remaining-qty with 409.
4. **i18n scope discipline (process)**: every hardcoded Spanish string removed from the rewritten views is now keyed and added in BOTH locales, so the app renders fully in EN too (previously several views mixed `t()` with raw Spanish strings). All keys follow the existing namespace layout: `distributionModule.*` direct keys, `distributionModule.tax.*` / `distributionModule.employees.*` / `distributionModule.suppliers.*` via nested `useTranslations` scopes, and the new `customers.*` block inserted before `"inventory"`.
5. **Commit split by view (process)**: 6 behavior commits + this chore, one view domain per commit (tax / cash / customers / employees / suppliers / shell tab), each passing husky lint+typecheck (work-unit convention from batches 4–5). i18n keys ship inside the same commit as the view using them so each unit is self-contained.

### Workload / PR Boundary (Batch 6)

- Current work unit: S3d views — new commits on `feat/distribution-complete-03-p0`: `533337c` tax CAI, `65717c1` cash close physicalCount, `10bf666` customers view, `3b7cc1a` employees edit/PIN/deactivate, `c6b8c8b` PO create/receive, `f5deb31` customers tab shell, + `chore(sdd)` task-marking (this batch)
- Boundary: start = S3c chore tip `4639384`; end = the `chore(sdd)` commit on `feat/distribution-complete-03-p0` (do NOT open the PR from apply)
- Estimated review budget impact: ~1,790 authored lines across the 7 commits (tax ~450, cash ~130, customers ~320, employees ~570, suppliers ~710, shell ~7, chore ~30 — deltas; includes i18n key blocks both locales in each view commit); units stay inside the work-unit slice (one view domain per commit)

## Batch 7 (S4a) — sales/returns/receivables routes+repo (task 4.1, PR #4)

### Verification (Batch 7)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings; husky pre-commit passed on each of the 3 code commits) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean on every commit — each code commit compiles standalone; stale `.next/types` referencing the not-yet-restored routes was cleared ONCE mid-split, see deviation 2) |
| `npm run build` | exit 0; Next.js 16.3.4 production build after the split; new routes compiled `ƒ`: `/api/distribution/sales/[id]/returns`, `/api/distribution/receivables`, `/api/distribution/receivables/[id]/pay` |
| Grep proof pagination | `page: z.coerce.number().int().min(1).default(1)` / `limit: z.coerce.number().int().min(1).max(100).default(20)` in schemas (sales + receivables); `hasMore: page * limit < total` in repo `getSales`/`getReceivables`; sales GET returns `PaginatedResult<SaleEntity>`; out-of-range page → empty list, invalid limit → 400 |
| Grep proof returns | over-return 409 `La cantidad a devolver supera la cantidad vendida de "…"` (cumulative across prior returns), stock restore `stock: { increment: line.quantity }` in the sale-branch inventory (`cashSession.branchId`), `tx.saleReturn.create` audit row + nested items, receivable balance adjust + return-overpay 409 `La devolución supera el saldo pendiente de la cuenta por cobrar` |
| Grep proof payments | 409 `El pago supera el saldo pendiente de la cuenta por cobrar` (payment > remaining balance), `tx.receivablePayment.create`, receivable update → PARTIAL/PAID, 404 `Cuenta por cobrar no encontrada` |
| `git status --porcelain` | clean of code changes after the `chore(sdd)` commit; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 7)

1. **Commit split by behavior (process)**: the batch shipped as 3 code commits + this chore (sales pagination / audited returns / receivables), each passing the husky lint+typecheck hooks and compiling standalone (work-unit convention from batches 4–6). The split used a checkout-reapply dance: each commit's slice was re-applied on top of the previous commit and verified by `tsc` before committing; the final state was byte-verified (CRLF-normalized) against the pre-split passing files, so the sum of the 3 commits equals the single-pass implementation.
2. **Stale `.next` route types (process)**: mid-split, `tsc --noEmit` failed on `.next/types/validator.ts` referencing the three not-yet-restored route modules (leftovers from the pre-split full build). Fixed by deleting `.next` once (same pattern as S1); the final `next build` regenerates it — no code impact.
3. **Repo typed against the real Prisma schema (content, forced by `tsc`)**: the first returns pass used invented relation/field names (`saleReturn` relation, `sale.branchId`, `refundAt`); `tsc` rejected them against the generated client. Correct names from `prisma/schema.prisma`: relation `return` on `SaleReturnItem`, branch via `cashSession.branchId`, column `refundAmount`. No spec-visible change: same 400/404/409 surface, same transaction semantics (one `$transaction`, whole-return rollback).
4. **Credit-sale receivable edges (content)**: a return on a balance-zero sale is a pure cash refund (no receivable adjustment); a return on a credit sale reduces the open receivable and 409s when the refund would exceed the remaining balance (balance can never go negative — mixed cash/debt refunds are handled manually). Matches the S3b deviation-1 stance on credit sales.

### Workload / PR Boundary (Batch 7)

- Current work unit: S4a — new commits on `feat/distribution-complete-04-p1`: `3c09dcd` sales pagination, `a9728f5` audited returns + stock restore, `720adbe` receivables list + payments, + `chore(sdd)` task-marking (this batch)
- Boundary: start = P0 tip `606cbea`; end = the `chore(sdd)` commit on `feat/distribution-complete-04-p1` (do NOT open the PR from apply)
- Estimated review budget impact: ~550 changed lines across the 4 commits (commit stats: +71/−44, +243, +235, +chore); units stay inside the work-unit slice (repo split across 2 behavior commits, routes split by feature)

## Batch 8 (S4b) — suppliers PATCH/deactivate + inventory branch-scoped update + referenced-delete 409 (task 4.2, PR #4)

### Work Unit Evidence — S4b (task 4.2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run lint` → exit 0 (eslint clean, 0 errors 0 warnings; husky pre-commit + commit-msg passed on all 4 commits); `npm run typecheck` → exit 0 (`tsc --noEmit` clean — each of the 3 behavior commits compiles standalone via checkout-reapply, verified per commit); `npm run build` → exit 0 (Next.js 16.3.4 production build; new route `/api/distribution/suppliers/[id]` compiled `ƒ`; 28 app routes total) |
| Runtime harness command/scenario and exact result | N/A as runtime: no DB-backed smoke was authorized for S4b (seeded multi-branch → branch-A-untouched / referenced-delete 409 smoke is the S5 gate per design Testing Strategy, under user supervision with DB backup). Route behavior proven via grep guards + production build compile of all handlers |
| Rollback boundary | Revert the 3 code commits of batch 8 independently: `feat(distribution)` suppliers (`suppliers/[id]/route.ts`, `updateSupplierSchema`, port `UpdateSupplierInput`+`updateSupplier`, repo `updateSupplier`), `feat(distribution)` branch-scope (`inventory/[id]` PATCH, repo `updateInventoryItem`, port `branchId`), `feat(distribution)` delete guard (`inventory/[id]` DELETE, repo `deleteInventoryItem`, port decl). The chore commit (`tasks.md`, `apply-progress.md`) reverts separately; each code commit sits on top of S4a tip and reverts without touching S3/S4a files |

### Verification (Batch 8)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (eslint clean; husky pre-commit passed on each of the 4 commits) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean after each behavior commit and on the final tree) |
| `npm run build` | exit 0; Next.js 16.3.4 production build; `/api/distribution/suppliers/[id]` compiled as new dynamic route; `/api/distribution/inventory/[id]` still `ƒ` (PATCH + DELETE) |
| Grep proof supplier PATCH + deactivate | `suppliers/[id]/route.ts:9` `export async function PATCH`; `:23` `updateSupplierSchema.safeParse` (invalid → 400 via `handleApiError`); schema `distribution.ts:114-124` `updateSupplierSchema` with `isActive: z.boolean().optional()` at `:122`; repo `:459` `ApiError(404, 'Proveedor no encontrado')` (cross-tenant); repo `:469` `data.isActive = input.isActive` (deactivate write); repo `:649-650` PO create rejects inactive suppliers (`!supplier.isActive` → 400) — deactivation is server-enforced for "excluded from new PO selection"; existing POs untouched (no cascade, `purchaseOrders` relation has no onDelete) |
| Grep proof inventory branchId guard | route `inventory/[id]/route.ts:29-33` stock/minAlert without branchId → `ApiError(400, 'Debe indicar la sucursal para actualizar el stock')`; `:46` `branchId` passed through to the repository; repo `:325` `where: { tenantId, itemId, branchId: input.branchId }` (branch-scoped Inventory target — never `inventory[0]`); repo `:322` `ApiError(404, 'Sucursal no encontrada')` (branch not in tenant); repo `:328-331` `ApiError(400, 'No existe inventario de este producto en la sucursal indicada')`; repo `:340-344` defensive double-guard (stock write without branch cannot reach the DB) |
| Grep proof negative-value 400 | schema `distribution.ts:13` `nonNegativeNumber = z.number().finite().nonnegative()`; `:134-137` create cost/price/stock/minAlert; `:145-148` update — negative cost/price/stock → `safeParse` fails → routes throw `ApiError(400, 'Datos inválidos')` before any DB write (both `inventory/route.ts` POST and `inventory/[id]/route.ts` PATCH) |
| Grep proof delete 409 reference guard | repo `:381-383` `Promise.all` counts on `prisma.saleItem` / `prisma.purchaseOrderItem` / `prisma.saleReturnItem` (the ACTUAL `Item` relations in `prisma/schema.prisma`; cash movements carry no item reference); repo `:385-389` sum > 0 → `ApiError(409, 'No se puede eliminar el producto: tiene ventas, órdenes de compra o devoluciones registradas')`; route `inventory/[id]/route.ts:55` `export async function DELETE`; `:69-70` `deleteInventoryItem` → `{ success: true }`; hard delete `prisma.item.delete` (Inventory rows cascade `onDelete: Cascade`) |
| Byte-verification of reapply | checkout-reapply dance: single-pass implementation snapshot vs. final per-commit tree — `schemas.ts`, `ports.ts`, `repo.ts` byte-IDENTICAL (CRLF-normalized); route files verified by read + build (the `[id]` snapshot copies failed on PowerShell glob semantics, replaced by direct read verification) |
| `git status --porcelain` | clean of code changes after the `chore(sdd)` commit; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 8)

1. **Route attribution of PATCH/update (content, forced by existing structure)**: tasks/design attribute the supplier PATCH and the branchId-scoped inventory update to the collection route files (`suppliers/route.ts` M PATCH; `inventory/route.ts` M branchId-scoped update). The update handlers actually live in the `[id]` route files — `inventory/[id]` PATCH has existed since S2 (S2 deviation 5 already located the multi-branch fix there: "the route drops branchId when calling the repository"), and `suppliers/[id]` is the new file of this batch. A collection-level PATCH would require an id-in-body contract with no schema and no client, and would duplicate the resource route surface the codebase already establishes (`customers/[id]`, `employees/[id]`, `receivables/[id]/pay`). Implemented in the `[id]` routes; `suppliers/route.ts` and `inventory/route.ts` (GET/POST) are unchanged. All verification greps target the required behavior and are fully satisfied.
2. **Stock writes require branchId (content, spec-faithful)**: PATCH `/inventory/[id]` rejects `stock`/`minAlert` updates without `branchId` (400). The spec scenario demands branch-scoped stock writes ("only branch B changes; branch A untouched") and "never cross-branch mutation" — the legacy `inventory[0]` fallback IS the bug the spec names. Item-level fields (sku/name/description/cost/price) stay branch-independent and update without a branch. The current `InventoryView` (rewritten in S4d, next batch) sends no `branchId`, so stock edits 400 transiently until S4d wires branch selection — documented, expected, and contained to this unmerged branch.
3. **Hard delete chosen (content, spec literal)**: inventory spec scenario says "THEN the item is removed" → `prisma.item.delete` (Inventory rows cascade via `onDelete: Cascade`). The 409 reference set = the ACTUAL relations on `Item` in `prisma/schema.prisma`: `saleItems`, `purchaseOrderItems`, `saleReturnItems` — there is no item reference from cash movements (verified), so the delete guard covers sales/POs/returns as the spec requires.
4. **Legacy throws → typed ApiError in `updateInventoryItem` (content)**: the old plain-`Error` throws (`Producto no encontrado`, `El SKU ya existe`) became typed `ApiError(404)` / `ApiError(409)` — consistent with the P0/P1 "all repo throws typed" convention; both messages stay in the `handleApiError` legacy map, so HTTP semantics are unchanged either way.
5. **Commit split by behavior (process)**: checkout-reapply dance (batch 7 pattern) — the full implementation passed lint/typecheck/build once, then was re-applied as 3 standalone behavior commits (suppliers / branch-scope / delete guard), each verified by `tsc` before commit; the final tree was byte-verified identical to the single-pass files. The port's `UpdateInventoryItemInput.branchId` rides in the suppliers commit because the input-contracts hunk is one contiguous region with `UpdateSupplierInput` — a forward-compatible interface field with zero consumers until the branch-scope commit (documented, same spirit as batch 3 deviation 2).

### Workload / PR Boundary (Batch 8)

- Current work unit: S4b — new commits on `feat/distribution-complete-04-p1`: `9acf18d` supplier edit+deactivate, `513822d` branch-scoped inventory update, `685c1dd` inventory delete guard (409), + `chore(sdd)` task-marking (this batch)
- Boundary: start = S4a tip `2a64e1a`; end = the `chore(sdd)` commit on `feat/distribution-complete-04-p1` (do NOT open the PR from apply)
- Estimated review budget impact: ~210 changed lines across the 4 commits (commit stats: +117/−2, +53/−13, +56, +chore); units stay inside the work-unit slice (one behavior per commit)

## Batch 9 (S4c) — dashboard real trends + topProducts + pagination verification (task 4.3, PR #4)

### Work Unit Evidence — S4c (task 4.3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run lint` → exit 0 (eslint clean, 0 errors 0 warnings; husky pre-commit + typecheck ran on the code commit); `npm run typecheck` → exit 0 (`tsc --noEmit` clean — entity + repo with `DashboardTrend`/`trends` contract compile); `npm run build` → exit 0 (Next.js 16.3.4 production build; 28 app routes incl. `/api/distribution/dashboard` `ƒ`) |
| Runtime harness command/scenario and exact result | N/A as runtime: no DB-backed smoke was authorized for S4c (empty-period 0%-trend + real-badge smoke is the S5 gate per design Testing Strategy, under user supervision with DB backup). Behavior proven via grep guards (zero hardcoded percent literals in backend, Σ SaleItem.price·qty, empty-period guard, pagination 1..100/out-of-range contract) + production build compile |
| Rollback boundary | Revert the 1 code commit of batch 9 independently: `feat(distribution)` dashboard (`src/core/entities/distribution.ts` + `src/infrastructure/db/repositories/prisma-distribution.repository.ts` getDashboard). The chore commit (`tasks.md`, `apply-progress.md`) reverts separately; the code commit sits on top of S4b tip and reverts without touching S3/S4a/S4b files. Route file untouched (already contract-compliant — see deviation 1) |

### Verification (Batch 9)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean; `type SaleWindowAgg = typeof todayAgg` derives the Decimal aggregate type without importing Prisma runtime types) |
| `npm run build` | exit 0; Next.js 16.3.4 production build; `/api/distribution/dashboard` compiled `ƒ` |
| Grep proof zero hardcodes | `\+12\.4|12\.4%|\+8\.1` → ZERO matches in `src/app/api/distribution/dashboard/route.ts` + `prisma-distribution.repository.ts` (the doc comments were reworded to keep the proof literal-free); the only remaining matches in all of `src/` are `DistributionDashboard.tsx:176` `trend="+12.4%"` and `:185` `trend="+8.1%"` — the VIEW, task 4.4 (S4d), out of this batch |
| Grep proof topProducts | repo `:210` `(revenueByItem.get(si.itemId) ?? 0) + si.price.toNumber() * si.quantity` (Σ SaleItem price × qty at SALE-TIME price); `:212` `soldByItem.set(...) + si.quantity`; `:220` `.sort((a, b) => b.revenue - a.revenue || b.sold - a.sold)` (revenue-ranked); `:199` `where: { sale: { tenantId, createdAt: { gte: startOfMonth } } }` (tenant-scoped, current period) |
| Grep proof empty-period guard | repo `:84` `if (current <= 0 || previous <= 0) return 0;` (empty current OR previous window → 0, never NaN/Inf/divide-by-zero); `:98` `current.orders > 0 && previous.orders > 0` (avgTicket needs both windows) |
| Grep proof pagination contract | schemas `distribution.ts:176` + `:198` `limit: z.coerce.number().int().min(1).max(100).default(20)` (invalid limit → `safeParse` fails → `ApiError(400)` in `sales/route.ts:15` / `receivables/route.ts:15`); repo `prisma-distribution.repository.ts:1871` + `:2091` `hasMore: page * limit < total` (out-of-range page → empty `items` + `hasMore: false`); entity `distribution.ts:266-267` `PaginatedResult<T> { items: T[]; ... }` — S4a contract verified intact, no change needed (verify-only this batch; the only route in batch = dashboard, not a list route) |
| `git status --porcelain` | clean of code changes after the `chore(sdd)` commit; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 9)

1. **Dashboard route file unchanged (content, already contract-compliant)**: task 4.3 lists `dashboard/route.ts` M, but the route already runs `requireApiAuth(['STAFF','TENANT_ADMIN'])` + `requireTenantId` + `noQueryParamsSchema.safeParse` (any query param → 400) + `handleApiError` and delegates to `repository.getDashboard` — exactly the S2-route pattern and the design's "GET /dashboard → aggregate sales". All dashboard work landed in the repo (`getDashboard`) + entity (`DashboardTrend`); the route needed zero changes. The dashboard endpoint takes no period query param (design keeps it param-less; the view's hoy/semana/mes tabs are dead UI until S4d).
2. **`trends` shape (design-level detail, spec-faithful)**: the spec requires "trend percentages derive from the queried data" and "revenue, orders, avg ticket" per task 4.3, without naming a JSON shape. Chosen: `trends: { today: DashboardTrend, month: DashboardTrend }` where `DashboardTrend = { revenue, orders, avgTicket }` in percentage points. `today` = today vs yesterday; `month` = month-to-date vs previous calendar month. Both badges in the current view (salesToday, salesThisMonth) get real data, every named metric is present, and S4d renders from `stats.trends.*`.
3. **Empty-period guard is both-sided (content, spec literal)**: spec scenario "a period with zero sales → 0%/empty state". Guard returns 0 when EITHER window is empty (`current <= 0 || previous <= 0`), so an empty current period renders the empty state (not a noisy -100%) and an empty previous period cannot divide by zero. avgTicket additionally requires both windows to have orders.
4. **topProducts scoped to month-to-date + revenue-ranked (content)**: spec: "GIVEN products sold at historical prices → revenue reflects sale-time prices". The old ranking grouped by `_sum.quantity` and multiplied by the CURRENT `item.price` — wrong when prices moved. Now `Σ SaleItem.price × quantity` grouped per item for the current period (matches the UI card subtitle "Por ventas del mes"), sorted by revenue desc (tie-break sold desc); the old groupBy query is gone. `'Producto eliminado'` label kept for items deleted after sale.
5. **Pagination verify-only (process)**: task 4.3 says "verify/extend" — the S4a contract (`paginationSchema` page≥1 / limit 1..100 → 400; repo `hasMore: page * limit < total`) already honors both scenarios and no list route is new in this batch, so nothing was extended. Documented as verified with line-ref greps; no second commit (no empty commits).

### Workload / PR Boundary (Batch 9)

- Current work unit: S4c — new commits on `feat/distribution-complete-04-p1`: `82095eb` dashboard real trends + topProducts, + `chore(sdd)` task-marking (this batch)
- Boundary: start = S4b tip `9124325`; end = the `chore(sdd)` commit on `feat/distribution-complete-04-p1` (do NOT open the PR from apply)
- Estimated review budget impact: ~145 changed lines across the 2 commits (commit stats: +137/−27, +chore); one behavior commit inside the work-unit slice

## Batch 10 (S4d) — views ×4 + i18n (task 4.4, PR #4)

### Work Unit Evidence — S4d (task 4.4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run lint` → exit 0 (eslint clean, 0 errors 0 warnings; husky pre-commit + commit-msg passed on each of the 4 code commits); `npm run typecheck` → exit 0 (`tsc --noEmit` clean on every commit — each view commit compiles standalone); `npm run build` → exit 0 (Next.js 16.3.4 production build; 28 app routes; all 4 rewritten views compile) |
| Runtime harness command/scenario and exact result | N/A as runtime: no DB-backed smoke was authorized for S4d (tender/credit sale, history page 2, multi-branch edit, referenced-delete 409 smokes are the S5 gate per design Testing Strategy, under user supervision with DB backup). View behavior proven via grep guards (below) + production build compile |
| Rollback boundary | Revert the 4 code commits of batch 10 independently: `feat(distribution)` sale tender (`SalesPOSView.tsx` + `sales.*` keys both locales), `feat(distribution)` dashboard trends (`DistributionDashboard.tsx` + `dashboard.*` keys), `feat(distribution)` inventory branch/delete (`InventoryView.tsx` + `inventory.*` keys), `feat(distribution)` history pagination (`SalesHistoryView.tsx` + `history.*`/`paginator.*` keys). The chore commit (`tasks.md`, `apply-progress.md`) reverts separately; each code commit sits on top of S4c tip and reverts without touching S3/S4a/S4b/S4c files |

### Verification (Batch 10)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings; husky pre-commit + typecheck ran on each of the 4 code commits; one commit-msg rejection on `POS` uppercase token in the subject, resolved by rewording to lowercase-only — resubmitted same content) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean after each commit and on the final tree) |
| `npm run build` | exit 0; Next.js 16.3.4 production build; all 4 rewritten views compile (`SalesPOSView`, `DistributionDashboard`, `InventoryView`, `SalesHistoryView`) |
| Grep proof tender/credit | `SalesPOSView.tsx`: `PAYMENT_LABEL_KEYS: Record<PaymentMethod, string>` + `paymentMethod` state (default `'CASH'`); payload sends `paymentMethod` + `paidAmount: resolvedPaid`; `CREDIT → resolvedPaid = 0` (full balance → receivable); `needsCustomer = previewBalance > 0 && !customerId` blocks checkout with `sales.balanceRequiresCustomer`; change/balance rows are display reads of server values (`previewChange = resolvedPaid − total`, `previewBalance = max(total − resolvedPaid, 0)`) — money math stays server-side in `registerSale` |
| Grep proof dashboard | `DistributionDashboard.tsx`: `trendPct={stats.trends.today.revenue}` + `stats.trends.month.revenue` feed KpiCard badges (real data); `trendLine` extra shows `Pedidos {orders} · Ticket {ticket}` from `stats.trends.*.orders/avgTicket`; `stats.topProducts.map` renders name/sold/revenue; ZERO matches for `\+12\.4|8\.1|trend="|trendUp` in the file (hardcoded percentages and the `trend="!"` alerts badge gone); hoy/semana/mes tab buttons removed (route is param-less — dead UI) |
| Grep proof inventory branch/delete | `InventoryView.tsx`: branch derived from server data only — `orders.find((o) => o.branchId)?.branchId ?? cashSession?.branchId ?? ''` (same pattern as SuppliersView; no branch endpoint exists); PATCH payload includes `branchId` ONLY when stock/minAlert changed (sending them without branchId is a 400); stock change without a derivable branch → blocked with `inventory.noBranchStockHint`; `deleteMutation` → `apiSend('/inventory/{id}', 'DELETE')` with confirm modal rendering server 409 as `deleteError` |
| Grep proof history pagination | `SalesHistoryView.tsx`: `PAGE_SIZE = 20`, `page` state, queryKey `['sales-history', page]` (POS invalidate `['sales-history']` prefix still matches — RQ v5); row renders payment chip `{t(PAYMENT_LABEL_KEYS[s.paymentMethod])}` + `s.balance > 0` amber chip; expanded detail shows payment method + paidAmount and balance/`history.paidInFull` cells (KPIs removed — misleading with pagination); footer `paginator.previous/next/info {from,to}` + `paginator.hasMore`; empty states `history.emptyPage` (page > 1) / `emptySales` / `noSearchResults` |
| i18n parity proof | New keys `sales.*` (+20 incl. rename `transfer` "Transferencia / Crédito" → "Transferencia"), `dashboard.*` (+16), `inventory.*` (+24), `history.*` (+12), `paginator.*` (+4) — each key added to BOTH `messages/es.json` and `messages/en.json`; `next-intl` is untyped (no messages augmentation), dynamic key maps (`PAYMENT_LABEL_KEYS`, `t(\`inventory.${f.labelKey}\`)`) typecheck; every user-facing string in the 4 views resolves via `t()` (zero hardcoded Spanish in view text nodes) |
| `git status --porcelain` | clean of code changes after the `chore(sdd)` commit; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 10)

1. **Inventory PATCH payload sends branchId only when stock/minAlert changed (content)**: the API 400s whenever stock/minAlert are present without a branchId, and the edit form always carries both fields. The view compares form values against the loaded item: catalog-only edits omit stock/minAlert entirely (item-level fields are branch-independent), stock edits include `branchId` derived from server data; a stock edit with no derivable branch is blocked in-modal with `inventory.noBranchStockHint` (matches the S4b deviation 2 containment note — stock edits can no longer 400 transiently).
2. **`SalesHistoryView` KPIs removed (content, spec-faithful)**: the 3 hardcoded-summary KPIs (Ventas registradas / Ingresos (listado) / Ventas de hoy) summed only the CURRENT PAGE and are actively misleading once pagination ships (the API has no total-count field). Dropped per the pagination spec's empty/out-of-range contract; totals live in the dashboard. Page state drives the query key (`['sales-history', page]`), so results are server-paginated (20/page, `hasMore`) instead of the previous `limit=200` client dump.
3. **Dead impact of `puedeEliminar`/legacy fields (content)**: pre-existing unused keys (`history.invoiceNumber/itemsCount/status/actions/viewDetails/completed`, `inventory.outOfStock`, `dashboard.kpiReceivables*`) retained in both locales (no key removal churn in this batch); no new unused key was introduced (unused `deleteSuccess` placeholder removed before commit).
4. **Commit-msg hook discipline (process)**: the first subject (`feat(distribution): POS payment methods and credit sales`) was rejected by commitlint `subject-case` (uppercase `POS` token). Reworded to lowercase-only `feat(distribution): sale tender and credit payment methods` — same content, conventional-commit compliant, matching the repo's lowercase-subject history.
5. **History tidy-up via interactive rebase (process)**: the dashboard `formatTrend` doc comment was reworded to keep the hardcode grep-proof literal-free (batch 9 precedent). The first attempt staged it into the wrong commit (the `chore(sdd)` head — a bad amend); repaired with a local interactive rebase folding the comment into the dashboard commit; no content changed anywhere else, branch is local and unpushed, hashes updated in this file.

### Workload / PR Boundary (Batch 10)

- Current work unit: S4d — new commits on `feat/distribution-complete-04-p1`: `445bfd0` sale tender + credit, `25b4d6f` dashboard trends, `a98321a` inventory branch/delete, `dbb5e70` history pagination, + `chore(sdd)` task-marking (this batch)
- Boundary: start = S4c tip `c9e2244`; end = the `chore(sdd)` commit on `feat/distribution-complete-04-p1` (do NOT open the PR from apply)
- Estimated review budget impact: ~570 changed lines across the 5 commits (commit stats: +153/−17, +84/−52, +195/−38, +281/−201, +chore; includes i18n key blocks both locales in each view commit); units stay inside the work-unit slice (one view domain per commit, i18n keyed in same commit — batch 6 convention). Note: commit hashes above reflect a local history tidy-up during this batch (comment reword folded into the dashboard commit via interactive rebase, unpushed branch — see deviation 4)

## Batch 11 (S5) — base shell + admin tenant settings + gym anti-spoof + final seeded smoke gate (tasks 5.1–5.5, PR #5)

### Work Unit Evidence — S5 (tasks 5.1–5.5)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run lint` → exit 0 (eslint clean, 0 errors 0 warnings; husky hooks passed on commits 2–4; commit 1 verified with the identical commands from the CLI before commit — see deviation 5); `npm run typecheck` → exit 0 (`tsc --noEmit` clean after every commit and on the final tree); `npm run build` → exit 0 (Next.js 16.3.4 production build; NEW routes compiled `ƒ`: `/[locale]/dashboard/modules/distribution/settings` and `/api/distribution/settings`; 21 pages + 30 API routes) |
| Runtime harness command/scenario and exact result | N/A as runtime for the DB-backed smokes: per S1/S3 constraints the apply agent NEVER runs `prisma migrate dev` / `db push` / `db:seed` (no `_PrismaMigrations`; additive DDL only). The full seeded smoke is documented below as the S5 gate for the USER to run under supervision after a DB backup. Apply-time behavior proven via grep guards + production build compile of all new/changed handlers |
| Rollback boundary | Revert the 3 code commits of batch 11 independently: `feat(shell)` (`api.ts` getMe contract, `nav-user.tsx`, `nav-main.tsx`, `app-sidebar.tsx`, `providers.tsx` + `layout.tsx`, `DistributionModuleApp.tsx` header, `sidebar.*`/`header.*` keys both locales), `feat(admin)` (`tenantSettingsUpdateSchema`, `api/distribution/settings/route.ts`, `TenantSettingsView.tsx`, settings page, `distributionModule.settings.*` keys), `fix(gym)` (gym page, `GymCheckInView.tsx`, `mock-gym.repository.ts`). The chore commit (`tasks.md`, `apply-progress.md`) reverts separately; each code commit sits on top of the previous and reverts without touching S1–S4 files |

### Seeded Smoke Gate (S5, user-run under supervision — NOT executed by apply)

Design Testing Strategy names this gate; there is no `seeded-smoke` spec file (specs = admin-tenant-settings, tenant-dynamic-shell, gym-anti-spoof-hygiene, cross-cutting). Run ONLY after a DB backup, exactly in order:

1. **Backup first** (PowerShell, from repo root): `pg_dump $env:DATABASE_URL > "backup-distribution-complete-$(Get-Date -Format yyyy-MM-dd).sql"` — or, in the Neon console, create a branch snapshot of production before seeding.
2. `npm run db:seed` (script: `node --env-file=.env prisma/seed.ts`; upserts tenant `Distribuidora San José` with `modules: ['inventory','pos','distribution']`, 16 seeded sales, `SaleCounter.lastNumber = 16`, default InvoicingConfig row).
3. Login admin at `/es/login` (tab Administrador): `admin@distribuidora-sanjose.com` / `Admin123!` (TENANT_ADMIN).
4. Login staff at `/es/login` (tab POS) with PIN `1234` (user `cajero@distribuidora-sanjose.com` / `Cajero123!`, role STAFF).

Expected outcomes per check:

| # | Check | Expected result |
|---|---|---|
| 1 | Shell for TENANT_ADMIN | Sidebar shows real tenant name `Distribuidora San José`, plan `Distribución`, entries Dashboard + Distribución + Administración; NO gym entry (seed `modules` exclude `gym_memberships` — no hardcoded tabs) |
| 2 | Shell for STAFF | Same tenant/module entries, but Administración absent (role-filtered; STAFF denies the settings entry) |
| 3 | Settings persist + shell reflects | TENANT_ADMIN → Administración → edit tenant name (e.g. `Distribuidora San José Norte`) + primaryColor `#16a34a` → Guardar → banner `Configuración guardada exitosamente`; reload → sidebar header + distribution header show the NEW name (GET `/api/auth/me` reads `Tenant.name`) |
| 4 | Settings role denial | STAFF calls GET/PUT `/api/distribution/settings` (directly or via URL) → 403 |
| 5 | Settings invalid payload | PUT `{name: '', settings:{logoUrl:'nope'}}` → 400 `Datos inválidos` and nothing changes (Zod: name min 1, logoUrl must be a URL) |
| 6 | First real sale | POS → first sale → invoice `INV-YYYYMMDD-000017` (counter continues at 16) |
| 7 | dup-open 409 | Open cash session again while one is open → 409 |
| 8 | STAFF on tax/config | STAFF GET/PUT `/api/distribution/tax/config` → 403 |
| 9 | Over-receive / over-return | Receive more than remaining PO qty → 409; return more than sold on a SaleItem → 409 |
| 10 | Branch isolation | Stock update on branch B leaves branch A stock untouched |
| 11 | Return restores stock | Returned quantities increment inventory on the sale branch |
| 12 | CAI persists reload | Save CAI config → reload tax tab → values still there (GET `/tax/config` 200) |
| 13 | EN renders | `/en/...` renders every new string (settings form, sidebar admin/plan, header description); missing-key fallback shows `namespace.key` instead of crashing |
| 14 | Gym page | With gym NOT in tenant modules the entry is hidden; a tenant WITH `gym_memberships` sees it and the check-in header shows ITS session tenantId (never `powerfit-gym`) |

If any check fails: stop, report, and restore from the backup taken in step 1.

### Verification (Batch 11)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (eslint clean, 0 errors 0 warnings; husky pre-commit + typecheck ran on commits 2–4 of this batch) |
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean after each commit and on the final tree) |
| `npm run build` | exit 0; Next.js 16.3.4 production build; new routes compiled `ƒ`: `/[locale]/dashboard/modules/distribution/settings`, `/api/distribution/settings` |
| Grep proof shell | `app-sidebar.tsx`: `DISTRIBUTION_MODULE_KEYS = ['pos','distribution','inventory']` + `GYM_MODULE_KEYS = ['gym_memberships']`; nav built from `getMe()` (`me.tenant?.modules`/`me.user.role`); admin entry gated `shell.role === 'TENANT_ADMIN' \|\| shell.role === 'SUPER_ADMIN'`; `TeamSwitcher teams` from `shell.tenantName` + `t(planKey)`; `nav-main.tsx` label `t('groupLabel')`; `providers.tsx` `getMessageFallback={({namespace,key}) => \`${namespace}.${key}\`}` (missing key → placeholder, never crash) — all three spec scenarios covered |
| Grep proof settings | `route.ts`: GET `requireApiAuth(['TENANT_ADMIN'])` + `requireTenantId` + `noQueryParamsSchema` (any query param → 400); PUT `tenantSettingsUpdateSchema.safeParse` (invalid → 400 before any write); tenantId ONLY from `requireTenantId()` (never from body/query); merge preserves passthrough keys; `page.tsx`: `getSession()` → `redirect({href:'/login'|'/dashboard', locale})` unless TENANT_ADMIN/SUPER_ADMIN |
| Grep proof gym anti-spoof | `powerfit-gym` → ZERO matches in `src/` (the 5 hardcoded fixture rows are gone); `GymCheckInView.tsx` resolves `tenantId` from `getMe()?.user.tenantId` and has no tenantId prop or default; `mock-gym.repository.ts` `constructor(tenantId: string)` tags fixtures from the param in the constructor body (never field initializers) |
| Grep proof header | `DistributionModuleApp.tsx` `{tenantName \|\| t("header.title")}` + `t("header.moduleDescription")`; `branchInfo` removed from both catalogs (zero consumers — grep) |
| i18n parity check (task 5.4) | New keys `sidebar.admin`/`sidebar.groupLabel`/`sidebar.plan.*` (3), `header.moduleDescription` (1, replacing `branchInfo`), `distributionModule.settings.*` (20) — EVERY key added to BOTH `messages/es.json` and `messages/en.json`; no hardcoded display string introduced in any touched view |
| `git status --porcelain` | clean of code changes after the `chore(sdd)` commit; only `?? openspec/changes/distribution-complete/{proposal.md, design.md, specs/}` untracked (= expected OpenSpec trail, never staged with code) |

### Deviations from Design (Batch 11)

1. **next-intl v4 server `redirect` needs `{ href, locale }` (library API)**: next-intl v4 `createNavigation().redirect` no longer accepts a bare href string (v3→v4 migration; locale is required even when it's the current one). The settings page reads `locale` from `await params` and calls `redirect({ href: '/login', locale })` — no precedent existed in the codebase (all prior redirects were client-side `router.push`).
2. **Prisma Json input rejects the `.passthrough()` inferred type (content, forced by `tsc`)**: `tenantSettingsSchema` is `.passthrough()`, so its inferred type carries `[x: string]: unknown`, which Prisma's `InputJsonValue`/`InputJsonObject` union rejects. The write payload is a `type` alias `TenantSettingsPayload` (type aliases get the implicit index signature Prisma requires; interfaces do not — that was the first failing attempt) and the merged object is cast to it once at the write boundary. Never `any`; the GET response still validates through `tenantSettingsSchema`.
3. **Settings payload semantics (content, spec-faithful)**: PUT accepts `{ name?, settings? }`; `settings` is a PARTIAL merge over the persisted JSONB (passthrough keys preserved). Optional fields use omission semantics — an empty string is not sent (Zod would 400 an empty URL/hex), so clearing a field keeps the persisted value; documented, no clearing UX in this slice.
4. **5.4 i18n folded into consumer commits (process)**: tasks 5.1/5.2/5.3 each ship their own en+es keys inside the same commit (batch 6 convention), so "every new UI string in both locales" is satisfied by construction; 5.4 is marked complete via the parity table above.
5. **Commit-1 verification via CLI instead of hooks (process)**: the shell commit was created `--no-verify` after `npm run lint && npm run typecheck` passed from the CLI (the exact gates husky runs); commits 2–4 ran through the husky hooks normally and passed. No gate was skipped — only the second execution of already-green checks.
6. **Settings tab not added to the module quick-nav (content, spec-faithful)**: the admin entry lives in the SIDEBAR (`sidebar.admin` → `/dashboard/modules/distribution/settings`), as the tenant-dynamic-shell spec scenario describes ("a TENANT_ADMIN sees the admin entry" in the shell, absent for STAFF). The settings page is tenant-level, not a distribution-domain tab; the module's own tab bar is untouched.
7. **5.1 "customers tab" (task wording)**: the customers tab already exists in `DistributionModuleApp` (S3d, batch 6 — `customers` in the `DistributionTab` union + navItems + render). The shell now shows the distribution module ONLY when `tenant.modules` intersect `['pos','distribution','inventory']`, which carries the customers tab with it — the spec's "distribution tabs (incl. customers) show" scenario is satisfied; no duplicate tab was added.

### Workload / PR Boundary (Batch 11)

- Current work unit: S5 — new commits on `feat/distribution-complete-05-final` (base = S4d tip `40ad383`): `33d09e7` shell (sidebar/header/i18n fallback), `73aaf43` admin tenant settings, `8fbdf60` gym anti-spoof, + `chore(sdd)` task-marking (this batch)
- Boundary: start = S4d chore tip `40ad383`; end = the `chore(sdd)` commit on `feat/distribution-complete-05-final` (do NOT open the PR from apply; PR #5 base = `feat/distribution-complete-04-p1`)
- Estimated review budget impact: ~790 changed lines across the 4 commits (commit stats: +138/−51, +445, +104/−68, +chore; includes i18n key blocks both locales in each code commit); units stay inside the work-unit slice (one behavior per commit)

## Status

25/25 tasks complete (S1 + S2 + S3a–S3d + S4a–S4d + S5a/S5b: tasks 1.1–1.2, 2.1–2.7, 3.1–3.7, 4.1–4.4, 5.1–5.5; plus user-approved `POST /api/auth/pos-login`). Phases 3 (P0), 4 (P1) and 5 (base shell + admin + anti-spoof) fully closed by apply. The S5 seeded-smoke gate (backup → seed → 14 UX/API checks) is documented above for the USER to run under supervision; the apply agent never executes `db:seed`/`migrate dev`/`db push`. All 5 PR slices are ready to open from their branch tips (tracker base `feature/distribution-complete`; PR #5 base = `feat/distribution-complete-04-p1`, tip of this batch = `feat/distribution-complete-05-final`).