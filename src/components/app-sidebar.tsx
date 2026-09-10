"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
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
  GalleryVerticalEndIcon,
  AudioLinesIcon,
  TerminalIcon,
  TerminalSquareIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  UserIcon,
  SquareUser,
  ChefHatIcon,
  CookingPotIcon,
  Store,
  Dumbbell,
} from "lucide-react"
import { ThemeToggle } from "./ui/theme-toggle"
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
        plan: "Distribuidora Vertical",
      },
      {
        name: "PowerFit Gym",
        logo: <Dumbbell />,
        plan: "Gimnasio Vertical",
      },
      {
        name: "Generic System Core",
        logo: <GalleryVerticalEndIcon />,
        plan: "SaaS Multi-Tenant",
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
      {
        title: t('customers'),
        url: "/dashboard/customers",
        icon: <SquareUser />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
      {
        title: t('invoices'),
        url: "/dashboard/invoices",
        icon: <BookOpenIcon />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
      {
        title: t('orders'),
        url: "/dashboard/orders",
        icon: <CookingPotIcon />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
      {
        title: t('kitchen'),
        url: "/dashboard/kitchen",
        icon: <ChefHatIcon />,
        isActive: false,
        hidden: false,
        disabled: false,
      },
      {
        title: t('admin'),
        url: "/dashboard/admin",
        icon: <UserIcon />,
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
