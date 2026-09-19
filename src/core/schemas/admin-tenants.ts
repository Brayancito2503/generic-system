// Platform admin (SUPER_ADMIN) — Zod input schemas (Core, agnóstico a infraestructura).
// These contracts back `/api/admin/tenants`. This is PLATFORM scope: the
// SUPER_ADMIN operates across ALL tenants by design, so no tenantId scoping
// applies here (regular multi-tenant rule #1 does not cover these routes).

import { z } from 'zod';
import { hasAnyDefinedField, industrySchema } from './tenant';

/**
 * Canonical module catalog — the exact `Tenant.modules` keys the shell
 * activates. Source of truth: `src/components/app-sidebar.tsx`
 * (DISTRIBUTION_MODULE_KEYS + GYM_MODULE_KEYS) and `prisma/seed.ts`.
 * Do NOT invent keys here.
 */
export const MODULE_CATALOG = [
  'gym_memberships',
  'pos',
  'inventory',
  'distribution',
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number];

export const moduleKeySchema = z.enum(MODULE_CATALOG);

/** Every valid `Industry` enum value, in schema order (prisma/schema.prisma). */
export const INDUSTRY_CATALOG = industrySchema.options;

export type IndustryKey = z.infer<typeof industrySchema>;

/**
 * Slug normalization: lowercase; non-alphanumeric runs collapse to a single
 * hyphen; leading/trailing hyphens are stripped. The result must match
 * `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
 */
const normalizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const tenantSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform(normalizeSlug)
  .pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido'));

/** Same email contract style as `nullableEmail` in core/schemas/distribution.ts. */
const adminEmailSchema = z
  .string()
  .trim()
  .max(200)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Correo inválido');

const adminPasswordSchema = z.string().min(8).max(200);

const modulesArraySchema = z
  .array(moduleKeySchema)
  .max(MODULE_CATALOG.length)
  .refine((v) => new Set(v).size === v.length, 'Módulos duplicados');

export const createTenantSchema = z
  .object({
    slug: tenantSlugSchema,
    name: z.string().trim().min(1).max(200),
    industry: industrySchema,
    modules: modulesArraySchema.default([]),
    active: z.boolean().default(true),
    adminEmail: adminEmailSchema.optional(),
    adminPassword: adminPasswordSchema.optional(),
  })
  .refine((v) => (v.adminEmail !== undefined) === (v.adminPassword !== undefined), {
    path: ['adminEmail'],
    message: 'adminEmail y adminPassword deben enviarse juntos',
  });

export const updateTenantAdminSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    industry: industrySchema.optional(),
    modules: modulesArraySchema.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

/** Path-param contract for `/api/admin/tenants/[id]`. */
export const tenantIdParamSchema = z.string().trim().min(1).max(60);