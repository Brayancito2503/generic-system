# Proposal: distribution-complete — Client-Ready Distribuidora

## Intent

Distribution is the sale promise (paying prospect); the demo is theater: fake CAI form, rubber-stamp cash close, GET-only customers/POs, hardcoded trends. Target: client-ready demo/sale + F0 env stability.

## Scope

### In Scope
- **F0 env**: fix `.gitignore` (all `.env*` except `!.env.example`), remove stale `turbopack:{root}` hack + comment from `next.config.ts`, delete stale `.next`, re-init Husky (`.husky/_` missing).
- **Distribution P0 (sale-blocking)**: server CAI config + seeded `SaleCounter` > max historical `FAC-*`; server-side cash close (never trust client values) + single open-session guard; customers create/edit; PO create + receive→stock; employees update/deactivate + User link (POS PIN); role guard + Zod on all `api/distribution/**`.
- **Distribution P1 (100%)**: payment methods, credit sales, receivables, returns/voids; supplier edit/deactivate; inventory delete + multi-branch `updateInventoryItem` fix; negative-value guards; real dashboard trends/`topProducts`; pagination.
- **Base module essentials**: dynamic sidebar (session/tenant.modules/role), admin/tenant settings, gym anti-spoof fix (`tenantId="powerfit-gym"` → session; no gym features).

### Out of Scope
- Gym features; onboarding; login tenant-scoping/rate limiting; test runner; `sidebard/` cleanup → follow-up phases.

## Capabilities

### New Capabilities
- `distribution-tax-invoicing`: CAI/NCF server config + fiscal numbering from `SaleCounter`
- `distribution-cash-register`: server-side close, single open-session guard, movements
- `distribution-customers`: create/edit + search
- `distribution-purchase-orders`: create/receive workflow + status
- `distribution-employees`: update/deactivate + User link (POS PIN)
- `distribution-access-control`: role guards + Zod on distribution routes
- `distribution-payments-returns`: payment methods, credit sales, receivables, returns/voids
- `distribution-suppliers`: edit/deactivate
- `distribution-inventory-ops`: delete, multi-branch update, negative-value guards
- `distribution-dashboard-real`: real trend queries, `topProducts`, no hardcodes
- `distribution-pagination`: paged list endpoints
- `tenant-dynamic-shell`: sidebar from session/tenant.modules/role
- `admin-tenant-settings`: admin + tenant settings basics

### Modified Capabilities
- None (F0 = config-only cleanup; no spec-level behavior changes).

## Approach

Repeat proven pattern per slice: entity → `I*Repository` port → Prisma adapter → route (`requireTenantId` + role guard + Zod) → React Query → UI. Money math server-side; `tenantId` from session; additive migrations + `prisma generate` only.

## Packaging

Five chained PRs, `delivery_strategy=ask-on-risk`: each slice gated on the 400-line budget.
- S1 F0 env ~30 lines
- S2 security foundation ~650
- S3 P0 ~1400
- S4 P1 ~1280
- S5 base shell+admin ~470

## Definition of Done

Demo: CAI invoice numbered continuously (no overlap with `FAC-*`), sound cash close, customers/PO/employee flows, roles+Zod enforced, clean lint/typecheck/build + smoke, zero hardcoded demo data.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.gitignore`, `next.config.ts`, `.husky/` | Modified | F0 env cleanup |
| `prisma/schema.prisma`, `seed.ts` | Modified | CAI config, `SaleCounter`, P0/P1 fields |
| `api/distribution/{sales,cash,close,customers,purchase-orders,employees,suppliers,inventory,dashboard}/route.ts` + adapters | Modified | P0/P1 endpoints |
| `TaxAndInvoicingView.tsx`, `SalesPOSView.tsx`, `CashRegisterView.tsx`, `DistributionDashboard.tsx`, `DistributionModuleApp.tsx` | Modified | Distribution UI |
| `app-sidebar.tsx`, `dashboard/modules/gym/page.tsx`, `GymCheckInView.tsx` | Modified | Base shell + gym anti-spoof |
| `messages/{es,en}.json` | Modified | i18n keys |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `db:seed` destructive; `migrate dev` can wipe | High | Never unsupervised; DB backup; additive migrations |
| Large change | Med | Chained slice PRs; tasks gates on 400-line budget |
| Role/PIN refactor touches auth | Med | Keep `session.ts` contracts; POS PIN smoke test |

## Rollback Plan

Revert any slice's PR independently. DB additive-only with backup before seed/push. F0 revertible per-file. Never `migrate dev` unsupervised.

## Dependencies

None external; `prisma generate` after schema changes.

## Success Criteria

- [ ] 1. lint + typecheck pass; clean build post-`.next`; smoke run OK.
- [ ] 2. `.env.local`/`.env.production` git-ignored; no `.env*` tracked; Husky active (`.husky/_` present).
- [ ] 3. CAI persists; `SaleCounter` > max `FAC-*`; invoice numbers continuous.
- [ ] 4. Cash close server-side; duplicate open session → 409.
- [ ] 5. Customers/POs/employees CRUD + workflow from POS.
- [ ] 6. All `api/distribution/**` routes: `requireTenantId` + role guard + Zod (grep).
- [ ] 7. Dashboard real queries; no `+12.4%`-style hardcodes.
- [ ] 8. Sidebar from session/tenant.modules/role; gym tenantId session-derived; no `any`; money math server-side.