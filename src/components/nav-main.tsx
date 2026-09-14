"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    hidden?: boolean
    disabled?: boolean
    items?: {
      title: string
      url: string
      hidden?: boolean
      disabled?: boolean
    }[]
  }[]
}) {
  const t = useTranslations('sidebar');
  const pathName = usePathname();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('groupLabel')}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // Ocultar si el permiso/rol no lo permite
          if (item.hidden) return null;

          // Construimos el link quitando el locale solo para comparar si es necesario,
          // o usamos usePathname tal cual porque ya incluye el locale o no.
          // Ej: pathName === "/en/dashboard" o "/dashboard"
          const isItemActive = pathName === item.url || pathName?.startsWith(item.url + '/');

          // Si no tiene sub-items, renderizamos un botón de menú simple que actúe como link
          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive}>
                  <Link 
                    href={item.url} 
                    className={item.disabled ? "pointer-events-none opacity-50" : ""}
                    tabIndex={item.disabled ? -1 : undefined}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // Verificar si algún sub-item está activo para abrir el colapsable
          const isSubItemActive = item.items?.some((subItem) => pathName === subItem.url);

          // Si SÍ tiene sub-items, mantenemos el comportamiento anterior (desplegable)
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive || isSubItemActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={isSubItemActive || isItemActive}>
                    <div className={item.disabled ? "opacity-50 pointer-events-none flex items-center w-full" : "flex items-center w-full"}>
                      {item.icon}
                      <span className="flex-1 text-left">{item.title}</span>
                      <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </div>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      if (subItem.hidden) return null;

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={pathName === subItem.url}>
                            <Link 
                                href={subItem.url}
                                className={subItem.disabled ? "pointer-events-none opacity-50" : ""}
                                tabIndex={subItem.disabled ? -1 : undefined}
                            >
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup >
  )
}
