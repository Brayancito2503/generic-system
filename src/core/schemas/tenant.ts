// Tenant shell — Zod input schemas (Core, agnóstico a infraestructura)
// JSONB payloads (`Tenant.settings`) are validated here, never typed as `any`.

import { z } from 'zod';

/** True when at least one optional field carries a defined value (drives PATCH semantics). */
export function hasAnyDefinedField(value: object): boolean {
  return Object.values(value).some((v) => v !== undefined);
}

export const industrySchema = z.enum([
  'GENERIC',
  'GYM',
  'RESTAURANT',
  'PHARMACY',
  'RETAIL',
  'DISTRIBUTION',
]);

export const tenantSettingsSchema = z
  .object({
    logoUrl: z.string().trim().url().max(500).optional(),
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{3,8}$/, 'Color inválido')
      .optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    timezone: z.string().trim().min(1).max(60).optional(),
  })
  .passthrough();

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    industry: industrySchema.optional(),
    modules: z.array(z.string().trim().min(1)).optional(),
    settings: tenantSettingsSchema.optional(),
  })
  .refine(hasAnyDefinedField, { message: 'No hay campos válidos para actualizar' });

export const paginationSchema = z.object({
  // limit fuera de 1..100 → 400; página fuera de rango → lista vacía (contrato P1)
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Contract for endpoints that currently take no query parameters. */
export const noQueryParamsSchema = z.object({}).strict();

export const customerSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});