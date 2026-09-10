import { NextRequest, NextResponse } from 'next/server';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const employees = await repository.getEmployees(tenantId);
    return NextResponse.json(employees);
  } catch (error) {
    console.error('[employees]', error);
    return NextResponse.json(
      { error: 'Error al obtener los empleados' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: 'firstName y lastName son obligatorios' },
        { status: 400 }
      );
    }

    const created = await repository.createEmployee(tenantId, {
      firstName: String(body.firstName),
      lastName: String(body.lastName),
      email: body.email ?? null,
      phone: body.phone ?? null,
      branchId: body.branchId ?? null,
      role: body.role ?? 'Vendedor',
      department: body.department ?? null,
      salary: typeof body.salary === 'number' ? body.salary : null,
      commissionRate:
        typeof body.commissionRate === 'number' ? body.commissionRate : null,
      hireDate: new Date(body.hireDate ?? Date.now()),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[employees]', error);
    return NextResponse.json(
      { error: 'Error al crear el empleado' },
      { status: 500 }
    );
  }
}