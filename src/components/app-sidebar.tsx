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
} from "lucide-react"

import { useTranslations } from "next-intl"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations('sidebar');

  const data = {
    user: {
      name: "Usuario Demo",
      email: "admin@genericsystem.io",
      avatar: "/avatars/shadcn.jpg",
    },
    teams: [
      {
        name: "Distribuidora San José",
        logo: <Store />,
        plan: "Distribución",
      },
    ],
    navMain: [
      {
        title: t('dashboard'),
        url: "/dashboard",
        icon: <LayoutDashboardIcon />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
      {
        title: t('distribution'),
        url: "/dashboard/modules/distribution",
        icon: <Store />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
      {
        title: t('gym'),
        url: "/dashboard/modules/gym",
        icon: <Dumbbell />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
    ],
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header del menú lateral */}
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      {/* Contenido del menú lateral */}
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      {/* Footer del menú lateral */}
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      {/* Rail del menú lateral */}
      <SidebarRail />
    </Sidebar>
  )
}
