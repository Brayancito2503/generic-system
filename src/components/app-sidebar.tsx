"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  Store,
  Dumbbell,
  Settings,
  Shield,
} from "lucide-react"

import { useTranslations } from "next-intl"
import { getMe } from "@/features/auth/api"

// Tenant.modules keys that activate each vertical module in the shell.
const DISTRIBUTION_MODULE_KEYS = ['pos', 'distribution', 'inventory'];
const GYM_MODULE_KEYS = ['gym_memberships'];

interface ShellSession {
  role: string;
  tenantName: string;
  modules: string[];
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations('sidebar');
  const [shell, setShell] = React.useState<ShellSession | null>(null);

  // The shell always derives from the session (/api/auth/me): tenant name,
  // active modules and role. The client NEVER sends tenantId.
  React.useEffect(() => {
    let active = true;
    getMe().then((me) => {
      if (active && me) {
        setShell({
          role: me.user.role,
          tenantName: me.tenant?.name ?? '',
          modules: me.tenant?.modules ?? [],
        });
      }
    });
    return () => { active = false; };
  }, []);

  const hasModule = React.useCallback(
    (keys: string[]) => keys.some((key) => shell?.modules.includes(key) ?? false),
    [shell]
  );

  const planKey = shell
    ? hasModule(DISTRIBUTION_MODULE_KEYS)
      ? 'plan.distribution'
      : hasModule(GYM_MODULE_KEYS)
        ? 'plan.gym'
        : 'plan.generic'
    : 'plan.generic';

  const teams = shell
    ? [{ name: shell.tenantName, logo: <Store />, plan: t(planKey) }]
    : [];

  const navMain = [
    {
      title: t('dashboard'),
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    ...(hasModule(DISTRIBUTION_MODULE_KEYS)
      ? [{ title: t('distribution'), url: "/dashboard/modules/distribution", icon: <Store /> }]
      : []),
    ...(hasModule(GYM_MODULE_KEYS)
      ? [{ title: t('gym'), url: "/dashboard/modules/gym", icon: <Dumbbell /> }]
      : []),
    ...(shell && (shell.role === 'TENANT_ADMIN' || shell.role === 'SUPER_ADMIN')
      ? [{ title: t('admin'), url: "/dashboard/modules/distribution/settings", icon: <Settings /> }]
      : []),
    // Platform scope: only the SUPER_ADMIN manages ALL tenants.
    ...(shell && shell.role === 'SUPER_ADMIN'
      ? [{ title: t('adminPortal'), url: "/dashboard/admin/tenants", icon: <Shield /> }]
      : []),
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header del menú lateral */}
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      {/* Contenido del menú lateral */}
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      {/* Footer del menú lateral */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      {/* Rail del menú lateral */}
      <SidebarRail />
    </Sidebar>
  )
}