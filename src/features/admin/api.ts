import type { IndustryKey, ModuleKey } from '@/core/schemas/admin-tenants';

const API_BASE = '/api/admin';

/** Tenant row as returned by GET /api/admin/tenants (scalars + counts). */
export interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  industry: IndustryKey;
  modules: ModuleKey[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    branches: number;
  };
}

/** Tenant scalars as returned by POST / PATCH responses (no `_count`). */
export type AdminTenantRecord = Omit<AdminTenant, '_count'>;

export interface CreateTenantPayload {
  slug: string;
  name: string;
  industry: IndustryKey;
  modules: ModuleKey[];
  adminEmail?: string;
  adminPassword?: string;
}

export interface UpdateTenantPayload {
  name?: string;
  industry?: IndustryKey;
  modules?: ModuleKey[];
  active?: boolean;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Error de solicitud');
  }
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? 'Error de solicitud');
  }
  return res.json() as Promise<T>;
}