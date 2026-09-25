import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, requireTenantId } from '@/lib/session';
import { ApiError, handleApiError } from '@/lib/api-error';
import {
  createInventoryItemSchema,
  inventoryListQuerySchema,
} from '@/core/schemas/distribution';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

const repository = new PrismaDistributionRepository();

export async function GET(request: NextRequest) {
  try {
// Read-only for ACCOUNTANT (costs/margins are already visible to them in
    // reports); writes stay CASHIER/STAFF/TENANT_ADMIN with PATCH/DELETE
    // restricted further in [id]/route.ts.
    await requireApiAuth(['CASHIER', 'STAFF', 'TENANT_ADMIN', 'ACCOUNTANT']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    // Fase 2 Slice C: the closed `sort` enum (name | velocity) replaces the
    // former no-params contract on THIS route. `.strict()` still rejects any
    // other query param with 400, and tenantId is never client input.
    const query = inventoryListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!query.success) throw new ApiError(400, 'Datos inválidos');

    const items = await repository.getInventory(tenantId, query.data.sort);
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiAuth(['CASHIER', 'STAFF', 'TENANT_ADMIN']);
    const tenantId = await requireTenantId();
    if (!tenantId) throw new ApiError(401, 'No autorizado');

    const body: unknown = await request.json();
    const parsed = createInventoryItemSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'Datos inválidos');

    const created = await repository.createInventoryItem(tenantId, {
      sku: parsed.data.sku,
      name: parsed.data.name,
      description: parsed.data.description,
      cost: parsed.data.cost,
      price: parsed.data.price,
      stock: parsed.data.stock,
      minAlert: parsed.data.minAlert,
      // Optional sale unit (Fase 2 Slice B); omitted → legacy piece-based.
      saleUnit: parsed.data.saleUnit,
      // Ledger origin: the operator of the INITIAL movement.
      userId: session.userId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}