# 🤖 AGENTS.md — GUÍA TÉCNICA Y DIRECTRICES PARA IAs & DESARROLLADORES

> **Documento de Contexto Operativo**: Este archivo está diseñado para ser leído de forma prioritaria por cualquier Agente de Inteligencia Artificial (LLM) o desarrollador humano que trabaje en la base de código de **Generic System**.

---

## 📌 1. PROPÓSITO GENERAL DEL PROYECTO

**Generic System** es un motor **SaaS Multi-Tenant de marca blanca** diseñado bajo un enfoque de **Monolito Modular Extensible**. 

### Principios Universales del Sistema:
1. **Núcleo Genérico Unificado (Core Engine)**: Existe una **única base de código desplegada** que atiende a múltiples clientes (Tenants) de distintas industrias (Gimnasios, Farmacias, Restaurantes, Distribuidoras, Retail, etc.).
2. **Cero Forks por Cliente o Rubro**: NUNCA se crean repositorios o aplicaciones separadas por rubro.
3. **Módulos Verticales Activables**: Las funcionalidades específicas de un rubro viven como módulos dentro de `src/modules/<vertical>` y se activan dinámicamente según la suscripción y permisos del Tenant (`tenant.modules`).
4. **Modelo Polimórfico**: Las entidades centrales (`Person`, `Item`, `Tenant`) utilizan campos `JSONB` (`metadata`, `attributes`, `settings`) para extender atributos de negocio sin alterar la estructura SQL base.

---

## 🛠️ 2. STACK TECNOLÓGICO EXACTO

Toda contribución de código debe respetar estrictamente el stack de tecnologías y librerías instaladas:

| Capa | Tecnología / Librería | Versión Exacta |
| :--- | :--- | :--- |
| **Framework Web** | Next.js (App Router) | `^16.1.6` |
| **Biblioteca UI** | React / React DOM | `19.2.3` |
| **Estilos CSS** | Tailwind CSS (PostCSS) | `^4.0.0` |
| **Componentes UI Base**| Shadcn UI / Radix UI | Componentes en `src/components/ui` |
| **Iconografía** | Lucide React / Heroicons | `lucide-react ^0.563.0` |
| **Base de Datos** | PostgreSQL (Neon Serverless) | `@neondatabase/serverless ^1.0.2` |
| **ORM** | Prisma ORM | `5.22.0` |
| **Data Fetching & Cache** | TanStack React Query | `^5.90.20` |
| **Estado Global UI** | Jotai | `^2.18.1` |
| **Internacionalización**| next-intl | `^4.8.2` |
| **Validación de Tipos** | Zod / TypeScript | `TypeScript ^5` |

---

## 🚨 3. REGLAS INVIOLABLES DE DESARROLLO

### 🔒 Rule #1: Aislamiento Estricto de Multi-Tenancy
- **CERO LEAKS ENTRE TENANTS**: Toda consulta SQL, llamada a Prisma ORM o búsqueda en repositorio **DEBE incluir `tenantId` en la cláusula `where`**.
- Ej: `prisma.person.findFirst({ where: { tenantId, id } })`.
- Nunca expongas endpoints o use cases que reciban una entidad sin asociarla a su `tenantId`.
- **Server-side only**: el `tenantId` se deriva SIEMPRE de la sesión autenticada (`requireTenantId`/`requireApiAuth` en `src/lib/session.ts`). El cliente NO debe enviar `tenantId` como query param ni en el body (anti-spoofing).

### 🔒 Rule #2: Prohibido usar `any` en TypeScript
- Todo el código debe tener **tipado estricto**.
- Los objetos dinámicos `JSONB` de Prisma deben tiparse mediante interfaces explícitas o esquemas Zod (ej. `PersonMetadata`, `GymItemAttributes`).

### 🔒 Rule #3: Respetar la Arquitectura en Capas (Clean Architecture)
- **Dominio Core (`src/core`)**: NO puede importar nada de `src/infrastructure` ni de `src/modules`. El núcleo es agnóstico a la base de datos y a la UI.
- **Módulos Verticales (`src/modules`)**: Dependen únicamente del Core (`src/core`) o de sus propios puertos de dominio.
- **Infraestructura (`src/infrastructure`)**: Implementa los puertos definidos en `src/core/ports`.

---

## 🛑 4. DIRECTRIZ PRINCIPAL PARA IA: CERO SUPOSICIONES (ZERO ASSUMPTIONS)

> [!CRITICAL]
> **REGLA ABSOLUTA PARA LA IA**:
> 1. **NUNCA supongas ni infieras** nombres de tablas, campos de base de datos, métodos de API o lógica de negocio.
> 2. **Inspecciona siempre el código fuente real** (`prisma/schema.prisma`, interfaces en `src/core/ports/`, etc.) antes de generar o proponer un cambio.
> 3. **Si existe cualquier ambigüedad en los requerimientos del usuario, PREGUNTA explícitamente** antes de implementar o modificar código.

---

## 🏷️ 5. CONVENCIONES DE NOMENCLATURA Y ARCHIVOS

### Estructura y Sufijos de Archivos
- **Entidades de Dominio**: `[nombre].entity.ts` o `[nombre].ts` dentro de `src/core/entities/` (ej: `person.ts`, `gym.ts`).
- **Puertos de Repositorio**: `[nombre]-repository.port.ts` en `src/core/ports/` (ej: `gym-repository.port.ts`).
- **Casos de Uso**: `[accion]-[entidad].use-case.ts` en `use-cases/` (ej: `check-in-access.use-case.ts`).
- **Repositorios Concretos**: `prisma-[nombre].repository.ts` o `mock-[nombre].repository.ts` en `src/infrastructure/db/repositories/`.
- **Componentes React**: PascalCase en `.tsx` (ej: `GymCheckInView.tsx`, `Header.tsx`).

### Convención de Código
- **Interfaces de Puertos**: Prefijo `I` (ej. `IGymRepository`, `IPersonRepository`).
- **Interfaces de Entidades**: Sufijo `Entity` (ej. `PersonEntity`, `GymMembershipEntity`).
- **Variables y Funciones**: camelCase (ej. `findPersonWithMembership`).
- **Constantes o Enums**: UPPER_SNAKE_CASE (ej. `MembershipStatus`).

---

## 📁 6. MAPA RÁPIDO DEL REPOSITORIO

```text
src/
├── app/                     # App Router de Next.js (Rutas i18n [locale])
│   └── [locale]/
│       ├── (auth)/          # Autenticación y Login
│       └── dashboard/       # Panel Principal Multi-Tenant
│           └── modules/     # Vistas por módulo (gym, distribution, etc.)
├── core/                    # Núcleo Agnóstico (Clean Architecture)
│   ├── entities/            # Modelos puros de TypeScript (User, Person, Item, Tenant)
│   └── ports/               # Interfaces / Contratos (IGymRepository, IPersonRepository)
├── infrastructure/          # Implementación Técnica de Infraestructura
│   └── db/
│       ├── prisma.ts        # Cliente global de Prisma
│       └── repositories/    # Adaptadores Prisma (PrismaGymRepository, MockGymRepository)
├── modules/                 # Lógica Específica de Verticales (Plugins)
│   ├── gym/                 # Casos de uso y componentes específicos de gimnasios
│   └── distribution/        # Casos de uso y entidades de distribución/proveedores
├── components/              # Sistema de Diseño UI
│   ├── ui/                  # Componentes atómicos (Shadcn UI)
│   └── shared/              # Tablas, Modales, Headers globales
└── lib/                     # Configuración de Axios, TanStack Query y Utilidades
```
