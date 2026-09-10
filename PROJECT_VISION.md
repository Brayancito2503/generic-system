# PROJECT VISION & ARCHITECTURE SPECIFICATION: GENERIC SYSTEM (SAAS MULTI-TENANT)

## 📌 1. RESUMEN EJECUTIVO Y OBJETIVO DEL PROYECTO

**Generic System** es una plataforma **SaaS Multi-Tenant de marca blanca** diseñada bajo una arquitectura modular y escalable. Su propósito es actuar como un **núcleo genérico unificado (Core Engine)** sobre el cual se pueden activar diferentes **Verticales de Negocio** (Gimnasios, Farmacias, Restaurantes, Retail, etc.) sin necesidad de duplicar código ni mantener múltiples repositorios.

 CUALQUIER IA O DESARROLLADOR QUE LEA ESTE DOCUMENTO DEBE ENTENDER QUE:
1. **NO hacemos aplicaciones separadas por rubro (forks)**. Hay una **única base de código** desplegada.
2. **El modelo de datos es polimórfico y extensible**: Las entidades centrales (`Person`, `Item`) utilizan campos `JSONB` para atributos específicos del rubro.
3. **Las verticales son módulos activables por Tenant**: Un cliente (Tenant) de tipo Gimnasio tiene activo el módulo de `gym` (membresías, accesos), mientras que un Restaurante tiene activo el módulo de `restaurant` (cocina, mesas).
4. **Fixes y mejoras en el Core benefician automáticamente a todos los clientes**.

---

## 🛠️ 2. STACK TECNOLÓGICO Y ARQUITECTURA

### Stack Tecnológico Principal
- **Framework**: Next.js 16.1+ (App Router)
- **UI & Estilos**: React 19, Tailwind CSS v4, Shadcn/ui, Radix UI, Lucide Icons
- **Base de Datos**: PostgreSQL (Neon Serverless) + Prisma ORM
- **Estado & Data Fetching**: TanStack React Query v5, Jotai
- **Autenticación**: NextAuth.js (Auth.js v5) / JWT Multi-Tenant
- **Internacionalización**: next-intl
- **Arquitectura**: Clean Architecture + Domain-Driven Design (DDD) + Feature Flags

### Estructura de Directorios Objetivo (Clean Architecture + Modules)

```text
src/
├── app/                        # Next.js App Router (Rutas y Páginas)
│   ├── [locale]/               # i18n
│   │   ├── (auth)/             # Login, registro, selección de tenant
│   │   ├── (dashboard)/        # Panel administrativo general
│   │   │   ├── admin/          # Configuración global del Tenant
│   │   │   ├── inventory/      # Gestión de Ítems / Stock
│   │   │   ├── customers/      # CRM / Personas
│   │   │   ├── sales/          # POS / Ventas
│   │   │   └── modules/        # Rutas dinámicas según módulo activo
│   │   │       ├── gym/        # Vistas de Membresías, Accesos, Entrenadores
│   │   │       └── restaurant/ # Vistas de Cocina, Mesas (código migrado)
│   │   └── api/                # Handlers API / Webhooks
├── core/                       # DOMINIO Y REGLAS DE NEGOCIO REUSABLES (CORE)
│   ├── entities/               # Modelos de dominio (User, Person, Item, Tenant, Sale)
│   ├── use-cases/              # Casos de uso (CreateItem, RegisterPerson, ProcessSale)
│   └── ports/                  # Interfaces / Contratos de repositorios
├── infrastructure/             # IMPLEMENTACIÓN TÉCNICA
│   ├── db/                     # Prisma Client & Repositorios concretos
│   ├── auth/                   # Configuración Auth.js / NextAuth
│   └── tenant/                 # Resolver de Tenant (Middleware, Context)
├── modules/                    # MÓDULOS VERTICALES (ESPECÍFICOS DE RUBRO)
│   ├── gym/                    # Entidades, Use Cases y Componentes exclusivos de GYM
│   ├── restaurant/             # Entidades, Use Cases y Componentes de Restaurante
│   └── pharmacy/               # Entidades, Use Cases y Componentes de Farmacia
├── components/                 # COMPONENTES DE UI
│   ├── ui/                     # Atómicos (Shadcn)
│   └── shared/                 # Componentes genéricos (Tablas, Modales, Headers)
└── lib/                        # Configuración global, utilidades y Zod schemas
```

---

## 🗄️ 3. MODELO DE DATOS CORE (PRISMA SCHEMA)

El esquema de base de datos soporta Multi-Tenancy nativo vía `tenantId` en todas las tablas principales.

```prisma
// Esquema conceptual unificado
model Tenant {
  id          String   @id @default(uuid())
  slug        String   @unique // Ej: "fit-gym", "farmacia-central"
  name        String
  industry    Industry @default(GENERIC) // GYM, RESTAURANT, PHARMACY, RETAIL
  modules     String[] // ["gym_memberships", "pos", "inventory"]
  settings    Json     @default("{}") // Temas, logo, reglas de negocio
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]
  persons     Person[]
  items       Item[]
  sales       Sale[]
  branches    Branch[]
}

model Branch {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  address     String?
  createdAt   DateTime @default(now())
}

enum Role {
  SUPER_ADMIN
  TENANT_ADMIN
  STAFF
  CUSTOMER
}

model User {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email       String
  password    String
  role        Role     @default(STAFF)
  personId    String?  @unique
  person      Person?  @relation(fields: [personId], references: [id])
  createdAt   DateTime @default(now())
  
  @@unique([tenantId, email])
}

// Entidad Polimórfica para Clientes, Empleados, Socios de Gym, Pacientes, etc.
model Person {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  firstName   String
  lastName    String
  email       String?
  phone       String?
  documentId  String?  // DNI / Cédula / Passport
  metadata    Json     @default("{}") // Atributos extra (ej. GYM: foto, fecha_nacimiento, huella_id)
  createdAt   DateTime @default(now())
  
  user        User?
  sales       Sale[]
  gymMember   GymMembership? // Relación opcional para vertical de GYM
}

// Entidad Polimórfica para Productos, Servicios, Membresías de GYM, Platos
model Item {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sku         String?
  name        String
  description String?
  cost        Decimal  @db.Decimal(10, 2)
  price       Decimal  @db.Decimal(10, 2)
  isService   Boolean  @default(false)
  attributes  Json     @default("{}") // GYM: { "durationDays": 30, "accessZone": "VIP" }
  createdAt   DateTime @default(now())
  
  inventory   Inventory[]
  saleItems   SaleItem[]
}

model Inventory {
  id          String   @id @default(uuid())
  tenantId    String
  itemId      String
  item        Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  branchId    String
  stock       Int      @default(0)
  minAlert    Int      @default(5)
  
  @@unique([tenantId, itemId, branchId])
}

model Sale {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  personId    String?
  person      Person?  @relation(fields: [personId], references: [id])
  total       Decimal  @db.Decimal(10, 2)
  status      String   @default("COMPLETED")
  createdAt   DateTime @default(now())
  
  items       SaleItem[]
}

model SaleItem {
  id          String   @id @default(uuid())
  saleId      String
  sale        Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  itemId      String
  item        Item     @relation(fields: [itemId], references: [id])
  quantity    Int
  price       Decimal  @db.Decimal(10, 2)
}

// --- EXTENSIÓN VERTICAL: MÓDULO GYM ---
model GymMembership {
  id          String   @id @default(uuid())
  tenantId    String
  personId    String   @unique
  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  planName    String   // Ej: "Pase Mensual VIP"
  startDate   DateTime
  endDate     DateTime
  status      String   @default("ACTIVE") // ACTIVE, EXPIRED, FROZEN, CANCELLED
  createdAt   DateTime @default(now())
  
  accessLogs  GymAccessLog[]
}

model GymAccessLog {
  id           String        @id @default(uuid())
  tenantId     String
  membershipId String
  membership   GymMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  accessTime   DateTime      @default(now())
  granted      Boolean       @default(true)
  denialReason String?
}
```

---

## 🎯 4. HOJA DE RUTA (ROADMAP DE DESARROLLO)

### FASE 1: Producto Base Core (Foundation)
1. **Configuración de Prisma & PostgreSQL Multi-Tenant**: Crear esquema base e integrar migraciones.
2. **Sistema de Autenticación & Resolutor de Tenant**: Middleware de Next.js para detectar el tenant por subdominio o header.
3. **Clean Architecture Core Domain**: Entidades `Person`, `Item`, `Inventory`, `Sale` y repositorios.
4. **UI Base (Shadcn/ui & Layout Multi-tenant)**: Sidebar dinámica que oculta o muestra módulos según los permisos del Tenant.
5. **Módulos Core Funcionales**:
   * CRUD Polimórfico de Personas (Clientes/Socios).
   * Catálogo Universal de Ítems (Productos y Servicios).
   * Punto de Venta (POS) Genérico y Facturación.
   * Control de Inventario por Sucursal.

### FASE 2: Primera Vertical - Módulo GYM (Prueba de Fuego)
1. **Modelado y Casos de Uso del GYM**:
   * Gestión de Planes de Membresía (asociados a `Item` con `isService = true`).
   * Asignación de Membresías a Personas (`GymMembership`).
2. **Control de Acceso / Check-in**:
   * Vista de molinete/recepción para escaneo de DNI, código QR o búsqueda manual de socio.
   * Verificación inmediata de estado de membresía (Verde: Activo, Rojo: Vencido/Deuda).
   * Registro automático en `GymAccessLog`.
3. **Dashboard Especializado de GYM**:
   * Métricas: Socios Activos, Membresías por Vencer este mes, Ingresos por Membresías, Asistencias de hoy.
4. **Validación E2E**: Registrar un gimnasio de prueba, dar de alta un socio, venderle una membresía en el POS, registrar accesos y validar reportes.

---

## 🔒 5. REGLAS ARQUITECTÓNICAS INVIOLABLES
1. **Aislamiento Estricto por Tenant**: Toda consulta a la base de datos DEBE incluir `tenantId`.
2. **Cero Duplicación de Código de Rubros**: No crear repositorios o aplicaciones independientes por rubro. Las verticales viven en `src/modules/<rubro>` dentro de la misma aplicación.
3. **Tipado Estricto (TypeScript & Zod)**: No usar `any`. Validar siempre los metadatos JSONB con esquemas de Zod específicos por módulo.
