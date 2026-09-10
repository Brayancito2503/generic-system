import React from "react";
import DistributionModuleApp from "@/modules/distribution/components/DistributionModuleApp";
import { prisma } from "@/infrastructure/db/prisma";

const TENANT_SLUG = "distribuidora-sanjose";

export default async function DistributionModulePage() {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: TENANT_SLUG },
        select: { id: true, name: true },
    });

    if (!tenant) {
        return (
            <div className="flex h-full min-h-0 w-full items-center justify-center bg-zinc-950 text-zinc-100 p-8">
                <p className="text-sm text-rose-400">
                    No se encontró el tenant &quot;{TENANT_SLUG}&quot;. Ejecuta{" "}
                    <code className="text-zinc-300">npm run db:seed</code> para
                    sembrar los datos demo.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 w-full bg-zinc-950 text-zinc-100">
            <DistributionModuleApp tenantId={tenant.id} />
        </div>
    );
}