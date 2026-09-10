"use client";

import { usePathname } from "next/navigation";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";

export function DynamicBreadcrumb() {
    const pathname = usePathname();

    // Divide la ruta y remueve vacíos ("/en/dashboard/admin" -> ["en", "dashboard", "admin"])
    const segments = pathname.split('/').filter((segment) => segment !== '');

    // Si estás usando next-intl, el primer segmento suele ser el locale (ej. "en", "es").
    // Aquí asumimos que si el primer segmento tiene 2 caracteres, es un locale y lo saltamos visualmente.
    const isLocale = segments[0]?.length === 2;
    const paths = isLocale ? segments.slice(1) : segments;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {paths.map((path, index) => {
                    const isLast = index === paths.length - 1;

                    // Reconstruimos el href sumando los segmentos anteriores
                    const pathIndex = segments.indexOf(path);
                    const href = `/${segments.slice(0, pathIndex + 1).join('/')}`;

                    // Capitalizamos la primera letra
                    const title = path.charAt(0).toUpperCase() + path.slice(1);

                    return (
                        <React.Fragment key={path}>
                            <BreadcrumbItem className="hidden md:block">
                                {isLast ? (
                                    <BreadcrumbPage>{title}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>
                                        {title}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
