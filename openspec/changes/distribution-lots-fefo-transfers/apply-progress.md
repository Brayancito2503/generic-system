# Apply Progress — distribution-lots-fefo-transfers (PR 1)

**Phase:** apply · **Slices in scope:** S0a, S0b, S1a, S1b, S1c · **Status:** complete

PR 1 covers branch management, branch-explicit inventory, and D11 — one OPEN cash
session per `(tenantId, branchId)` with the register's branch derived
server-side. Slices S2a and later are **not** implemented here.

---

## Slice status

| Slice | Scope | Status |
|---|---|---|
| S0a | `Branch` entity, port, Zod schemas, repository CRUD, `POST/GET /api/distribution/branches` | done |
| S0b | `GET/PATCH /api/distribution/branches/[id]`, `BranchesView.tsx`, role gate, symmetric `en`/`es` messages | done |
| S1a | `InventoryStockItem.branchId`, branch-explicit `getInventory`, duplicate-free rows, velocity ranks each product once | done |
| S1b | M5 migration + server-derived session branch (D11 steps 1–2), `OpenCashSessionInput` loses `branchId` and gains `userId`, per-branch 409, branch-scoped sale lookup, zero-stock rows for a new branch | done |
| S1c | D11 steps 3–4 in-transaction (session claim as the transaction's first write), failure codes/messages, derived `getOpenCashSession`/`getDashboard`, `LEGACY_STATUS_BY_MESSAGE` cleanup | done |

---

## Files created or modified

### Migrations

| File | Notes |
|---|---|
| `prisma/migrations/20260926090000_cash_session_one_open_per_branch/migration.sql` | **M5.** `CREATE UNIQUE INDEX "CashSession_one_open_per_branch" ON "CashSession"("tenantId","branchId") WHERE "status" = 'OPEN';` — authored only, never applied. Ships a pre-check query, a reversal note, and the safe-to-apply-before-the-code-change rationale. |

### Core (`src/core`)

| File | Change |
|---|---|
| `src/core/ports/distribution-repository.port.ts` | Branch CRUD contracts; `OpenCashSessionInput` loses `branchId`, gains `userId`; `getOpenCashSession(tenantId, userId)` and `getDashboard(tenantId, userId)` now take the session user. |
| `src/core/schemas/distribution.ts` | Branch schemas added; `branchId` dropped from `openCashSessionSchema` (the non-strict object strips an older client's key instead of rejecting it). |
| `src/core/entities/distribution.ts` | `BranchEntity`; `InventoryStockItem.branchId`. |
| `src/core/schemas/distribution.test.ts` | Branch schema coverage. |

### Infrastructure (`src/infrastructure`)

| File | Change |
|---|---|
| `src/infrastructure/db/repositories/prisma-distribution.repository.ts` | Branch CRUD; `deriveSaleBranch` (D11 steps 1–2); `openCashSession` derived + per-branch 409; `registerSale` branch-scoped lookup and in-transaction D11 steps 3–4 with the guarded session claim; `getOpenCashSession`/`getDashboard` branch-derived; zero-`Inventory` rows per existing product when a branch is created. |
| `.../prisma-distribution.session-binding.test.ts` | **New.** D11-1…D11-8. |
| `.../prisma-distribution.branch.test.ts` | Branch persistence + the R3 zero-stock provisioning tests. |
| `.../prisma-distribution.fractional.test.ts` | `employee.findFirst` / `branch.findMany` / `cashSession.updateMany` added to the transaction mock surface. |
| `.../prisma-distribution.sale-unit.test.ts` | Same mock-surface addition. |
| `.../prisma-distribution.velocity-sort.test.ts` | S1a velocity/duplicate-row coverage. |

### API routes (`src/app/api/distribution`)

| File | Change |
|---|---|
| `branches/route.ts` | **New.** `GET`/`POST` branches. |
| `branches/route.test.ts` | **New.** Route coverage. |
| `branches/[id]/route.ts` | **New.** `GET`/`PATCH` branch, tenant-scoped. |
| `cash/route.ts` | `POST` forwards `session.userId` (no client branch); `GET` resolves the register at the caller's own branch. |
| `cash/route.test.ts` | **New.** Proves `userId` is forwarded and a client `branchId` cannot select a branch. |
| `dashboard/route.ts` | Threads `requireApiAuth`'s payload; `getDashboard(tenantId, session.userId)`. |
| `dashboard/route.test.ts` | **New.** |
| `inventory/route.test.ts` | Fixture gains the now-required `branchId`. |

### UI, messages, shared (`src/modules`, `messages`, `src/lib`)

| File | Change |
|---|---|
| `src/modules/distribution/components/BranchesView.tsx` | **New.** Branch management view. |
| `src/modules/distribution/components/DistributionModuleApp.tsx` | Wires the branches view into the module. |
| `src/modules/distribution/lib/roles.ts` | Branch-management role gate. |
| `src/modules/distribution/components/InventoryView.tsx` | Create payload typed as `Omit<CreateInventoryItemInput, 'userId'>` — an alta's stock row is branch-scoped server-side, so the client cannot name a branch. |
| `messages/en.json`, `messages/es.json` | Symmetric branch-management keys. |
| `src/lib/api-error.ts` | Removed the now-unreachable legacy `'Debe abrir la caja antes de registrar una venta'` mapping (D11 replaced it with the per-branch message). |

### Untouched (parallel work, deliberately not modified)

`README.md`, `docs/`, and `openspec/changes/**` other than this file.

---

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/infrastructure/db/repositories/prisma-distribution.session-binding.test.ts` | **17 passed** (RED before S1c: 12 failed / 5 passed) |
| `npx vitest run src/app/api/distribution/cash/route.test.ts src/app/api/distribution/dashboard/route.test.ts src/infrastructure/db/repositories/prisma-distribution.session-binding.test.ts` | **32 passed** |
| `npx vitest run src/infrastructure/db/repositories/prisma-distribution.session-binding.test.ts src/infrastructure/db/repositories/prisma-distribution.branch.test.ts src/app/api/distribution/cash/route.test.ts src/app/api/distribution/branches/route.test.ts` | **46 passed** |
| `npx vitest run src/infrastructure/db/repositories/prisma-distribution.fractional.test.ts src/infrastructure/db/repositories/prisma-distribution.sale-unit.test.ts src/infrastructure/db/repositories/prisma-distribution.inventory-ledger.test.ts` | **24 passed** |
| `npm test` | **30 files, 273 tests passed** (32.09s) |
| `npm run typecheck` | clean |
| `npm run lint` | clean |

`git diff --stat` (tracked files only): **18 files changed, 870 insertions(+), 86 deletions(-)**.
That figure excludes untracked files; the new files added by PR 1 total 1 126
lines (cash route test 166, dashboard route test 74, session-binding suite 421,
branch suite 180, M5 migration 28, plus the pre-existing untracked branch route,
route test, `[id]` route and `BranchesView`).

---

## Deliberately deferred

- **S2a and later** (FEFO engine, lots, transfers, lot-aware returns) are out of
  this PR's scope.
- **M5 was authored, not applied.** No `prisma migrate`/`db push`/deploy ran and
  no live-database query was made. The pre-check in the migration file must be
  run and return 0 rows by an operator before applying it.
- **`closeCashSession` is still read-then-write outside any transaction.** D11's
  claim makes the *sale* side safe, but a sale whose claim lands after the close's
  aggregate can still be omitted from `expectedAmount`. Pre-existing defect,
  tracked as **R11**, and out of scope by design.
- **The concurrency claim is proven by shape, not by real interleaving.** The CI
  mock (`$transaction: fn => fn(tx)`) cannot express two concurrent writers. The
  session-binding suite pins the guard's shape, its first-write position, and that
  nothing is written when the claim is lost; it does **not** prove Postgres
  serialization. Live-DB concurrency evidence stays the **G5/T2** gate before
  S5b.
- **No machine-readable error code.** `ApiError` carries `(status, message)`
  only, and the UI cannot branch on a code it cannot read. Tracked as **R13**.
- **`firstBranchOfTenant` was kept.** It still serves the unnamed-stock-write
  paths; only the cash/sale paths moved to derived branches.

## Notes on the design as written

- D11's step-3 snippet selects `{ id: true, branchId: true }` while step 4 writes
  `data: { notes: session.notes }`. The select therefore also reads `notes`;
  without it the claim cannot compile, and it changes no guarantee.
- `getDashboard` deliberately tolerates an underivable branch (returns no
  register) while `getOpenCashSession` stays strict. The dashboard is a
  tenant-wide read whose viewer may be a manager with no `Employee` row, and
  failing that whole page would be a regression no spec asks for. Only the cash
  endpoints surface the actionable 400.