# Apply Progress: distribution-complete — S1 F0 Environment (PR #1) + S2 Security Foundation (PR #2)

- **Change**: distribution-complete
- **Batch 1**: Phase 1 S1 F0 Environment, tasks 1.1 + 1.2 (PR #1, branch `feat/distribution-complete-01-f0`)
- **Batch 2**: Phase 2 S2 Security Foundation, tasks 2.1–2.7 (PR #2, branch `feat/distribution-complete-02-security`, base = PR #1 branch) — this report
- **Mode**: Standard (no test runner configured; gate = lint / typecheck / build + grep guards + 2.1 early-gate verdict)
- **Chain**: feature-branch-chain — PR #1 base = tracker `feat/distribution-complete`; PR #2 base = PR #1 branch `feat/distribution-complete-01-f0`; only tracker merges to main. Do NOT open PRs from apply.

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

### Pending (not part of this batch)

- [ ] 3.1–3.7 Phase 3 S3 P0 (sale-blocking) [S3a–S3d]
- [ ] 4.1–4.4 Phase 4 S4 P1 (100%) [S4a–S4d]
- [ ] 5.1–5.5 Phase 5 S5 Base Shell + Admin [S5a/S5b]

## Verification Evidence (branch `feat/distribution-complete-02-security`, post-edits)

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

1. **`idParamSchema` amend (process)**: the export feeding the two `[id]` routes was initially left unstaged from the routes commit; since the branch is local and unpushed, commit `50271db` was amended (`--no-edit`) to include `src/core/schemas/distribution.ts` so the routes work unit typechecks standalone. Hooks re-ran (lint + typecheck passed). No code content changed beyond the one export line.
2. **Legacy error bridge in `handleApiError` (content)**: the repository still throws plain `Error` with Spanish messages (P0 task 3.3 replaces them with typed `ApiError`). `handleApiError` maps the exact current messages so existing 409/404/400 semantics survive the route migration; a side normalization is that `Producto no encontrado`/`Cliente no encontrado`/`Tasa de impuesto no encontrada` now map to 404 (design: "404 not-found") where `tax DELETE` previously returned 400 — frontend displays the same Spanish message either way.
3. **Status-code normalization**: `ForbiddenError` (role mismatch) returns 403 instead of the previous blanket 401 — required by the design's 400/401/403/404/409 contract and by the access-control spec ("STAFF → 403"). Zero consumers existed before, so nothing regressed.
4. **`cash/close` legacy key bridge (content)**: schema per design is `{sessionId, physicalCount}` only; the current `CashRegisterView` still posts `closingAmount/expectedAmount/difference`, so the S2 route accepts the legacy `closingAmount` key as the physical count and **drops** client `expectedAmount/difference` entirely (server stores `physicalCount` as both `closingAmount` and `expectedAmount`, `difference: 0` — byte-identical to today's honest UI which sends `closingAmount === expectedAmount`). Full server-side derivation replaces this in P0 (task 3.6) when the UI switches to `physicalCount`.
5. **`branchId` in inventory update schema**: `updateInventoryItemSchema` includes optional `branchId` per task 2.3, but the route drops it when calling the repository; the multi-branch `updateInventoryItem` fix is P1 (task 4.2). Forward-compatible contract, no behavior change today.
6. **GET query validation**: GET endpoints with no parameters validate against `noQueryParamsSchema` (strict-empty) and `sales` GET against a legacy `limit` 1..500 schema (the `take 500` cap; 1..100 pagination is P1 per spec `distribution-pagination`). This satisfies "safeParse per route" honestly without breaking `SalesHistoryView?limit=200`.

## Issues Found

- None blocking. Compatibility reads confirmed: `SuppliersView`/`EmployeesView` send `''` for optional fields → `nullableEmail`/`nullableText` accept and preserve empty strings (no regression); `SalesPOSView` sale payload unchanged (payment fields optional); POS `/tax` GET stays STAFF-accessible so STAFF checkout tax computation is unaffected.

## Workload / PR Boundary

- Mode: chained PR slice #2 (feature-branch-chain; PR #2 base = `feat/distribution-complete-01-f0`; tracker `feat/distribution-complete`; later PRs base = immediate previous PR branch)
- Current work unit: S2 Security Foundation — commits on `feat/distribution-complete-02-security`: `3cf8d99` (deps), `04f1e94` (schemas+api-error+i18n), `2983967` (auth SUPER_ADMIN + /me tenant), `50271db` (14 guarded routes, amended)
- Boundary: start = `feat/distribution-complete-01-f0` tip `8213bb6`; end = `50271db` on `feat/distribution-complete-02-security` (do NOT open the PR from apply)
- Estimated review budget impact: ~950 changed lines (additions + deletions) across the 4 code commits — over the 400-line budget by design; it remains PR #2 per the pre-agreed 5-PR chain (S2 ~650 est. + schemas/i18n), pending user confirmation to open the PR as the planned slice.

## Status

9/25 tasks complete (S1 + S2). Ready for next batch: S3 P0 (tasks 3.1–3.7) on its own child PR branch based on `feat/distribution-complete-02-security`.