# Apply Progress: distribution-complete — S1 F0 (PR #1) + S2 Security Foundation (PR #2) + S3a P0 data layer (PR #3)

- **Change**: distribution-complete
- **Batch 1**: Phase 1 S1 F0 Environment, tasks 1.1 + 1.2 (PR #1, branch `feat/distribution-complete-01-f0`)
- **Batch 2**: Phase 2 S2 Security Foundation, tasks 2.1–2.7 (PR #2, branch `feat/distribution-complete-02-security`, base = PR #1 branch)
- **Batch 3**: Phase 3 S3a (P0 data layer), tasks 3.1 + 3.2 (PR #3, branch `feat/distribution-complete-03-p0`, base = PR #2 branch) — this report
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

### Phase 3 — S3 P0 (sale-blocking) (batch 3: S3a only)

- [x] 3.1 `prisma/schema.prisma` M + `prisma/migrations/20260912120000_distribution_complete/migration.sql` C: additive DDL — Sale.paymentMethod/paidAmount/balance (nullable-agnostic: `NOT NULL DEFAULT` so existing rows survive), PurchaseOrderItem.receivedQty, InvoicingConfig (tenantId `@unique`, 1 per tenant), Receivable + ReceivablePayment, SaleReturn + SaleReturnItem; `@@unique([tenantId, invoiceNumber])` on Sale verified ALREADY present (migration 20260910070000_invoice_correlative), NOT re-applied; `npx prisma generate` → exit 0 [S3a]
- [x] 3.2 `src/core/entities/distribution.ts` M: `PaymentMethod`/`ReceivableStatus` unions, SaleEntity.paymentMethod/paidAmount/balance, PurchaseOrderItemEntity.receivedQty, InvoicingConfigEntity, ReceivableEntity, ReceivablePaymentEntity, SaleReturnEntity, SaleReturnItemEntity, `PaginatedResult<T>` {items/page/limit/hasMore}; `src/core/ports/distribution-repository.port.ts` M: `CloseCashSessionInput {sessionId, physicalCount}` (expected/difference no longer client input), `RegisterSaleInput.paymentMethod/paidAmount`, input contracts CreateCustomer/UpdateCustomer/CreatePurchaseOrder/ReceivePurchaseOrder/UpdateEmployee/UpdateInvoicingConfig; NO `any` [S3a]
- [ ] 3.3–3.7 pending (S3b–S3d: repo tx/close/409 + seed, routes, views) — next batch

### Pending (not part of this batch)

- [ ] 3.3–3.7 Phase 3 S3b–S3d (repo tx + server-side close + seed; routes; views) [S3b–S3d]
- [ ] 4.1–4.4 Phase 4 S4 P1 (100%) [S4a–S4d]
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

- **Environment lock (resolved)**: the first `npx prisma generate` failed with `EPERM: rename query_engine-windows.dll.node` because a `next dev` server was running and held the Prisma engine DLL memory-mapped (Windows). The dev server tree was stopped (`taskkill /PID 29948 /T /F` after user authorization), then `prisma generate` succeeded. The dev server must be restarted to pick up the regenerated client + new schema.
- None blocking for S2. Compatibility reads confirmed: `SuppliersView`/`EmployeesView` send `''` for optional fields → `nullableEmail`/`nullableText` accept and preserve empty strings (no regression); `SalesPOSView` sale payload unchanged (payment fields optional); POS `/tax` GET stays STAFF-accessible so STAFF checkout tax computation is unaffected.

## Workload / PR Boundary

- Mode: chained PR slice #3 (feature-branch-chain; PR #3 base = `feat/distribution-complete-02-security`; tracker `feat/distribution-complete`; later PRs base = immediate previous PR branch)
- Current work unit: S3a P0 data layer — commits on `feat/distribution-complete-03-p0`: `feat(db)` (schema + migration), `feat(core)` (entities + ports + consumer adaptation), `chore(sdd)` (task-marking)
- Boundary: start = `feat/distribution-complete-02-security` tip `4256d2d`; end = the `chore(sdd)` commit on `feat/distribution-complete-03-p0` (do NOT open the PR from apply)
- Estimated review budget impact: ~380–420 changed lines across the 3 commits (schema+DDL ~230, core/ports+adaptations ~160) — S3a was forecast at ~330 est.; PR #3 remains the planned slice, pending user confirmation to open the PR.

## Status

11/25 tasks complete (S1 + S2 + S3a: tasks 1.1–1.2, 2.1–2.7, 3.1–3.2). Ready for next batch: S3b (tasks 3.3–3.4, repo transaction logic + seed) on its own child PR branch based on `feat/distribution-complete-03-p0`.