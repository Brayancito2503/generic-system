# 🗺️ PLAN.md — CAMINO AL 100% (Roadmap de Cierre)

> **Generic System** — SaaS Multi-Tenant Multi-Rubro.
> Este documento define **qué falta** (verificado contra el estado real del repo) y el **orden de ejecución** para llegar a una app completa y desplegable.

---

## 1. ESTADO ACTUAL (VERIFICADO)

| Área | Estado | Evidencia |
| :--- | :--- | :--- |
| Auth JWT + sesión multi-tenant | ✅ Hecho | `/api/auth/login|logout|me`, `middleware.ts`, `src/lib/session.ts` |
| Tenancy server-side (anti-spoofing) | ✅ Hecho | `requireTenantId`/`requireApiAuth` en todas las rutas `/api/distribution/*` |
| Core entities + ports | ✅ Hecho | `src/core/entities/*`, `src/core/ports/*` |
| Esquema Prisma (Core + Gym + Distribution) | ✅ Hecho | `prisma/schema.prisma` + migraciones documentadas |
| **Vertical Distribution (POS, inventario, caja, proveedores, empleados, IVA/CAI, historial, dashboard)** | ✅ Hecho E2E | 13 rutas `/api/distribution/*` + vistas conectadas |
| Seed demo (tenant distribuidora-sanjose, usuarios, ventas) | ✅ Hecho | `prisma/seed.ts` |
| **Vertical Gym (membresías, check-in, dashboard)** | ⚠️ **Incompleta** | Solo `check-in-access.use-case.ts` + `GymCheckInView` + página placeholder |
| **Anti-spoofing en Gym** | ❌ **Violado** | `dashboard/modules/gym/page.tsx` pasa `tenantId="powerfit-gym"` hardcodeado |
| **APIs de Gym** | ❌ No existen | No hay `/api/gym/*` |
| **Admin / gestión de usuarios y roles** | ❌ Falta | No hay sección admin ni CRUD de usuarios |
| **Onboarding multi-tenant (registro + selección)** | ❌ Falta | Solo existe `/login`; sin signup ni selector de tenant |
| **Sidebar dinámica por módulos activos** | ❌ Falta | Rutas fijas; no consume `tenant.modules` |
| **Validación Zod en APIs** | ❌ Parcial | Revisión pendiente ruta por ruta |
| **Tests automatizados** | ❌ No hay | Sin unit ni E2E |
| **Entorno dev estable (Turbopack/OneDrive)** | ⚠️ Bug conocido | Chunks corruptos por OneDrive; workaround webpack |

---

## 2. FASES DE CIERRE

### 🔧 FASE 0 — Entorno de desarrollo y build estable (prerequisito)

**Objetivo**: que `npm run dev` y `npm run build` funcionen de forma confiable en la máquina.

1. **Resolver el bug de OneDrive/Turbopack**: el proyecto vive en `OneDrive\Escritorio\Proyectos\Generic System` y OneDrive corrompe los chunks internos que Turbopack reescribe en cada recompilación (`.next/static/chunks/node_modules_next_dist_*` → SyntaxError en el navegador).
   - Opciones: (a) mover el repo fuera de OneDrive; (b) excluir `.next/` y `node_modules/` de la sincronización; (c) mantener webpack como workaround hasta migrar.
2. **Verificación de salida**: `npm run dev` con hot-reload sano + `npm run build` en producción sin errores.
3. **Regenerar seed**: `npm run db:seed` para tener datos demo frescos.

---

### 🏋️ FASE 1 — Completar la Vertical GYM (la "prueba de fuego" pendiente)

**Objetivo**: llevar Gym al mismo nivel E2E que Distribution (dominio → puerto → adaptador → API → React Query → UI).

#### 1.1 Corregir anti-spoofing (crítico)
- Eliminar `tenantId="powerfit-gym"` hardcodeado de `dashboard/modules/gym/page.tsx`.
- Derivar `tenantId` SIEMPRE de la sesión en el servidor (mismo patrón `requireTenantId` de Distribution).
- El cliente nunca envía `tenantId` en query ni body.

#### 1.2 Modelo Gym en Prisma (si falta) + repositorio
- `GymMembership`: planes asociados a `Item` con `isService = true` (ya existe en schema).
- `GymAccessLog` (ya existe en schema).
- Verificar índices multi-tenant y `@@unique` necesarios.

#### 1.3 Casos de uso Gym (patrón Distribution)
- **Check-in / acceso**: buscar socio (DNI, QR o manual), validar membresía activa (verde/rojo), registrar `GymAccessLog` con `granted` y `denialReason`. *(use-case ya existe; conectar E2E)*.
- **Membresías**: asignar plan a socio, renovar, congelar, cancelar; historial.
- **Planes**: CRUD de planes de membresía (Items servicio).

#### 1.4 APIs `/api/gym/*`
- `plans`, `memberships`, `check-in`, `dashboard` — mismo patrón de auth y errores (400/401/404/409, mensajes en español).

#### 1.5 UI Gym completa
- **Check-in**: vista de recepción (scan DNI/QR + búsqueda manual), feedback visual verde/rojo. *(GymCheckInView existe; conectarla a la API sin tenantId del cliente)*.
- **Membresías**: gestión de socios y sus membresías.
- **Dashboard gym**: socios activos, membresías por vencer este mes, ingresos por membresías, asistencias de hoy.

#### 1.6 Seed Gym + validación E2E
- Seed: tenant `powerfit-gym` + socios, planes, membresías activas/vencidas, accesos.
- Validadción E2E: registrar socio → venderle membresía en POS → check-in → verificar métricas del dashboard.

**Criterio de salida**: Gym opera completo end-to-end con el tenant demo, igual que Distribution.

---

### 👤 FASE 2 — Admin del Tenant y usuarios

**Objetivo**: que el administrador del tenant administre su propia organización.

1. **Gestión de usuarios y roles**: CRUD de usuarios (`TENANT_ADMIN`, `STAFF`), reset de password y PIN POS.
2. **Panel Admin del tenant**: configuración general (`Tenant.settings` — logo, tema, nombre, datos fiscales).
3. **Sidebar dinámica**: mostrar/ocultar módulos según `tenant.modules` (hoy las rutas son fijas).

---

### 🚀 FASE 3 — Onboarding multi-tenant real

**Objetivo**: alta de nuevos clientes sin intervención manual.

1. **Registro de tenant (signup)**: crear tenant + primer `TENANT_ADMIN` + módulos activos + seed inicial del rubro elegido.
2. **Selección de tenant**: para `SUPER_ADMIN`, selector de tenant después del login.
3. **Activación de módulos**: feature flags por tenant operativos de punta a punta.

---

### 🛡️ FASE 4 — Robustez, tests y producción

**Objetivo**: calidad y despliegue real.

1. **Validación Zod en todas las APIs**: inputs tipados y validados (revisar las 13 rutas distribution + nuevas gym).
2. **Tests**: unit de use-cases críticos (check-in, venta con stock, IVA) + E2E de flujos (login → POS → cierre de caja).
3. **Migraciones trazables**: adoptar `prisma migrate` en entorno controlado (DATABASE.md advierte que hoy es `db push` + SQL manual).
4. **Hardening de seguridad**: rate-limit en login, headers de seguridad, revisión de cookies (`httpOnly`, `secure`).
5. **Deploy**: Neon (ya definido) + plataforma de hosting (Vercel/Railway/Render), variables de entorno, build de producción verificado.
6. **i18n y polish**: revisar `messages/` para cubrir pantallas faltantes.

---

## 3. ¿QUÉ SIGNIFICA "100%"?

Definición mínima propuesta (ajustable):

> **APP 100% = entorno estable (F0) + core genérico operativo + 2 verticales funcionales E2E (Distribution ✅ + Gym ✅) + admin de tenant (F2) + onboarding multi-tenant (F3) + tests/buid/deploy (F4).**

Cualquier vertical adicional (pharmacy, restaurant, retail) se agrega después como repetición del patrón demostrado por Distribution/Gym.

---

## 4. ORDEN DE EJECUCIÓN SUGERIDO

```
F0 (entorno estable)  →  F1 (GYM completo)  →  F2 (admin+usuarios)  →  F3 (onboarding)  →  F4 (tests+deploy)
```

- **F0** es prerequisito de todo: sin dev estable no se puede avanzar con confianza.
- **F1** cierra la promesa central del proyecto ("primera vertical de prueba de fuego") y valida el patrón de verticales para el resto.
- **F2–F3** hacen el producto vendible como SaaS multi-cliente.
- **F4** lo vuelve desplegable y mantenible.

---

## 5. NOTA DE EJECUCIÓN

Cada fase se implementa siguiendo el contrato SDD (proposal → spec → design → tasks → apply → verify → archive) y las reglas inviolables de `AGENTS.md` (aislamiento por `tenantId`, cero `any`, Clean Architecture, cero suposiciones: inspeccionar `schema.prisma` y puertos antes de tocar código).