# 🗄️ DATA_MODEL.md — MODELO DE DATOS Y DIAGRAMA ENTIDAD-RELACIÓN

> **Generic System** — SaaS Multi-Tenant.
> Esquema real en `prisma/schema.prisma`. Este documento lo traduce a **diagramas ER (Mermaid)** y explica cada dominio, las reglas de integridad y el polimorfismo JSONB. Para operación (conexión, migraciones, seed) ver `DATABASE.md`.

---

## 1. VISIÓN GENERAL

| Bloque | Modelos | Propósito |
| :--- | :--- | :--- |
| **Core** | `Tenant`, `Branch`, `User`, `Person`, `Item`, `Inventory`, `InventoryMovement`, `Sale`, `SaleItem`, `SaleCounter` | Universales para todo tenant: identidad, personas, catálogo, stock, ventas |
| **Vertical Gym** | `GymMembership`, `GymAccessLog` | Membresías y control de accesos |
| **Vertical Distribution** | `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `Employee`, `CashSession`, `CashMovement`, `TaxRate`, `InvoicingConfig`, `Receivable`, `ReceivablePayment`, `SaleReturn`, `SaleReturnItem` | Compras, caja, empleados, impuestos/CAI, cuentas por cobrar, devoluciones |

**Regla de oro**: toda tabla vertical/core de negocio lleva `tenantId` con FK `ON DELETE CASCADE` e índice — **cero leaks entre tenants** (ver `AGENTS.md` Rule #1).

---

## 2. DIAGRAMA ER — NÚCLEO (CORE)

```mermaid
erDiagram
    Tenant ||--o{ Branch : "tiene sucursales"
    Tenant ||--o{ User : "tiene usuarios"
    Tenant ||--o{ Person : "registra personas"
    Tenant ||--o{ Item : "vende ítems"
    Tenant ||--|| SaleCounter : "correlativo de facturas"

    User }o--o| Person : "se vincula (opcional)"
    Person ||--o{ Sale : "compra"
    Item ||--o{ SaleItem : "se vende en línea"

    Sale ||--o{ SaleItem : "contiene líneas"
    Branch ||--o{ Inventory : "almacena por sucursal"
    Item ||--o{ Inventory : "stock por sucursal"
    Item ||--o{ InventoryMovement : "kardex del ítem"
    Branch ||--o{ InventoryMovement : "kardex por sucursal"

    Tenant {
        string id PK
        string slug UK "único"
        string name
        string industry "enum Industry"
        string[] modules "feature flags verticales"
        boolean active "soft-delete"
        json settings "JSONB tema/reglas"
    }
    Branch {
        string id PK
        string tenantId FK
        string name
        string address "nullable"
    }
    User {
        string id PK
        string tenantId FK
        string email "UK: tenantId+email"
        string passwordHash "bcrypt"
        string posPinHash "bcrypt, nullable"
        string role "enum Role"
        string personId "nullable, único"
    }
    Person {
        string id PK
        string tenantId FK
        string firstName
        string lastName
        string email "nullable"
        string phone "nullable"
        string documentId "nullable, index tenantId+documentId"
        json metadata "JSONB polimórfico"
    }
    Item {
        string id PK
        string tenantId FK
        string sku "nullable, UK: tenantId+sku"
        string name
        string description "nullable"
        decimal cost "10,2"
        decimal price "10,2"
        boolean isService
        json attributes "JSONB polimórfico"
    }
    Inventory {
        string id PK
        string tenantId FK
        string itemId FK
        string branchId FK
        decimal stock "10,2, UK: tenantId+itemId+branchId"
        int minAlert "default 5"
    }
    InventoryMovement {
        string id PK "cuid"
        string tenantId FK
        string branchId FK
        string itemId FK
        string type "INITIAL|RECEIVE|SALE|RETURN|ADJUSTMENT|TRANSFER_*"
        decimal quantity "firmado: SALE/loss negativo"
        string reason "MERMA|ROTURA|VENCIMIENTO|DESCUADRE|SOBRANTE"
        decimal costSnapshot "costo unitario al momento"
        string userId "quién movió"
        string refId "nullable: sale/PO/return id"
    }
    Sale {
        string id PK
        string tenantId FK
        string personId FK "nullable"
        string cashSessionId FK "nullable"
        decimal subtotal "10,2"
        decimal taxAmount "10,2"
        decimal discount "10,2"
        decimal total "10,2"
        string paymentMethod "CASH|CARD|TRANSFER|CREDIT"
        decimal paidAmount "10,2"
        decimal balance "10,2"
        string invoiceNumber "UK: tenantId+invoiceNumber"
        string status "default COMPLETED"
    }
    SaleItem {
        string id PK
        string saleId FK
        string itemId FK
        decimal quantity "10,2, fracciones permitidas"
        decimal price "10,2"
        decimal cost "10,2, snapshot a la venta"
    }
    SaleCounter {
        string tenantId PK
        int lastNumber "correlativo"
    }
```

> **Kardex**: `InventoryMovement` es el libro contable del stock. Toda variación de `Inventory.stock` escribe una fila **en la misma transacción**. Convención de signo: `SALE` y pérdidas negativos; `RECEIVE`, `RETURN` y `SOBRANTE` positivos; `INITIAL` firmado como se dio. `TRANSFER_OUT/TRANSFER_IN` están reservados para la Fase 3 (no se escriben aún).

---

## 3. DIAGRAMA ER — VERTICAL GIMNASIO

```mermaid
erDiagram
    Tenant ||--o{ GymMembership : "tiene membresías"
    Person ||--o| GymMembership : "es titular (1:1)"
    GymMembership ||--o{ GymAccessLog : "registra accesos"
    Tenant ||--o{ GymAccessLog : "audita accesos"

    GymMembership {
        string id PK
        string tenantId FK
        string personId FK "único"
        string planName "ej: Pase Mensual VIP"
        date startDate
        date endDate
        string status "ACTIVE|EXPIRED|FROZEN|CANCELLED"
    }
    GymAccessLog {
        string id PK
        string tenantId FK
        string membershipId FK
        datetime accessTime
        boolean granted
        string denialReason "nullable"
    }
```

---

## 4. DIAGRAMA ER — VERTICAL DISTRIBUCIÓN

```mermaid
erDiagram
    Tenant ||--o{ Supplier : "tiene proveedores"
    Supplier ||--o{ PurchaseOrder : "recibe órdenes"
    Branch ||--o{ PurchaseOrder : "destino de mercadería"
    PurchaseOrder ||--o{ PurchaseOrderItem : "contiene líneas"
    Item ||--o{ PurchaseOrderItem : "se ordena"

    Tenant ||--o{ Employee : "tiene empleados"
    Person ||--o| Employee : "es empleado (1:1)"
    Branch ||--o{ Employee : "sede del empleado (opcional)"
    Employee ||--o{ CashSession : "abre cajas"

    Tenant ||--o{ CashSession : "controla cajas"
    Branch ||--o{ CashSession : "caja por sucursal"
    CashSession ||--o{ CashMovement : "tiene movimientos"
    CashSession ||--o{ Sale : "agrupa ventas de la sesión"

    Tenant ||--o{ TaxRate : "catálogo fiscal"
    Tenant ||--o| InvoicingConfig : "config CAI (1:1)"
    Tenant ||--o{ Receivable : "cuentas por cobrar"
    Sale ||--o{ Receivable : "genera CxC"
    Person ||--o{ Receivable : "debe (deudor)"
    Receivable ||--o{ ReceivablePayment : "recibe pagos"

    Tenant ||--o{ SaleReturn : "devoluciones"
    Sale ||--o{ SaleReturn : "se devuelve"
    CashSession ||--o{ SaleReturn : "reembolso en sesión (opcional)"
    SaleReturn ||--o{ SaleReturnItem : "líneas devueltas"
    Item ||--o{ SaleReturnItem : "ítem devuelto"

    Supplier {
        string id PK
        string tenantId FK
        string name
        string contactName "nullable"
        string phone "nullable"
        string email "nullable"
        string taxId "nullable, RTN/RUC/RFC"
        string address "nullable"
        boolean isActive "default true"
    }
    PurchaseOrder {
        string id PK
        string tenantId FK
        string supplierId FK
        string branchId FK
        string orderNumber "nullable"
        string status "PENDING|ORDERED|RECEIVED|CANCELLED"
        decimal subtotal "10,2"
        decimal taxAmount "10,2"
        decimal total "10,2"
        datetime receivedAt
    }
    PurchaseOrderItem {
        string id PK
        string orderId FK
        string itemId FK
        decimal quantity "10,2"
        decimal receivedQty "10,2, avance de recepción"
        decimal cost "10,2"
    }
    Employee {
        string id PK
        string tenantId FK
        string personId FK "único"
        string branchId FK "nullable"
        string position "cargo"
        string accessRole "nullable: CASHIER|ACCOUNTANT|MANAGER"
        decimal salary "nullable"
        date hireDate
        boolean isActive
    }
    CashSession {
        string id PK
        string tenantId FK
        string branchId FK
        string employeeId FK "nullable"
        datetime openedAt
        datetime closedAt "nullable"
        decimal openingAmount "10,2"
        decimal closingAmount "nullable"
        decimal expectedAmount "nullable, calculado server-side"
        decimal difference "nullable, calculado server-side"
        string status "OPEN|CLOSED"
    }
    CashMovement {
        string id PK
        string tenantId FK
        string sessionId FK
        string type "IN|OUT"
        decimal amount "10,2"
        string concept
    }
    TaxRate {
        string id PK
        string tenantId FK
        string name "IVA, ISR"
        decimal rate "5,2, ej. 15.00"
        boolean isInclusive "precio incluye impuesto"
        boolean isActive
        boolean isDefault "único por Tenant"
    }
    InvoicingConfig {
        string id PK
        string tenantId FK "único"
        string caiNumber
        string rangeFrom
        string rangeTo
        datetime limitDate "nullable"
        string companyTaxId
        string legalName
    }
    Receivable {
        string id PK
        string tenantId FK
        string saleId FK
        string personId FK
        decimal originalAmount "10,2"
        decimal balance "10,2"
        string status "OPEN|PARTIAL|PAID"
    }
    ReceivablePayment {
        string id PK
        string tenantId FK
        string receivableId FK
        decimal amount "10,2"
        string method "CASH|CARD|TRANSFER"
    }
    SaleReturn {
        string id PK
        string tenantId FK
        string saleId FK
        string cashSessionId FK "nullable"
        string reason "nullable"
        decimal totalRefund "10,2"
    }
    SaleReturnItem {
        string id PK
        string returnId FK
        string itemId FK
        decimal quantity "10,2"
        decimal refundAmount "10,2"
    }
```

---

## 5. POLIMORFISMO JSONB (CLAVE DEL DISEÑO)

Las entidades centrales usan campos `JSON` (PostgreSQL **JSONB**) para atributos específicos de rubro **sin alterar el esquema SQL**:

```
┌─────────────┐   ┌───────────────┐   ┌──────────────────┐
│  Person     │   │  Item         │   │  Tenant          │
│  metadata   │   │  attributes   │   │  settings        │
├─────────────┤   ├───────────────┤   ├──────────────────┤
│ Gimnasio:   │   │ Gimnasio:     │   │ logoUrl          │
│ fecha_nac  │   │ durationDays  │   │ primaryColor     │
│ foto       │   │ accessZone    │   │ currency         │
│ huella_id  │   │ Restaurante:  │   │ timezone         │
│ Farmacia:  │   │ ingredientes  │   │ feature flags    │
│ historial  │   │ alergias      │   └──────────────────┘
│ médico     │   └───────────────┘
└─────────────┘
```

- Tipado estricto: cada vertical valida su JSONB con **esquemas Zod** específicos (`src/core/schemas/`), nunca `any`.
- `Item.isService` distingue productos de servicios (ej. una membresía es un `Item` con `isService = true`).

---

## 6. REGLAS DE INTEGRIDAD DESTACADAS

| Regla | Mecanismo |
| :--- | :--- |
| **Aislamiento estricto** | `tenantId` en toda consulta; FKs con `ON DELETE CASCADE`; índices por tenant |
| **SKU único por tenant** | `@@unique([tenantId, sku])` → `409` si se repite |
| **Factura única por tenant** | `@@unique([tenantId, invoiceNumber])` |
| **Correlativo atómico** | `SaleCounter` se incrementa en la misma transacción de la venta |
| **Stock nunca negativo** | Guard `stock >= qty` en transacciones + rechazo de ajustes negativos que dejen stock < 0 (`409`) |
| **Kardex integro** | Cada variación de stock = una fila `InventoryMovement` en la misma transacción, con `costSnapshot` |
| **IVA default único** | El repositorio limpia los demás `isDefault` al marcar una tasa |
| **Devolución sin sobrepasar** | Devuelto acumulado ≤ vendido → `409`; reembolso > saldo de CxC → `409` |
| **Cobro sin sobrepago** | Pago ≤ saldo restante → `409` |
| **Persona 1:1 con rol** | `User.personId` único; `GymMembership.personId` único; `Employee.personId` único |
| **Empleado desactivado = PIN revocado** | `posPinHash` se anula en la misma transacción del `isActive: false` |

---

## 7. ENUMS DE NEGOCIO

| Enum | Valores | Dónde |
| :--- | :--- | :--- |
| `Industry` | `GENERIC`, `GYM`, `RESTAURANT`, `PHARMACY`, `RETAIL`, `DISTRIBUTION` | `Tenant.industry` |
| `Role` | `SUPER_ADMIN`, `TENANT_ADMIN`, `STAFF`, `CUSTOMER`, `CASHIER`, `ACCOUNTANT` | `User.role` |
| `AccessRole` | `CASHIER`, `ACCOUNTANT`, `MANAGER` (nullable) | `Employee.accessRole` |
| `InventoryMovementType` | `INITIAL`, `RECEIVE`, `SALE`, `RETURN`, `ADJUSTMENT`, `TRANSFER_OUT`, `TRANSFER_IN` | `InventoryMovement.type` |
| `InventoryAdjustmentReason` | `MERMA`, `ROTURA`, `VENCIMIENTO`, `DESCUADRE`, `SOBRANTE` | `InventoryMovement.reason` |

> Los estados de flujo (`CashSession.status`, `PurchaseOrder.status`, `Receivable.status`, `GymMembership.status`) son `String` documentados por convención; ver diagramas de estados en `UML_DIAGRAMS.md` §5.