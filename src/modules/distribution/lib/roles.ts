// Pure client-side role helpers for the Distribution vertical. The server
// route guards are the source of truth; these helpers only hide/reveal UI
// affordances so restricted profiles don't see buttons they cannot use.
//
// Migration rule: any role that is NOT an explicit restricted profile keeps
// the legacy full-access behavior (and an unknown role while the session is
// loading never hides tabs, so admins don't see a flicker).

/** Legacy roles with unrestricted access: STAFF, TENANT_ADMIN, SUPER_ADMIN. */
const FULL_ACCESS_ROLES: readonly string[] = ['STAFF', 'TENANT_ADMIN', 'SUPER_ADMIN'];

export function hasFullAccess(role: string | null | undefined): boolean {
  if (role === undefined || role === null) return true; // session still loading
  return FULL_ACCESS_ROLES.includes(role);
}

/** POS profile: sells, views/creates inventory, customers, fiados. */
export function isCashier(role: string | null | undefined): boolean {
  return role === 'CASHIER';
}

/** Accounting profile: reports, cash, receivables, read-only suppliers/POs. */
export function isAccountant(role: string | null | undefined): boolean {
  return role === 'ACCOUNTANT';
}

export const ALL_TABS = [
  'dashboard',
  'inventory',
  'sales',
  'history',
  'returns',
  'customers',
  'receivables',
  'cash',
  'suppliers',
  'employees',
  'tax',
  'reportes',
] as const;

const RESTRICTED_TABS: Record<string, readonly string[]> = {
  CASHIER: ['dashboard', 'inventory', 'sales', 'customers', 'receivables'],
  ACCOUNTANT: ['dashboard', 'receivables', 'cash', 'suppliers', 'reportes'],
};

/** Tabs visible to the given session role; full set while unknown/legacy. */
export function visibleTabs(role: string | null | undefined) {
  if (role === undefined || role === null) return ALL_TABS;
  return RESTRICTED_TABS[role] ?? ALL_TABS;
}