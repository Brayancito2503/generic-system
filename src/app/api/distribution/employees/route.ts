import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import { noQueryParamsSchema } from '@/core/schemas/tenant';
import { createEmployeeSchema } from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const query = noQueryParamsSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const employees = await repository.getEmployees(tenantId);
    return NextResponse.json(employees);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(['STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    // Employee record first; when a PIN was provided, link the Person to a
    // User (bcrypt-hashed, role STAFF) right after — the link runs in its own
    // transaction, so a link failure leaves the employee created (retryable).
    const created = await repository.createEmployee(tenantId, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      branchId: parsed.data.branchId ?? null,
      role: parsed.data.role,
      department: parsed.data.department ?? null,
      salary: parsed.data.salary ?? null,
      commissionRate: parsed.data.commissionRate ?? null,
      hireDate: parsed.data.hireDate ?? new Date(),
    });

    if (parsed.data.pin !== undefined) {
      await repository.linkEmployeeUser(tenantId, created.id, {
        pin: parsed.data.pin,
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}