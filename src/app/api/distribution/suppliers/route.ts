import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/session';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET() {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const suppliers = await repository.getSuppliers(tenantId);
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('[suppliers]', error);
    return NextResponse.json(
      { error: 'Error al obtener los proveedores' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const tenantId = await requireTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json(
        { error: 'name es obligatorio' },
        { status: 400 }
      );
    }

    const created = await repository.createSupplier(tenantId, {
      name: String(body.name),
      contactName: body.contactName ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      taxId: body.taxId ?? null,
      address: body.address ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[suppliers]', error);
    return NextResponse.json(
      { error: 'Error al crear el proveedor' },
      { status: 500 }
    );
  }
}