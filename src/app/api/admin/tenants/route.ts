import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/prisma';
import { requireApiAuth } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { hashPassword } from '@/lib/security';
import { createTenantSchema } from '@/core/schemas/admin-tenants';

/**
 * Platform-scope admin API (SUPER_ADMIN only). Unlike every other route,
 * there is NO `requireTenantId()` here: the SUPER_ADMIN manages ALL tenants.
 */

const tenantListInclude = {
  _count: { select: { users: true, branches: true } },
} satisfies Prisma.TenantInclude;

export async function GET() {
  try {
    await requireApiAuth(['SUPER_ADMIN']);

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: tenantListInclude,
    });

    return NextResponse.json(tenants);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['SUPER_ADMIN']);

    const body: unknown = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const { slug, name, industry, modules, active, adminEmail, adminPassword } = parsed.data;

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ApiError(409, 'El slug ya existe');

    // Login authenticates by email GLOBALLY (see /api/auth/login: findFirst
    // without tenantId), so a duplicated admin email would create ambiguous
    // logins across tenants. Reject it before anything is created.
    if (adminEmail) {
      const emailOwner = await prisma.user.findFirst({ where: { email: adminEmail } });
      if (emailOwner) {
        throw new ApiError(409, 'El email del administrador ya está registrado');
      }
    }

    // bcrypt is CPU-bound: hash before opening the transaction.
    const passwordHash = adminPassword ? await hashPassword(adminPassword) : null;

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug,
          name,
          industry,
          modules,
          active,
        },
      });

      // Every tenant is provisioned with a default branch on creation.
      await tx.branch.create({
        data: {
          tenantId: created.id,
          name: 'Sucursal Principal',
        },
      });

      if (adminEmail && passwordHash) {
        await tx.user.create({
          data: {
            tenantId: created.id,
            email: adminEmail,
            passwordHash,
            role: 'TENANT_ADMIN',
          },
        });
      }

      return created;
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    // P2002 = unique constraint (slug): race after the explicit pre-check.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'El slug ya existe' }, { status: 409 });
    }
    return handleApiError(error);
  }
}