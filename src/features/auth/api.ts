interface PublicUser {
  userId: string;
  tenantId: string;
  role: string;
  name: string;
  email: string;
}

/** Tenant shell payload from /api/auth/me: display name + enabled modules. */
export interface MeTenant {
  name: string;
  modules: string[];
}

/** Full /api/auth/me response: the authenticated user plus its tenant shell. */
export interface MePayload {
  user: PublicUser;
  tenant: MeTenant;
}

type LoginPayload =
  | { mode: 'admin'; email: string; password: string }
  | { mode: 'pos'; pin: string };

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => null)) as { user?: PublicUser; error?: string } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? 'Error de solicitud');
  }
  return data as T;
}

export async function login(payload: LoginPayload): Promise<PublicUser> {
  const data = await post<{ user: PublicUser }>('/api/auth/login', payload);
  return data.user;
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout');
}

export async function getMe(): Promise<MePayload | null> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  const data = (await res.json()) as MePayload;
  return data;
}