# 🎯 USE_CASES.md — CASOS DE USO DEL SISTEMA

> **Generic System** — SaaS Multi-Tenant de marca blanca.
> Este documento describe **quién usa el sistema, qué puede hacer cada actor y bajo qué reglas**, con diagramas y especificaciones detalladas. Complementa a `ARCHITECTURE.md` (cómo está construido) y a `DATA_MODEL.md` (cómo se guarda).

---

## 1. ACTORES DEL SISTEMA

| Actor | Descripción | Perfil de sesión |
| :--- | :--- | :--- |
| **Visitante** | Persona sin sesión. Solo accede a la raíz por locale y a `/login`. Sin sesión válida no puede usar ninguna vista del dashboard (el middleware redirige a `/login`). | — (sin token) |
| **SUPER_ADMIN** | Administrador de la **plataforma**: lista, crea y desactiva Tenants. La desactivación (soft-delete `Tenant.active = false`) bloquea el login de todo el tenant. | `SUPER_ADMIN` |
| **TENANT_ADMIN** | Administrador de un Tenant: configuración general, empleados con PIN POS, tasas de impuesto, facturación CAI, clientes, proveedores, inventario. Ingresa con correo + contraseña. | `TENANT_ADMIN` |
| **Cajero (CASHIER)** | Opera el POS: registra ventas, abre/cierra caja, movimiento de caja. Ve solo sus pestañas habilitadas según rol (la UI filtra con `visibleTabs`). | `CASHIER` / `STAFF` legacy |
| **Contador (ACCOUNTANT)** | Impuestos/resumen fiscal, reporte de cierre diario, devoluciones, cuentas por cobrar. | `ACCOUNTANT` |
| **Gerente (MANAGER)** | Perfil de empleado con acceso completo; **siempre ingresa con credenciales reales** (correo + contraseña), nunca con PIN compartido. | sesión `STAFF`/`TENANT_ADMIN` según vínculo |
| **Socio de gimnasio** | Persona con membresía; su interacción es vía recepción (check-in) con documento/ID. | `CUSTOMER`-like (no inicia sesión) |

> Los perfiles de acceso de negocio (`AccessRole`: `CASHIER`, `ACCOUNTANT`, `MANAGER`) son la columna del módulo **Distribution** (`Employee.accessRole`). Un empleado sin `accessRole` conserva acceso completo legacy (sesión `STAFF`).

---

## 2. DIAGRAMAS DE CASOS DE USO

Los diagramas usan [Mermaid](https://mermaid.js.org/) y se renderizan en GitHub/GitLab.

### 2.1 Acceso y plataforma

```mermaid
usecaseDiagram
    actor "Visitante" as V
    actor "SUPER_ADMIN" as SA
    actor "TENANT_ADMIN" as TA
    actor "Cajero/Contador (POS)" as C

    V --> (Autenticarse como administrador)
    V --> (Autenticarse en POS con PIN)
    V --> (Cerrar sesión)

    SA --> (Listar Tenants)
    SA --> (Crear Tenant)
    SA --> (Activar o desactivar Tenant)

    TA --> (Consultar sesión actual)
    TA --> (Configurar datos del Tenant)
    TA --> (Gestionar empleados y PIN POS)
    TA --> (Gestionar tasas de impuesto)
    TA --> (Configurar facturación CAI)

    C --> (Autenticarse en POS con PIN)
    C --> (Registrar venta POS)
    C --> (Abrir / cerrar caja)
    C --> (Registrar movimiento de caja)
```

### 2.2 Vertical Distribución

```mermaid
usecaseDiagram
    actor "Cajero (CASHIER)" as DJ
    actor "Contador (ACCOUNTANT)" as DC
    actor "Administrativo/Gerente" as DA
    actor "TENANT_ADMIN" as DT

    DJ --> (Ver dashboard operativo)
    DJ --> (Registrar venta POS)
    DJ --> (Ver historial de ventas)
    DJ --> (Gestionar clientes)
    DJ --> (Abrir caja)
    DJ --> (Registrar movimiento de caja IN/OUT)
    DJ --> (Cerrar caja)

    DC --> (Consultar kardex de inventario)
    DC --> (Registrar ajuste de inventario)
    DC --> (Realizar conteo físico)
    DC --> (Devolver / anular venta)
    DC --> (Cobrar cuenta por cobrar)
    DC --> (Ver resumen fiscal mensual)
    DC --> (Ver reporte de cierre diario)

    DA --> (Gestionar proveedores)
    DA --> (Crear orden de compra)
    DA --> (Recepcionar orden de compra)
    DA --> (Gestionar empleados)
    DA --> (Gestionar inventario de ítems)
```

### 2.3 Vertical Gimnasio (estado actual: parcial)

```mermaid
usecaseDiagram
    actor "Recepcionista" as GR
    actor "Socio" as GS

    GR --> (Check-in de socio)
    GR --> (Consultar accesos recientes)
    GS --> (Presentar documento o ID para ingreso)
```

> El módulo Gym está **en desarrollo**: hoy existe el caso de uso `CheckInAccessUseCase` + vista `GymCheckInView` sobre un repositorio **mock** (sin API `/api/gym/*` ni persistencia Prisma). Gestión de membresías, planes y dashboard gym están en la hoja de ruta (`PLAN.md` Fase 1).

---

## 3. CATÁLOGO DE CASOS DE USO

### Plataforma y acceso

| ID | Caso de uso | Actor principal | Estado |
| :--- | :--- | :--- | :--- |
| UC-A1 | Autenticarse como administrador | TENANT_ADMIN / SUPER_ADMIN / STAFF | ✅ |
| UC-A2 | Autenticarse en POS con PIN | Cajero / Contador | ✅ |
| UC-A3 | Cerrar sesión | Cualquier autenticado | ✅ |
| UC-A4 | Consultar sesión actual | Cualquier autenticado | ✅ |
| UC-A5 | Listar / crear / desactivar Tenants | SUPER_ADMIN | ✅ |

### Vertical Distribución

| ID | Caso de uso | Actor principal | Estado |
| :--- | :--- | :--- | :--- |
| UC-D1 | Ver dashboard operativo | Todos | ✅ |
| UC-D2 | Registrar venta POS | Cajero | ✅ |
| UC-D3 | Ver historial de ventas | Todos | ✅ |
| UC-D4 | Devolver / anular venta | Contador / Admin | ✅ |
| UC-D5 | Gestionar ítems de inventario (alta/edición/eliminación) | Admin | ✅ |
| UC-D6 | Consultar kardex de movimientos | Contador / Admin | ✅ |
| UC-D7 | Registrar ajuste de inventario | Contador / Admin | ✅ |
| UC-D8 | Realizar conteo físico | Contador / Admin | ✅ |
| UC-D9 | Gestionar clientes | Cajero / Admin | ✅ |
| UC-D10 | Gestionar proveedores | Admin | ✅ |
| UC-D11 | Crear orden de compra | Admin | ✅ |
| UC-D12 | Recepcionar orden de compra | Admin | ✅ |
| UC-D13 | Gestionar empleados (incluye PIN POS) | TENANT_ADMIN | ✅ |
| UC-D14 | Abrir caja | Cajero | ✅ |
| UC-D15 | Registrar movimiento de caja (IN/OUT) | Cajero | ✅ |
| UC-D16 | Cerrar caja | Cajero | ✅ |
| UC-D17 | Gestionar tasas de impuesto | TENANT_ADMIN | ✅ |
| UC-D18 | Configurar facturación CAI | TENANT_ADMIN | ✅ |
| UC-D19 | Ver resumen fiscal mensual | Contador / Admin | ✅ |
| UC-D20 | Ver reporte de cierre diario | Contador / Admin | ✅ |
| UC-D21 | Cobrar cuenta por cobrar | Contador / Admin | ✅ |
| UC-D22 | Configurar datos del Tenant | TENANT_ADMIN | ✅ |

### Vertical Gimnasio

| ID | Caso de uso | Actor principal | Estado |
| :--- | :--- | :--- | :--- |
| UC-G1 | Check-in de socio (verde/rojo) | Recepcionista | ✅ (mock) |
| UC-G2 | Consultar accesos recientes | Recepcionista | ✅ (mock) |
| UC-G3..G5 | Membresías, planes, dashboard gym | — | 🔜 hoja de ruta |

---

## 4. ESPECIFICACIÓN DETALLADA DE CASOS DE USO PRINCIPALES

Formato: resumen, actor, precondiciones, flujo principal, flujos alternos/errores, reglas de negocio, postcondiciones y endpoints involucrados.

---

### UC-A1 · Autenticarse como administrador

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | El usuario inicia sesión con correo y contraseña (modo `admin`). El sistema valida credenciales y emite un JWT de sesión en cookie `httpOnly`. |
| **Actor** | TENANT_ADMIN, SUPER_ADMIN, STAFF, CUSTOMER |
| **Precondiciones** | El tenant debe estar activo (`Tenant.active = true`). El correo debe existir en `User` con `passwordHash` válido. |

**Flujo principal**
1. El usuario envía `{ mode: "admin", email, password }` a `POST /api/auth/login`.
2. El servidor normaliza el correo (trim + minúsculas) y busca el `User`.
3. Verifica la contraseña con `bcrypt` (`verifyPassword`).
4. Verifica que el `Tenant` esté activo (soft-delete).
5. Firma el JWT `HS256` (`jose`) con `{ userId, tenantId, role, name, email }`.
6. Establece la cookie `gs_session` (`httpOnly`, `secure` en producción, `sameSite=lax`, 7 días).
7. Responde `{ ok, user }`.

**Flujos alternos / errores**

| Situación | Resultado |
| :--- | :--- |
| Cuerpo inválido | `400` |
| `mode` distinto de `admin`/`pos` | `400` |
| Credenciales incorrectas | `401` «Credenciales inválidas» |
| Tenant desactivado | `403` «Tenant desactivado…» |
| Error interno | `500` |

**Reglas de negocio**
- El tenant desactivado **no autentica** (gate en login, no en la base).
- La sesión vive **solo** en la cookie; el cliente nunca envía `tenantId` por query o body (anti-spoofing).

**Postcondiciones** → Cookie `gs_session` válida; el middleware permite páginas del dashboard.

---

### UC-A2 · Autenticarse en POS con PIN

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | Un empleado de caja inicia sesión con PIN de 4–6 dígitos. Existen dos vías: el modo `pos` del login global y el endpoint tenant-aislado por `slug`. |
| **Actor** | Empleados con perfil POS (`STAFF` legacy, `CASHIER`, `ACCOUNTANT`); **nunca** MANAGER/TENANT_ADMIN/SUPER_ADMIN. |

**Flujos principales**
1. **`POST /api/auth/pos-login`** (tenant-aislado): envía `{ tenant: slug, pin, employeeId? }`.
   - Resuelve el Tenant por `slug`; si no existe o está inactivo → `401` genérico (no revela estado).
   - Busca usuarios del tenant con `posPinHash`, rol POS-capaz y `Employee` activo.
   - Si se envía `employeeId`, debe coincidir (evita suplantación de sesión delegada).
   - Compara el PIN con `bcrypt` y emite sesión.
2. **`POST /api/auth/login` modo `pos`**: envía `{ mode: "pos", pin }`; recorre usuarios con PIN de tenants activos (semántica espejo, respuesta genérica `401`).

**Flujos alternos / errores**

| Situación | Resultado |
| :--- | :--- |
| `tenant`/`pin` ausente | `400` |
| Tenant inexistente o inactivo | `401` «PIN incorrecto» |
| PIN incorrecto o empleado inactivo | `401` genérico |
| `employeeId` no coincide | no matchea (401) |

**Reglas de negocio**
- El PIN se almacena **hasheado** (`bcryptjs`, nunca en claro).
- Al desactivar un empleado, su `posPinHash` se **revoca** (se anula) en la misma transacción.
- MANAGER ingresa con credenciales reales, no con PIN compartido.

**Postcondiciones** → Sesión POS activa; la UI muestra solo las pestañas del rol (`visibleTabs`).

---

### UC-D2 · Registrar venta POS ★ (caso de uso central)

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | El cajero arma un carrito (ítems + cantidades fraccionarias), aplica descuento y cliente opcional, elige método de pago; el servidor valida caja, calcula impuestos, descuenta stock, emite factura correlativa y registra el movimiento SALE del kardex. |
| **Actor** | Cajero (CASHIER / STAFF) |
| **Precondiciones** | Sesión válida; **caja abierta** para el tenant; ítems existentes y con stock. |
| **Endpoint** | `POST /api/distribution/sales` (body validado por `registerSaleSchema`). |

**Flujo principal**
1. El cajero envía `{ lines: [{ itemId, quantity }], discount, personId?, notes?, paymentMethod, paidAmount? }`.
2. El servidor valida el body (Zod): cantidades positivas, máximo 2 decimales, métodos `CASH | CARD | TRANSFER | CREDIT`.
3. Verifica sesión de caja abierta (sin caja → 400/409).
4. Toma la **tasa default activa** del catálogo y calcula subtotal, `taxAmount` y `total` (todo el cálculo monetario es server-side).
5. Genera el correlativo `INV-YYYYMMDD-NNNNNN` vía `SaleCounter` (incremento en la misma transacción).
6. En una `$transaction`:
   - Crea `Sale` + líneas `SaleItem` (con `cost` snapshot por línea).
   - Descuenta stock con guard `stock >= qty` (`updateMany`); si no alcanza → `409`.
   - Escribe un movimiento `InventoryMovement` tipo `SALE` por línea (cantidad negativa, signo del kardex).
   - Si `paymentMethod = CREDIT` o el pago es parcial, deja `balance > 0` y registra la CxC asociada.
7. Responde la venta; el cliente invalida queries de inventario/caja/dashboard/resumen fiscal/historial.

**Flujos alternos / errores**

| Situación | Resultado |
| :--- | :--- |
| Sin caja abierta | 400/409 («Debe abrir caja») |
| Stock insuficiente | `409` («Stock insuficiente») |
| Item inexistente / cross-tenant | `404` / `400` |
| Body inválido (cantidad 0, >2 decimales, etc.) | `400` |

**Reglas de negocio**
- **Stock solo por movimientos**: el stock nunca se escribe directo desde la UI; cada variación genera una línea de kardex en la misma transacción.
- **IVA inclusivo**: `taxAmount = base × tasa / (100 + tasa)` (Nicaragua, IVA 15% típico).
- **Unicidad de factura**: `@@unique([tenantId, invoiceNumber])`; correlativo por Tenant vía `SaleCounter`.
- `paidAmount` y `balance` se calculan del lado servidor (nunca se confía en el cliente).
- Las cantidades del POS admiten fracciones con **2 decimales** (ej. 2,5 kg) — `Decimal(10,2)`.

**Postcondiciones** → Stock decrementado + kardex SALE + factura correlativa + CxC si aplica.

---

### UC-D14 / UC-D16 · Abrir y cerrar caja

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | El cajero abre una sesión de caja con monto de apertura; durante el día registra movimientos IN/OUT y al cierre ingresa **solo el conteo físico**; el servidor calcula el esperado y la diferencia. |
| **Actor** | Cajero |
| **Endpoints** | `POST /api/distribution/cash` (abrir), `POST /api/distribution/cash/movements`, `POST /api/distribution/cash/close`. |

**Flujo principal (apertura)**
1. Envía `{ branchId, openingAmount, employeeId? }`.
2. El servidor valida (Zod) y crea `CashSession` con estado `OPEN` (una sola caja abierta a la vez por tenant).

**Flujo principal (movimiento)**
1. Envía `{ sessionId, type: IN|OUT, amount, concept }`.
2. El servidor valida y crea `CashMovement` en la sesión.

**Flujo principal (cierre)**
1. Envía `{ sessionId, physicalCount }` — **el único dato del cliente**.
2. El servidor calcula `expectedAmount` y `difference` a partir de apertura + movimientos + ventas, en el servidor.
3. Marca la sesión `CLOSED` con los montos.

**Reglas de negocio**
- El conteo físico es la única entrada de cliente en el cierre; el esperado/diferencia **nunca** vienen del cliente.
- El cierre diario (reporte) opera sobre ventana de calendario **UTC-6 (America/Managua)**.

---

### UC-D7 / UC-D8 · Ajuste de inventario y conteo físico

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | El encargado corrige el stock ante mermas/roturas/vencimientos/sobrantes (ajuste único) o reconcilia todo un lote de ítems (conteo físico). |
| **Actor** | Contador / Admin |
| **Endpoints** | `POST /api/distribution/inventory/adjustments`, `POST /api/distribution/inventory/count`. |

**Flujo principal (ajuste único)**
1. Envía `{ branchId, itemId, quantity (firmado), reason, notes? }`.
2. El servidor valida: motivo en `MERMA | ROTURA | VENCIMIENTO | DESCUADRE | SOBRANTE`.
3. Verifica la **convención de signo**: pérdida → negativo; SOBRANTE → positivo (400 si no coincide).
4. Rechaza ajustes negativos que dejarían stock < 0 (`409`).
5. En una transacción: aplica el cambio de stock + escribe `InventoryMovement` tipo `ADJUSTMENT` con `costSnapshot` (costo unitario al momento).

**Flujo principal (conteo físico)**
1. Envía `{ branchId, items: [{ itemId, countedQuantity }] }`.
2. Por ítem calcula `diff = contado − stock libro`.
3. Omite diferencias cero; crea un ajuste `SOBRANTE` (diff > 0) o `MERMA` (diff < 0) por ítem, todo en una transacción, con nota *«Diferencia por conteo físico»*.

**Reglas de negocio**
- `DESCUADRE` cubre diferencias sin clasificar (nunca se etiqueta «robo»).
- El kardex respalda la merma: `MermaSummary` suma `costSnapshot × |qty|` de negativos y los sobrantes por separado.
- Cantidades con máximo 2 decimales, fracciones permitidas.

---

### UC-D11 / UC-D12 · Orden de compra y recepción

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | El administrativo genera órdenes de compra a proveedores y recepciona mercadería (total o parcial), lo que incrementa stock con movimientos `RECEIVE`. |
| **Actor** | Administrativo / Gerente / TENANT_ADMIN |
| **Endpoints** | `POST /api/distribution/purchase-orders`, `POST /api/distribution/purchase-orders/[id]/receive`. |

**Flujo principal (crear)**
1. Envía `{ supplierId, branchId, items: [{ itemId, quantity }], notes?, expectedDate? }`.
2. El servidor valida y rechaza **proveedores inactivos** (`isActive: false`) en la selección de OC.
3. Crea `PurchaseOrder` (estado inicial) con líneas `PurchaseOrderItem` (`receivedQty = 0`).

**Flujo principal (recepción)**
1. Envía `{ receivedItems: [{ itemId, quantity }] }` (0 < qty ≤ pendiente).
2. El servidor avanza `receivedQty` por línea y valida el tope contra la cantidad pendiente (`409` si se excede).
3. En la misma transacción escribe movimientos `RECEIVE` positivos y suma stock en la sucursal.

**Estados de OC** → `PENDING` / `ORDERED` / `RECEIVED` / `CANCELLED` (ver `UML_DIAGRAMS.md` §5).

---

### UC-D4 · Devolver / anular venta

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | Devuelve ítems de una venta: restaura stock, ajusta la CxC si la venta fue a crédito y deja un registro auditable. |
| **Actor** | Contador / Admin |
| **Endpoint** | `POST /api/distribution/sales/[id]/returns` |

**Flujo principal**
1. Envía `{ items: [{ itemId, quantity }], reason? }` (cantidad ≤ vendida, 2 decimales).
2. El servidor valida la **devolución acumulada**: devuelto ≤ vendido (acumulando devoluciones previas) → `409` si se excede (over-return).
3. En una transacción:
   - Crea `SaleReturn` + líneas con `refundAmount`.
   - Restaura stock en la sucursal de la venta.
   - Escribe movimientos `RETURN` (positivos).
   - Si la venta tenía crédito, ajusta el saldo de la CxC (reembolso > saldo restante → `409`).
4. Responde la devolución; la UI la lista en el historial de devoluciones (`GET /api/distribution/returns`).

**Reglas de negocio**
- El reembolso total se registra; la devolución es auditada (fecha, usuario, motivo).
- Las devoluciones están ligadas a la `Sale`, la `CashSession` (si aplica) y sus ítems.

---

### UC-D21 · Cobrar cuenta por cobrar

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | Aplica un pago sobre una CxC de una venta a crédito, reduciendo el saldo. |
| **Actor** | Contador / Admin |
| **Endpoint** | `POST /api/distribution/receivables/[id]/pay` |

**Flujo principal**
1. Envía `{ amount, method }` — métodos permitidos: `CASH | CARD | TRANSFER` (el **crédito nunca es método de cobro**).
2. El servidor valida `0 < amount ≤ saldo restante` (sobrepago → `409`).
3. En una transacción: crea `ReceivablePayment`, reduce `balance`, actualiza estado de la CxC (`PARTIAL` mientras quede saldo, `PAID` al llegar a cero).

**Estados de CxC** → `OPEN` → `PARTIAL` → `PAID` (ver `UML_DIAGRAMS.md` §5).

---

### UC-G1 · Check-in de socio (Gimnasio)

| Campo | Detalle |
| :--- | :--- |
| **Resumen** | La recepción busca al socio por documento o ID y verifica su membresía; otorga o deniega acceso y registra el intento en `GymAccessLog`. |
| **Actor** | Recepcionista; socio presenta documento/ID |
| **Precondiciones** | Módulo Gym activo; hoy opera sobre **mock** (`MockGymRepository`), el `tenantId` se deriva de la sesión. |

**Flujo principal (`CheckInAccessUseCase.execute`)**
1. El recepcionista ingresa documento o ID (input no vacío, en `GymCheckInView`).
2. El caso de uso busca persona con membresía (`findPersonWithMembership` por `documentId` **o** `personId`).
3. Si no existe → denegado «Socio no encontrado» (sin log).
4. Si no tiene membresía → denegado «no posee ninguna membresía registrada».
5. Si la membresía está vencida (`endDate < now`) o su estado ≠ `ACTIVE` → denegado con motivo («Membresía Vencida», «Estado: …») y **registra el acceso con `granted: false`**.
6. Si está activa y vigente → **acceso concedido**, registra `granted: true`.
7. La UI muestra feedback visual verde/rojo + mensaje.

**Reglas de negocio**
- Todo intento (concedido o denegado con membresía) queda en `GymAccessLog` (auditoría).
- El estado `ACTIVE` más la fecha de vigencia determinan el acceso.

**Postcondiciones** → Log de acceso escrito; recepción informada (verde/rojo).

---

## 5. ENDPOINTS RELACIONADOS (RESUMEN)

| Área | Endpoints |
| :--- | :--- |
| **Auth** | `POST /api/auth/login`, `POST /api/auth/pos-login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| **Admin plataforma** | `GET|POST /api/admin/tenants`, `PATCH /api/admin/tenants/[id]` |
| **Distribución** | `GET|POST /api/distribution/sales`, `POST .../sales/[id]/returns`, `GET .../sales` (historial), `GET|POST .../inventory`, `PATCH|DELETE .../inventory/[id]`, `GET .../inventory/movements`, `GET|POST .../inventory/adjustments`, `POST .../inventory/count`, `GET|POST .../cash`, `POST .../cash/movements`, `POST .../cash/close`, `GET|POST .../suppliers`, `PATCH .../suppliers/[id]`, `GET|POST .../purchase-orders`, `POST .../purchase-orders/[id]/receive`, `GET|POST .../employees`, `PATCH .../employees/[id]`, `GET|POST .../customers`, `PATCH .../customers/[id]`, `GET|POST .../tax`, `PATCH|DELETE .../tax/[id]`, `GET .../tax/summary`, `GET|PUT .../tax/config`, `GET .../receivables`, `POST .../receivables/[id]/pay`, `GET .../returns`, `GET .../reports/daily-close`, `GET .../dashboard`, `GET|PUT .../settings` |
| **Gym** | 🔜 En hoja de ruta (no existen rutas `/api/gym/*` todavía) |

> Convención de errores en toda la API: `400` body inválido, `401` sin sesión/credenciales, `403` permisos o tenant desactivado, `404` recurso inexistente o cross-tenant, `409` conflicto de negocio (stock, over-return, sobrepago, SKU duplicado). Mensajes en español.