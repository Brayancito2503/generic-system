# 📐 UML_DIAGRAMS.md — DIAGRAMAS UML DEL SISTEMA

> **Generic System** — SaaS Multi-Tenant.
> Diagramas de **componentes, clases, secuencia y estados** generados con [Mermaid](https://mermaid.js.org/) (renderizan en GitHub/GitLab). Complementan a `ARCHITECTURE.md` (visión general y patrones) y a `DATA_MODEL.md` (entidad-relación).

---

## 1. DIAGRAMA DE COMPONENTES (ARQUITECTURA EN CAPAS)

```mermaid
graph TD
    subgraph Presentacion["Capa de Presentación (Cliente)"]
        LOGIN["/login<br/>(admin + POS PIN)"]
        DASH["Dashboard /[locale]<br/>Páginas por módulo"]
        VISTAS["Views Distribution<br/>SalesPOS, Inventory, Cash..."]
        GYM_UI["GymCheckInView"]
    end

    subgraph Estado["Estado UI"]
        RQ["TanStack React Query v5<br/>(cache + invalidación)"]
        JT["Jotai<br/>(estado global UI)"]
    end

    subgraph Aplicacion["Capa de Aplicación"]
        CASOS["Use Cases<br/>CheckInAccessUseCase"]
        RUTAS["API Routes /api<br/>(Next.js App Router)"]
        SCHEMAS["Zod schemas<br/>(validación de inputs)"]
    end

    subgraph Dominio["Capa de Dominio (agnóstica)"]
        ENT["Entities<br/>SaleEntity, PersonEntity..."]
        PORTS["Ports (interfaces)<br/>IDistributionRepository<br/>IGymRepository"]
    end

    subgraph Infra["Capa de Infraestructura"]
        REPO["Prisma Repositories<br/>PrismaDistributionRepository..."]
        MOCK["Mock Repositories<br/>MockGymRepository (gym: dev)"]
        PRISMA["Prisma Client<br/>src/infrastructure/db/prisma.ts"]
    end

    DB[("PostgreSQL<br/>Neon Serverless")]

    LOGIN --> RUTAS
    DASH --> RQ
    VISTAS --> RQ
    GYM_UI --> CASOS
    RQ --> RUTAS
    CASOS --> PORTS
    RUTAS --> SCHEMAS
    RUTAS --> PORTS
    PORTS <|.. REPO
    PORTS <|.. MOCK
    REPO --> PRISMA
    MOCK -.-> CASOS
    PRISMA --> DB
```

> **Flujo típico**: `View → React Query → API Route (Zod) → Port → PrismaRepository → PostgreSQL`. El cliente **nunca** envía `tenantId`; el servidor lo deriva de la sesión (`requireTenantId`).

---

## 2. DIAGRAMA DE CLASES — DOMINIO Y PUERTOS

```mermaid
classDiagram
    class TenantEntity {
        +string id
        +string slug
        +string name
        +IndustryType industry
        +string[] modules
        +TenantSettings settings
    }
    class PersonEntity {
        +string id
        +string firstName
        +string lastName
        +string documentId
        +json metadata
    }
    class SaleEntity {
        +string id
        +number subtotal
        +number taxAmount
        +number discount
        +number total
        +PaymentMethod paymentMethod
        +number paidAmount
        +number balance
        +string invoiceNumber
        +SaleLineEntity[] items
    }
    class ReceivableEntity {
        +string id
        +number originalAmount
        +number balance
        +ReceivableStatus status
        +ReceivablePaymentEntity[] payments
    }
    class CashSessionEntity {
        +string id
        +number openingAmount
        +number expectedAmount
        +number difference
        +string status
        +CashMovementEntity[] movements
    }
    class InventoryMovementEntity {
        +string id
        +InventoryMovementType type
        +number quantity
        +InventoryAdjustmentReason reason
        +number costSnapshot
        +string refId
    }

    class IDistributionRepository {
        <<interface>>
        +getDashboard(tenantId)
        +getInventory(tenantId)
        +createInventoryItem(tenantId, input)
        +updateInventoryItem(tenantId, itemId, input)
        +deleteInventoryItem(tenantId, itemId)
        +getSuppliers(tenantId)
        +createSupplier(tenantId, input)
        +updateSupplier(tenantId, supplierId, input)
        +getPurchaseOrders(tenantId)
        +createPurchaseOrder(tenantId, input)
        +receivePurchaseOrder(tenantId, poId, input)
        +getEmployees(tenantId)
        +createEmployee(tenantId, input)
        +updateEmployee(tenantId, employeeId, input)
        +linkEmployeeUser(tenantId, employeeId, input)
        +getOpenCashSession(tenantId)
        +openCashSession(tenantId, input)
        +addCashMovement(tenantId, input)
        +closeCashSession(tenantId, input)
        +getTaxRates(tenantId)
        +createTaxRate(tenantId, input)
        +updateTaxRate(tenantId, rateId, input)
        +deleteTaxRate(tenantId, rateId)
        +getFiscalSummary(tenantId)
        +findCustomers(tenantId, query)
        +createCustomer(tenantId, input)
        +updateCustomer(tenantId, customerId, input)
        +getInvoicingConfig(tenantId)
        +updateInvoicingConfig(tenantId, input)
        +registerSale(tenantId, input)
        +getSales(tenantId, page, limit)
        +createSaleReturn(tenantId, saleId, input)
        +getSaleReturns(tenantId, page, limit)
        +getReceivables(tenantId, page, limit, status)
        +payReceivable(tenantId, receivableId, input)
        +getDailyCloseReport(tenantId, date)
        +createInventoryAdjustment(tenantId, input)
        +createInventoryCountBatch(tenantId, input)
        +listInventoryMovements(tenantId, filter)
        +getMermaSummary(tenantId, filter)
    }

    class IGymRepository {
        <<interface>>
        +findPersonWithMembership(tenantId, query)
        +createMembership(data)
        +logAccess(data)
        +getRecentLogs(tenantId, limit)
    }

    class CheckInAccessUseCase {
        -IGymRepository gymRepository
        +execute(tenantId, searchInput) CheckInResult
    }

    CheckInAccessUseCase --> IGymRepository : usa
```

> **Regla arquitectónica**: el dominio (`src/core/`) no importa infraestructura ni UI. Los puertos son interfaces puras de TypeScript (`I` prefijo); las entidades usan el sufijo `Entity`.

---

## 3. DIAGRAMA DE CLASES — ADAPTADORES Y ANATOMÍA DE VENTA

```mermaid
classDiagram
    class PrismaDistributionRepository {
        -prisma
        +registerSale(tenantId, input) SaleEntity
        +receivePurchaseOrder(tenantId, poId, input) PurchaseOrderEntity
        +closeCashSession(tenantId, input) CashSessionEntity
        +createInventoryAdjustment(tenantId, input) InventoryAdjustmentEntity
        +createInventoryCountBatch(tenantId, input) InventoryAdjustmentEntity[]
    }
    class PrismaGymRepository {
        +findPersonWithMembership(tenantId, query)
        +logAccess(data)
    }
    class MockGymRepository {
        +findPersonWithMembership(tenantId, query)
        +logAccess(data)
        +getRecentLogs(tenantId, limit)
    }

    PrismaDistributionRepository ..|> IDistributionRepository : implementa
    PrismaGymRepository ..|> IGymRepository : implementa
    MockGymRepository ..|> IGymRepository : implementa (dev/demo)

    note for PrismaDistributionRepository "Toda query lleva tenantId; ventas/recepciones/ajustes usan $transaction y escriben InventoryMovement (kardex)."
```

**Anatomía de una venta (`registerSale`)** — transacción atómica:

```mermaid
graph TD
    A["Input validado (Zod)"] --> B["¿Caja abierta? (tenant)"]
    B -- "no" --> X["400/409: debe abrir caja"]
    B -- "sí" --> C["Tasa default activa del catálogo"]
    C --> D["Calcular subtotal / tax / total<br/>(IVA inclusivo: base × tasa/(100+tasa))"]
    D --> E["$transaction"]
    E --> F["SaleCounter + 1 → INV-YYYYMMDD-NNNNNN"]
    E --> G["Crear Sale + SaleItem (cost snapshot)"]
    E --> H["updateMany stock ≥ qty (guard)<br/>si no alcanza → 409"]
    E --> I["InventoryMovement SALE por línea<br/>(cantidad negativa)"]
    E --> J["Si paymentMethod=CREDIT o pago parcial<br/>→ Receivable con balance > 0"]
    E --> K["Respuesta SaleEntity"]
```

---

## 4. DIAGRAMAS DE SECUENCIA

### 4.1 Login administrador (POST /api/auth/login)

```mermaid
sequenceDiagram
    autonumber
    participant UI as LoginForm (admin)
    participant R as POST /api/auth/login
    participant DB as Prisma/PostgreSQL
    participant C as Cookie gs_session

    UI->>R: { mode:"admin", email, password }
    R->>DB: findFirst User (email normalizado)
    alt usuario no existe o password inválido
        R-->>UI: 401 Credenciales inválidas
    else tenant inactivo
        R-->>UI: 403 Tenant desactivado
    else credenciales válidas
        R->>R: signSession (JWT HS256, 7 días)
        R->>C: set gs_session (httpOnly, secure)
        R-->>UI: { ok, user }
    end
```

### 4.2 Login POS por PIN (POST /api/auth/pos-login, tenant-aislado)

```mermaid
sequenceDiagram
    autonumber
    participant UI as POS PIN Login
    participant R as POST /api/auth/pos-login
    participant DB as Prisma/PostgreSQL

    UI->>R: { tenant: slug, pin, employeeId? }
    R->>DB: findUnique Tenant by slug
    alt tenant no existe o inactivo
        R-->>UI: 401 PIN incorrecto (genérico)
    else tenant activo
        R->>DB: users tenantId + rol POS (STAFF/CASHIER/ACCOUNTANT) + posPinHash
        loop candidatos
            R->>R: employee activo? employeeId coincide? verifyPassword(pin)
        end
        alt match
            R-->>UI: { ok, user } + cookie gs_session
        else no match
            R-->>UI: 401 PIN incorrecto
        end
    end
```

### 4.3 Venta POS (POST /api/distribution/sales)

```mermaid
sequenceDiagram
    autonumber
    participant V as SalesPOSView
    participant R as API Route /sales
    participant S as Zod validate
    participant Repo as PrismaDistributionRepository
    participant DB as PostgreSQL

    V->>R: líneas + descuento + método + paidAmount
    R->>S: validate (registerSaleSchema)
    S-->>R: 400 si inválido
    R->>Repo: registerSale(tenantId, input)
    Repo->>DB: getOpenCashSession(tenantId)
    alt sin caja abierta
        DB-->>Repo: null
        Repo-->>R: 400/409 debe abrir caja
        R-->>V: error 4xx
    else caja abierta
        Repo->>DB: BEGIN $transaction
        Repo->>DB: SaleCounter increment (correlativo)
        Repo->>DB: create Sale + SaleItem (cost snapshot)
        Repo->>DB: updateMany Inventory stock >= qty (guard)
        alt stock insuficiente
            DB-->>Repo: count=0
            Repo-->>R: 409 Stock insuficiente (rollback)
        else ok
            Repo->>DB: create InventoryMovement SALE
            opt crédito o pago parcial
                Repo->>DB: create Receivable (balance > 0)
            end
            Repo->>DB: COMMIT
            Repo-->>R: SaleEntity
            R-->>V: 200 sale
            V->>V: invalidar queries (inventario, caja, dashboard, fiscal)
        end
    end
```

### 4.4 Cierre de caja (POST /api/distribution/cash/close)

```mermaid
sequenceDiagram
    autonumber
    participant V as CashRegisterView
    participant R as API Route /cash/close
    participant Repo as PrismaDistributionRepository
    participant DB as PostgreSQL

    V->>R: { sessionId, physicalCount }
    R->>Repo: closeCashSession(tenantId, input)
    Repo->>DB: get CashSession OPEN + movements + sales
    Repo->>Repo: calcular expected (apertura + IN − OUT + ventas) y difference (physicalCount − expected)
    Repo->>DB: update session (CLOSED, closingAmount, expected, difference)
    DB-->>Repo: CashSessionEntity
    Repo-->>R: sesión cerrada
    R-->>V: 200 (diferencia visible en UI)
```

### 4.5 Check-in de socio (Gimnasio, hoy con mock)

```mermaid
sequenceDiagram
    autonumber
    participant UI as GymCheckInView
    participant UC as CheckInAccessUseCase
    participant Repo as IGymRepository (Mock)
    participant Log as GymAccessLog (en memoria/mock)

    UI->>UC: execute(tenantId, "DNI-123456")
    UC->>Repo: findPersonWithMembership(tenantId, { documentId, personId })
    alt sin socio
        Repo-->>UC: null
        UC-->>UI: denied "Socio no encontrado"
    else socio sin membresía
        UC-->>UI: denied "no posee ninguna membresía"
    else membresía vencida o no ACTIVE
        UC->>Repo: logAccess(granted=false, denialReason)
        UC-->>UI: denied (verde/rojo) + mensaje con motivo
    else activa y vigente
        UC->>Repo: logAccess(granted=true)
        UC-->>UI: granted "¡Bienvenido(a) ...!" (verde)
    end
```

---

## 5. DIAGRAMAS DE ESTADOS

### 5.1 Sesión de caja (`CashSession`)

```mermaid
stateDiagram-v2
    [*] --> OPEN : openCashSession
    OPEN --> OPEN : movimiento IN/OUT
    OPEN --> CLOSED : closeCashSession (conteo físico)
    CLOSED --> [*]
```

> Solo **una** caja `OPEN` por tenant; el cierre exige ventas registradas y movimientos; la diferencia se calcula server-side.

### 5.2 Orden de compra (`PurchaseOrder`)

```mermaid
stateDiagram-v2
    [*] --> PENDING : createPurchaseOrder
    PENDING --> ORDERED : aprobada/ordenada
    PENDING --> CANCELLED : cancelación
    ORDERED --> RECEIVED : receivePurchaseOrder (total → RECEIVED)
    ORDERED --> ORDERED : recepción parcial (receivedQty < qty)
    RECEIVED --> [*]
```

### 5.3 Cuenta por cobrar (`Receivable`)

```mermaid
stateDiagram-v2
    [*] --> OPEN : venta a crédito / pago parcial
    OPEN --> PARTIAL : payReceivable (saldo restante)
    PARTIAL --> PARTIAL : pagos parciales
    PARTIAL --> PAID : saldo = 0
    OPEN --> PAID : pago total
    PAID --> [*]
```

### 5.4 Membresía de gimnasio (`GymMembership`)

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : createMembership
    ACTIVE --> EXPIRED : endDate < now
    ACTIVE --> FROZEN : congelación (planificada)
    ACTIVE --> CANCELLED : cancelación (planificada)
    FROZEN --> ACTIVE : reactivación (planificada)
    EXPIRED --> [*]
    CANCELLED --> [*]
```

### 5.5 Venta (`Sale`)

```mermaid
stateDiagram-v2
    [*] --> COMPLETED : registerSale (transacción atómica)
    COMPLETED --> RETURNED : devolución parcial (UC-D4)
    COMPLETED --> [*]
```

---

## 6. MAPA DE ESTRUCTURA (ARQUITECTURA DE CARPETAS)

```mermaid
graph TD
    SRC["src/"] --> APP["app/ — App Router + API"]
    SRC --> CORE["core/ — Dominio agnóstico"]
    SRC --> INFRA["infrastructure/ — Prisma + adaptadores"]
    SRC --> MOD["modules/ — Verticales"]
    SRC --> FEAT["features/ — Auth, Admin, Dashboard"]
    SRC --> COMP["components/ — Sistema de diseño (Shadcn)"]
    SRC --> LIB["lib/ — session, security, utils"]
    SRC --> HOOKS["hooks/ — React Query, Jotai, atoms"]

    APP --> APIPATH["api/auth/*<br/>api/admin/tenants/*<br/>api/distribution/*"]
    APP --> DASH["[locale]/dashboard"]

    CORE --> ENT["entities/ — *Entity"]
    CORE --> PORTS["ports/ — I*Repository"]
    CORE --> SCS["schemas/ — Zod"]

    INFRA --> REPOPATH["db/repositories/<br/>prisma-*.repository.ts<br/>mock-*.repository.ts"]

    MOD --> GYM["gym/ — use-cases + components"]
    MOD --> DIST["distribution/ — api.ts, components/, entities/, lib/roles.ts"]

    FEAT --> AUTH["auth/ — login admin + POS PIN"]
    FEAT --> ADM["admin/ — tenants-admin-view"]
```

---

## 7. REFERENCIAS

- `ARCHITECTURE.md` — visión de arquitectura, patrones, flujo end-to-end gym.
- `DATA_MODEL.md` — diagramas ER y reglas de integridad.
- `USE_CASES.md` — casos de uso y especificaciones detalladas.
- `prisma/schema.prisma` — fuente de verdad del esquema.
- `src/core/ports/` — contratos exactos de los puertos.