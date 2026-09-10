# 🤖 Generic System

Motor **SaaS Multi-Tenant de marca blanca** (Monolito Modular Extensible) para múltiples industrias: Distribución, Gimnasios, Retail, etc. Un solo código base desplegado atiende a muchos clientes (Tenants); las funcionalidades específicas de cada rubro viven como módulos verticales activables (`src/modules/<vertical>`).

## Stack

| Capa | Tecnología |
| :--- | :--- |
| Framework Web | Next.js 16 (App Router, i18n) |
| UI | React 19 + Tailwind CSS v4 + Shadcn UI / Radix |
| Iconos | lucide-react |
| Base de datos | PostgreSQL (Neon Serverless) |
| ORM | Prisma 5.22 |
| Data Fetching & Cache | TanStack React Query v5 |
| Estado global UI | Jotai |
| Validación | Zod / TypeScript |

## Requisitos

- Node.js 20+ (el proyecto se desarrolló con Node 25).
- Cuenta en Neon (PostgreSQL serverless) con dos URLs en `.env`:

```bash
DATABASE_URL=postgresql://...   # Pooler (entorno de ejecución)
DIRECT_URL=postgresql://...     # Sin pooler (scripts, seed)
```

`.env*` está ignorado por git: **no se commitean credenciales**.

## Primeros pasos

```bash
npm install
npm run db:seed   # Crea tenant demo "distribuidora-sanjose" + datos
npm run dev       # http://localhost:3000
```

> El seed es **destructivo**: borra y recrea los datos del tenant demo. El `id` del tenant es aleatorio por corrida; se resuelve por `slug`.

## Scripts

| Script | Descripción |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo (Next.js) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed demo (destructivo) |

## Estructura

```text
src/
├── app/                     # App Router (rutas i18n [locale] y API /api/)
├── core/                    # Núcleo agnóstico (Clean Architecture)
│   ├── entities/            # Modelos puros de TypeScript
│   └── ports/               # Contratos (IDistributionRepository, ...)
├── infrastructure/          # Adaptadores Prisma/BD
│   └── db/repositories/     # PrismaXRepository, MockXRepository
├── modules/<vertical>/      # Lógica y UI por rubro (distribution, gym, ...)
├── components/              # Sistema de diseño
└── lib/                     # Utilidades y configuración
```

## Documentación

- `AGENTS.md` — Reglas de desarrollo y convenciones para IA y humanos.
- `ARCHITECTURE.md` — Arquitectura, capas y patrones.
- `DATABASE.md` — Contexto de la base de datos (modelos, integridad, seed).
- `PROJECT_VISION.md` — Visión y hoja de ruta del producto.

## Convención de commits

Commits en formato [Conventional Commits](https://www.conventionalcommits.org/) con husky + commitlint:
`feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`, `test(...)`, `chore(...)`.