# 🗄️ DATABASE.md — CONTEXTO DE LA BASE DE DATOS

> Guía operativa del esquema y su gestión. Para reglas de arquitectura ver `ARCHITECTURE.md`; para convenciones de código, `AGENTS.md`.

---

## 1. CONEXIÓN

- **Motor**: PostgreSQL (Neon Serverless).
- **Variables** (en `.env`, ignorado por git):
  - `DATABASE_URL`: pooled connection string usada por la app en runtime (`src/infrastructure/db/prisma.ts`).
  - `DIRECT_URL`: conexión sin pooler, usada por **scripts** (`prisma/seed.ts`) porque el pooler corta sesiones largas (P1017).
- Cliente global de Prisma: `src/infrastructure/db/prisma.ts` (singleton).
- **NUNCA** commitear credenciales; `.env*` está en `.gitignore`.

## 2. ESTADO DE MIGRACIONES (IMPORTANTE)

- La base de datos **NO tiene tabla `_PrismaMigrations`**: el schema inicial se aplicó vía `prisma db push` / SQL directo, no por `prisma migrate dev`.
- La carpeta `prisma/migrations/` es **documentación** de los cambios aplicados manualmente:
  - `20260909120000_init` — schema inicial.
  - `20260910070000_invoice_correlative` — `SaleCounter`, `invoiceNumber` NOT NULL + índice único.
- **`prisma migrate dev` falla en entornos no interactivos y puede ofrecer un reset destructivo.** No usarlo sin supervisión.

### Cómo aplicar un cambio de schema

1. Editar `prisma/schema.prisma`.
2. `npx prisma generate` (regenera el cliente; requiere que ningún proceso tenga abierto `node_modules/.prisma/client/query_engine-*.dll.node` — cerrar `npm run dev` si da `EPERM`).
3. Aplicar el DDL a la BD con SQL directo (cliente con `DIRECT_URL`), replicando el cambio en un `migration.sql` para trazabilidad.

## 3. MODELOS

### Bloque Core (universal por Tenant)

| Modelo | Notas |
| :--- | :--- |
| `Tenant` | Cliente SaaS; `slug` único; `modules String[]` (feature flags verticales); `settings JSONB` |
| `Branch` | Sucursal física por Tenant |
| `User` | Usuarios con roles (`SUPER_ADMIN`, `TENANT_ADMIN`, `STAFF`, `CUSTOMER`) |
| `Person` | Polimórfica (cliente/empleado): `metadata JSONB`, `documentId` |
| `Item` | Polimórfica (producto/servicio): `attributes JSONB`, `cost`/`price` |
| `Inventory` | Stock por `Item` y `Branch`; `minAlert` |
| `Sale` / `SaleItem` | Facturas y líneas de venta (POS) |
| `SaleCounter` | Correlativo secuencial de facturas por Tenant |

### Bloque Vertical: Gym

`GymMembership`, `GymAccessLog`.

### Bloque Vertical: Distribution

`Supplier`, `PurchaseOrder`, `Employee` (se une a `Person`), `CashSession`, `CashMovement`, `TaxRate`.

## 4. REGLAS DE INTEGRIDAD Y MULTI-TENANCY

- **`tenantId` es obligatorio en TODA consulta** (aislamiento estricto, ver `AGENTS.md` Rule #1). Toda tabla vertical referencia `Tenant` con FK `ON DELETE CASCADE` + campo `tenantId` indexado.
- **`Item`**: `@@unique([tenantId, sku])` — el SKU es único por Tenant. La capa de repositorio verifica y devuelve "El SKU ya existe" (409).
- **`Sale`**: `@@unique([tenantId, invoiceNumber])` — no pueden existir facturas repetidas.
- **Correlativo de facturas**: `SaleCounter` (uno por Tenant) se incrementa **dentro de la misma transacción** de la venta (`registerSale`). Formato: `INV-YYYYMMDD-000001`. Es una secuencia interna; el correlativo fiscal del rango CAI/DGI se integra cuando se persista la config CAI.

## 5. MODELO FISCAL (Vertical Distribution, Nicaragua)

- `TaxRate`: `rate Decimal(5,2)`, `isInclusive Boolean` (el precio **incluye** el impuesto), `isActive`, `isDefault`.
- **`isDefault` es único por Tenant** (lo garantiza el repositorio: al marcar una tasa como default, limpia las demás).
- La venta (POS) aplica la tasa **default activa**; con precio inclusivo el IVA contable se calcula como `precio × tasa / (100 + tasa)`.
- Catálogo editable (agregar/editar/eliminar/predeterminar) + resumen fiscal del mes (ventas, IVA recaudado, utilidad bruta).
- Contexto Nicaragua: IVA (15% general, 10% productos básicos), DGI, RUC; moneda C$/NIO.

## 6. SEED (`npm run db:seed`)

- **DESTRUCTIVO**: borra todos los registros de las tablas y recrea el demo.
- Crea tenant `slug = distribuidora-sanjose` (el `id` es `uuid()` aleatorio por corrida; resolver siempre por `slug`), sucursal **Sucursal Central Managua**, 10 ítems con inventario, 3 proveedores, 3 órdenes de compra, empleados, clientes, 3 tasas IVA (default 15%), caja abierta con movimientos y 16 ventas de los últimos 7 días (números `FAC-1000...` correlativos).
- Corre contra `DIRECT_URL`.

## 7. DATOS Y CONCURRENCIA

- El descuento de stock en venta usa `updateMany` con guard `stock: { gte: quantity }` dentro de la transacción → "Stock insuficiente" si no alcanza.
- Fechas: `timestamptz` (UTC) en BD; formato de UI en `es-NI` (C$).
- Búsquedas de cliente vía `contains` case-sensitive (Prisma `mode: 'insensitive'` requiere preview flag).