import { prisma } from '../prisma';
import { ApiError } from '@/lib/api-error';
import { hashPassword } from '@/lib/security';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  IDistributionRepository,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateEmployeeInput,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreatePurchaseOrderInput,
  UpdateEmployeeInput,
  UpdateInvoicingConfigInput,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
  CreateTaxRateInput,
  UpdateTaxRateInput,
  ReceivePurchaseOrderInput,
  RegisterSaleInput,
  CreateSaleReturnInput,
  PayReceivableInput,
} from '@/core/ports/distribution-repository.port';
import type {
  CashMovementEntity,
  CashSessionEntity,
  CustomerLight,
  DistributionDashboardStats,
  EmployeeEntity,
  FiscalSummary,
  InvoicingConfigEntity,
  InventoryStockItem,
  PaginatedResult,
  PaymentMethod,
  PurchaseOrderEntity,
  ReceivableEntity,
  ReceivableStatus,
  RecentSale,
  SaleEntity,
  SaleReturnEntity,
  SupplierEntity,
  TaxRateEntity,
} from '@/core/entities/distribution';

interface EmployeePersonMetadata {
  department?: string;
  commissionRate?: number;
}

/** Employee row with its Person graph, shared by the entity mapper methods. */
type EmployeeWithPerson = Prisma.EmployeeGetPayload<{ include: { person: true } }>;

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

function dayLabel(date: Date): string {
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay ? 'Hoy' : DAY_LABELS[date.getDay()];
}

function relativeTime(date: Date): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return minutes > 0 ? `hace ${hours}h ${minutes}min` : `hace ${hours}h`;
}

function firstBranchOfTenant(tenantId: string, branchId?: string) {
  if (branchId) {
    return prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  }
  return prisma.branch.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
}

export class PrismaDistributionRepository implements IDistributionRepository {
  // ─── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboard(tenantId: string): Promise<DistributionDashboardStats> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      1
    );

    const todayAgg = await prisma.sale.aggregate({
      where: { tenantId, createdAt: { gte: startOfToday } },
      _sum: { total: true },
    });

    const monthAgg = await prisma.sale.aggregate({
      where: { tenantId, createdAt: { gte: startOfMonth } },
      _sum: { total: true },
    });

    const totalProducts = await prisma.item.count({ where: { tenantId } });

    const lowStockItems = await prisma.inventory.count({
      where: { tenantId, stock: { lt: prisma.inventory.fields.minAlert } },
    });

    const activeEmployees = await prisma.employee.count({
      where: { tenantId, isActive: true },
    });

    const cashSession = await this.getOpenCashSession(tenantId);
    const movementsSum =
      cashSession?.movements.reduce(
        (acc, m) => (m.type === 'IN' ? acc + m.amount : acc - m.amount),
        0
      ) ?? 0;
    const cashInRegister = cashSession
      ? cashSession.openingAmount + movementsSum + (cashSession.salesTotal ?? 0)
      : 0;

    const groupedTop = await prisma.saleItem.groupBy({
      by: ['itemId'],
      where: { sale: { tenantId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const topItems = await prisma.item.findMany({
      where: { tenantId, id: { in: groupedTop.map((g) => g.itemId) } },
    });

    const topProducts = groupedTop.map((g) => {
      const item = topItems.find((i) => i.id === g.itemId);
      const sold = g._sum.quantity ?? 0;
      return {
        name: item?.name ?? 'Producto eliminado',
        sold,
        revenue: sold * (item?.price.toNumber() ?? 0),
      };
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesWeek = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
      select: { total: true, createdAt: true },
    });

    const byDayMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      byDayMap.set(dayLabel(d), 0);
    }
    for (const sale of salesWeek) {
      const label = dayLabel(sale.createdAt);
      byDayMap.set(label, (byDayMap.get(label) ?? 0) + sale.total.toNumber());
    }

    const salesByDay = Array.from(byDayMap.entries()).map(([date, total]) => ({
      date,
      total,
    }));

    const recentSales = await this.getRecentSales(tenantId);

    return {
      salesToday: todayAgg._sum.total?.toNumber() ?? 0,
      salesThisMonth: monthAgg._sum.total?.toNumber() ?? 0,
      totalProducts,
      lowStockItems,
      cashInRegister,
      activeEmployees,
      topProducts,
      salesByDay,
      recentSales,
    };
  }

  private async getRecentSales(tenantId: string): Promise<RecentSale[]> {
    const sales = await prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { person: true, items: true },
    });

    return sales.map((sale) => ({
      id: sale.id,
      customer: sale.person
        ? `${sale.person.firstName} ${sale.person.lastName}`
        : 'Cliente mostrador',
      total: sale.total.toNumber(),
      items: sale.items.length,
      time: relativeTime(sale.createdAt),
    }));
  }

  // ─── Inventory ──────────────────────────────────────────────────────────────
  async getInventory(tenantId: string): Promise<InventoryStockItem[]> {
    const rows = await prisma.inventory.findMany({
      where: { tenantId },
      include: { item: true },
      orderBy: { item: { name: 'asc' } },
    });

    return rows.map((row) => ({
      id: row.item.id,
      tenantId: row.tenantId,
      sku: row.item.sku,
      name: row.item.name,
      description: row.item.description,
      cost: row.item.cost.toNumber(),
      price: row.item.price.toNumber(),
      stock: row.stock,
      minAlert: row.minAlert,
      isLowStock: row.stock < row.minAlert,
    }));
  }

  async createInventoryItem(
    tenantId: string,
    input: CreateInventoryItemInput
  ): Promise<InventoryStockItem> {
    const branch = await firstBranchOfTenant(tenantId, undefined);
    if (!branch) {
      throw new Error('El tenant no tiene sucursales configuradas');
    }

    if (input.sku) {
      const existingSku = await prisma.item.findFirst({ where: { tenantId, sku: input.sku } });
      if (existingSku) throw new Error('El SKU ya existe');
    }

    const item = await prisma.item.create({
      data: {
        tenantId,
        sku: input.sku || null,
        name: input.name,
        description: input.description || null,
        cost: input.cost,
        price: input.price,
        isService: false,
        attributes: {},
      },
    });

    const inv = await prisma.inventory.create({
      data: {
        tenantId,
        itemId: item.id,
        branchId: branch.id,
        stock: input.stock,
        minAlert: input.minAlert,
      },
    });

    return {
      id: item.id,
      tenantId,
      sku: item.sku,
      name: item.name,
      description: item.description,
      cost: item.cost.toNumber(),
      price: item.price.toNumber(),
      stock: inv.stock,
      minAlert: inv.minAlert,
      isLowStock: inv.stock < inv.minAlert,
    };
  }

  async updateInventoryItem(
    tenantId: string,
    itemId: string,
    input: UpdateInventoryItemInput
  ): Promise<InventoryStockItem> {
    const existing = await prisma.item.findFirst({
      where: { tenantId, id: itemId },
      include: { inventory: true },
    });
    if (!existing) {
      throw new ApiError(404, 'Producto no encontrado');
    }

    const itemData: {
      sku?: string | null;
      name?: string;
      description?: string | null;
      cost?: number;
      price?: number;
    } = {};
    if (input.sku !== undefined) itemData.sku = input.sku || null;
    if (input.name !== undefined) itemData.name = input.name;
    if (input.description !== undefined) itemData.description = input.description || null;
    if (input.cost !== undefined) itemData.cost = input.cost;
    if (input.price !== undefined) itemData.price = input.price;

    if (itemData.sku && itemData.sku !== existing.sku) {
      const skuConflict = await prisma.item.findFirst({
        where: { tenantId, sku: itemData.sku, NOT: { id: itemId } },
      });
      if (skuConflict) throw new ApiError(409, 'El SKU ya existe');
    }

    // Stock writes are branch-scoped: they touch ONLY the targeted branch's
    // Inventory row. Item-level fields (sku/name/description/cost/price) are
    // branch-independent and update without a branchId.
    let inv: { stock: number; minAlert: number } | null = existing.inventory[0] ?? null;
    if (input.branchId !== undefined) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, tenantId },
      });
      if (!branch) {
        throw new ApiError(404, 'Sucursal no encontrada');
      }
      const target = await prisma.inventory.findFirst({
        where: { tenantId, itemId, branchId: input.branchId },
      });
      if (!target) {
        throw new ApiError(
          400,
          'No existe inventario de este producto en la sucursal indicada'
        );
      }
      inv = await prisma.inventory.update({
        where: { id: target.id },
        data: {
          stock: input.stock ?? target.stock,
          minAlert: input.minAlert ?? target.minAlert,
        },
      });
    } else if (input.stock !== undefined || input.minAlert !== undefined) {
      // The route rejects this before it reaches the repo; the double guard
      // makes it impossible for a stock write without a branch to silently
      // mutate inventory[0] (the legacy cross-branch bug this replaces).
      throw new ApiError(400, 'Debe indicar la sucursal para actualizar el stock');
    }

    const item = await prisma.item.update({
      where: { id: itemId },
      data: itemData,
    });

    const stock = inv?.stock ?? input.stock ?? 0;
    const minAlert = inv?.minAlert ?? input.minAlert ?? 0;

    return {
      id: item.id,
      tenantId,
      sku: item.sku,
      name: item.name,
      description: item.description,
      cost: item.cost.toNumber(),
      price: item.price.toNumber(),
      stock,
      minAlert,
      isLowStock: stock < minAlert,
    };
  }

  // ─── Suppliers ──────────────────────────────────────────────────────────────
  async getSuppliers(tenantId: string): Promise<SupplierEntity[]> {
    const rows = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      name: s.name,
      contactName: s.contactName,
      phone: s.phone,
      email: s.email,
      taxId: s.taxId,
      address: s.address,
      isActive: s.isActive,
      createdAt: s.createdAt,
    }));
  }

  async createSupplier(
    tenantId: string,
    input: CreateSupplierInput
  ): Promise<SupplierEntity> {
    const created = await prisma.supplier.create({
      data: {
        tenantId,
        name: input.name,
        contactName: input.contactName || null,
        phone: input.phone || null,
        email: input.email || null,
        taxId: input.taxId || null,
        address: input.address || null,
        isActive: true,
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      name: created.name,
      contactName: created.contactName,
      phone: created.phone,
      email: created.email,
      taxId: created.taxId,
      address: created.address,
      isActive: created.isActive,
      createdAt: created.createdAt,
    };
  }

  async updateSupplier(
    tenantId: string,
    supplierId: string,
    input: UpdateSupplierInput
  ): Promise<SupplierEntity> {
    const existing = await prisma.supplier.findFirst({
      where: { tenantId, id: supplierId },
    });
    if (!existing) {
      throw new ApiError(404, 'Proveedor no encontrado');
    }

    const data: Prisma.SupplierUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.contactName !== undefined) data.contactName = input.contactName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.taxId !== undefined) data.taxId = input.taxId;
    if (input.address !== undefined) data.address = input.address;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    // Deactivation never touches existing POs (no cascade, no status change):
    // createPurchaseOrder already rejects inactive suppliers server-side.
    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data,
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      contactName: updated.contactName,
      phone: updated.phone,
      email: updated.email,
      taxId: updated.taxId,
      address: updated.address,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async getPurchaseOrders(tenantId: string): Promise<PurchaseOrderEntity[]> {
    const rows = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { supplier: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((po) => ({
      id: po.id,
      tenantId: po.tenantId,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      branchId: po.branchId,
      orderNumber: po.orderNumber,
      status: (po.status as PurchaseOrderEntity['status']) ?? 'PENDING',
      subtotal: po.subtotal.toNumber(),
      taxAmount: po.taxAmount.toNumber(),
      total: po.total.toNumber(),
      notes: po.notes,
      expectedDate: po.receivedAt ?? po.createdAt,
      receivedAt: po.receivedAt,
      createdAt: po.createdAt,
    }));
  }

  async receivePurchaseOrder(
    tenantId: string,
    poId: string,
    input: ReceivePurchaseOrderInput
  ): Promise<PurchaseOrderEntity> {
    const po = await prisma.purchaseOrder.findFirst({
      where: { tenantId, id: poId },
      include: {
        supplier: true,
        branch: true,
        items: { include: { item: true } },
      },
    });
    if (!po) {
      throw new ApiError(404, 'Orden de compra no encontrada');
    }
    if (po.status === 'CANCELLED') {
      throw new ApiError(409, 'La orden de compra está cancelada');
    }

    const mergedLines = new Map<string, number>();
    for (const line of input.receivedItems) {
      if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
        throw new ApiError(400, 'Cantidad inválida en la recepción');
      }
      mergedLines.set(
        line.itemId,
        (mergedLines.get(line.itemId) ?? 0) + line.quantity
      );
    }
    const lines = [...mergedLines.entries()].map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    // Over-receive guard: each line must fit within the still-pending quantity
    // (quantity − receivedQty already accumulated) → 409 when exceeded; an
    // already-complete PO has remaining 0 for every line, so it is rejected too.
    for (const line of lines) {
      const poItem = po.items.find((i) => i.itemId === line.itemId);
      if (!poItem) {
        throw new ApiError(400, 'El producto no pertenece a la orden de compra');
      }
      const remaining = poItem.quantity - poItem.receivedQty;
      if (line.quantity > remaining) {
        throw new ApiError(
          409,
          `La cantidad a recibir supera el pendiente de "${poItem.item.name}"`
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const inventory = await tx.inventory.updateMany({
          where: {
            tenantId,
            branchId: po.branchId,
            itemId: line.itemId,
          },
          data: { stock: { increment: line.quantity } },
        });
        if (inventory.count === 0) {
          throw new ApiError(
            400,
            'No existe inventario para ese producto en la sucursal de la orden'
          );
        }
        await tx.purchaseOrderItem.updateMany({
          where: { orderId: po.id, itemId: line.itemId },
          data: { receivedQty: { increment: line.quantity } },
        });
      }

      const poItems = await tx.purchaseOrderItem.findMany({
        where: { orderId: po.id },
      });
      const complete =
        poItems.length > 0 && poItems.every((i) => i.receivedQty >= i.quantity);

      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: complete ? 'RECEIVED' : 'ORDERED',
          receivedAt: complete ? new Date() : po.receivedAt,
        },
        include: {
          supplier: true,
          branch: true,
          items: { include: { item: true } },
        },
      });
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      supplierId: updated.supplierId,
      supplierName: updated.supplier.name,
      branchId: updated.branchId,
      orderNumber: updated.orderNumber,
      status: (updated.status as PurchaseOrderEntity['status']) ?? 'ORDERED',
      subtotal: updated.subtotal.toNumber(),
      taxAmount: updated.taxAmount.toNumber(),
      total: updated.total.toNumber(),
      notes: updated.notes,
      expectedDate: updated.receivedAt ?? updated.createdAt,
      receivedAt: updated.receivedAt,
      createdAt: updated.createdAt,
      items: updated.items.map((i) => ({
        id: i.id,
        orderId: i.orderId,
        itemId: i.itemId,
        itemName: i.item.name,
        quantity: i.quantity,
        receivedQty: i.receivedQty,
        cost: i.cost.toNumber(),
      })),
    };
  }

  // ─── Purchase orders (create) ──────────────────────────────────────────────
  async createPurchaseOrder(
    tenantId: string,
    input: CreatePurchaseOrderInput
  ): Promise<PurchaseOrderEntity> {
    const supplier = await prisma.supplier.findFirst({
      where: { tenantId, id: input.supplierId },
    });
    if (!supplier) {
      throw new ApiError(404, 'Proveedor no encontrado');
    }
    if (!supplier.isActive) {
      throw new ApiError(400, 'El proveedor está inactivo');
    }
    const branch = await prisma.branch.findFirst({
      where: { tenantId, id: input.branchId },
    });
    if (!branch) {
      throw new ApiError(404, 'Sucursal no encontrada');
    }

    // Duplicate lines merge into one (same guard as the receive flow) so the
    // quantity math below is always consistent.
    const mergedLines = new Map<string, number>();
    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new ApiError(400, 'Cantidad inválida en uno de los productos');
      }
      mergedLines.set(
        line.itemId,
        (mergedLines.get(line.itemId) ?? 0) + line.quantity
      );
    }
    const lines = [...mergedLines.entries()].map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    const items = await prisma.item.findMany({
      where: { tenantId, id: { in: lines.map((l) => l.itemId) } },
    });
    if (items.length !== lines.length) {
      throw new ApiError(400, 'Uno o más productos no existen');
    }
    const itemById = new Map(items.map((i) => [i.id, i] as const));

    const order = await prisma.$transaction(async (tx) => {
      // PO value is priced at item cost; tax is extracted inclusively with the
      // tenant's default rate, mirroring the registerSale money model.
      const subtotal = lines.reduce((acc, l) => {
        const item = itemById.get(l.itemId);
        const cost = item ? item.cost.toNumber() : 0;
        return acc + cost * l.quantity;
      }, 0);

      const defaultTax =
        (await tx.taxRate.findFirst({
          where: { tenantId, isDefault: true, isActive: true },
          orderBy: { createdAt: 'asc' },
        })) ??
        (await tx.taxRate.findFirst({
          where: { tenantId, isInclusive: true, isActive: true },
          orderBy: { createdAt: 'asc' },
        }));
      const ratePct = defaultTax?.rate.toNumber() ?? 0;
      const taxAmount =
        ratePct > 0 ? Math.round(subtotal * (ratePct / (100 + ratePct)) * 100) / 100 : 0;
      const total = Math.round(subtotal * 100) / 100;

      // Display-only sequential number (no counter table); orderNumber is not
      // unique, so a race here is cosmetic, never a consistency risk.
      const seq = (await tx.purchaseOrder.count({ where: { tenantId } })) + 1;
      const orderNumber = `PO-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;

      return tx.purchaseOrder.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          branchId: branch.id,
          orderNumber,
          status: 'ORDERED',
          subtotal,
          taxAmount,
          total,
          notes: input.notes ?? null,
          items: {
            create: lines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              cost: itemById.get(l.itemId)!.cost,
            })),
          },
        },
        include: {
          supplier: true,
          branch: true,
          items: { include: { item: true } },
        },
      });
    });

    return {
      id: order.id,
      tenantId: order.tenantId,
      supplierId: order.supplierId,
      supplierName: order.supplier.name,
      branchId: order.branchId,
      orderNumber: order.orderNumber,
      status: (order.status as PurchaseOrderEntity['status']) ?? 'ORDERED',
      subtotal: order.subtotal.toNumber(),
      taxAmount: order.taxAmount.toNumber(),
      total: order.total.toNumber(),
      notes: order.notes,
      expectedDate: order.receivedAt ?? order.createdAt,
      receivedAt: order.receivedAt,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        id: i.id,
        orderId: i.orderId,
        itemId: i.itemId,
        itemName: i.item.name,
        quantity: i.quantity,
        receivedQty: i.receivedQty,
        cost: i.cost.toNumber(),
      })),
    };
  }

  // ─── Employees ──────────────────────────────────────────────────────────────
  async getEmployees(tenantId: string): Promise<EmployeeEntity[]> {
    const rows = await prisma.employee.findMany({
      where: { tenantId },
      include: { person: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((e) => this.toEmployeeEntity(e));
  }

  async createEmployee(
    tenantId: string,
    input: CreateEmployeeInput
  ): Promise<EmployeeEntity> {
    const person = await prisma.person.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone || null,
        metadata: {
          department: input.department ?? null,
          commissionRate: input.commissionRate ?? null,
        },
      },
    });

    const employee = await prisma.employee.create({
      data: {
        tenantId,
        personId: person.id,
        branchId: input.branchId || null,
        position: input.role,
        salary: input.salary ?? null,
        hireDate: input.hireDate,
        isActive: true,
      },
    });

    return {
      id: employee.id,
      tenantId: employee.tenantId,
      personId: employee.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      branchId: employee.branchId,
      role: employee.position,
      department: input.department ?? null,
      salary: employee.salary?.toNumber() ?? null,
      commissionRate: input.commissionRate ?? null,
      hireDate: employee.hireDate,
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      person: {
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
      },
    };
  }

  /**
   * Shared employee PATCH path: applies field updates on the Person (with the
   * department/commissionRate JSONB metadata merged) and the Employee row in
   * one transaction. With `linkPin`, it also upserts the Person's User with a
   * bcrypt-hashed POS PIN (`role: STAFF`), and with `isActive: false` it
   * hard-revokes the User's `posPinHash` in the same transaction.
   */
  private async applyEmployeeUpdate(
    tenantId: string,
    employeeId: string,
    input: UpdateEmployeeInput,
    linkPin: boolean
  ): Promise<EmployeeEntity> {
    const pin = linkPin ? String(input.pin ?? '') : '';
    if (linkPin && !/^\d{4,6}$/.test(pin)) {
      throw new ApiError(400, 'Pin inválido');
    }
    // bcrypt is CPU-bound: hash before opening the transaction (the writes
    // themselves stay atomic inside it).
    const posPinHash = linkPin ? await hashPassword(pin) : null;
    const newUserPasswordHash = linkPin
      ? await hashPassword(randomUUID())
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { tenantId, id: employeeId },
        include: { person: true },
      });
      if (!employee) {
        throw new ApiError(404, 'Empleado no encontrado');
      }

      if (input.branchId !== undefined && input.branchId !== null) {
        const branch = await tx.branch.findFirst({
          where: { tenantId, id: input.branchId },
        });
        if (!branch) {
          throw new ApiError(404, 'Sucursal no encontrada');
        }
      }
      if (linkPin && employee.isActive === false) {
        throw new ApiError(400, 'No se puede asignar un PIN a un empleado inactivo');
      }

      // Person fields follow PATCH semantics: undefined = untouched, null = clear.
      const personData: Prisma.PersonUpdateInput = {};
      if (input.firstName !== undefined) personData.firstName = input.firstName;
      if (input.lastName !== undefined) personData.lastName = input.lastName;
      if (input.email !== undefined) personData.email = input.email;
      if (input.phone !== undefined) personData.phone = input.phone;

      const currentMeta = (employee.person.metadata ?? {}) as EmployeePersonMetadata;
      personData.metadata = {
        department:
          input.department === undefined
            ? currentMeta.department ?? null
            : input.department,
        commissionRate:
          input.commissionRate === undefined
            ? currentMeta.commissionRate ?? null
            : input.commissionRate ?? null,
      };
      await tx.person.update({
        where: { id: employee.personId },
        data: personData,
      });

      const employeeData: Prisma.EmployeeUncheckedUpdateInput = {};
      if (input.role !== undefined) employeeData.position = input.role;
      if (input.salary !== undefined) employeeData.salary = input.salary;
      if (input.hireDate !== undefined) employeeData.hireDate = input.hireDate;
      if (input.isActive !== undefined) employeeData.isActive = input.isActive;
      if (input.branchId !== undefined) employeeData.branchId = input.branchId;

      // Deactivate → hard-revoke the POS PIN (spec: "marked inactive, no
      // longer selectable"; the PIN credential dies with the role).
      if (input.isActive === false) {
        await tx.user.updateMany({
          where: {
            tenantId,
            personId: employee.personId,
            posPinHash: { not: null },
          },
          data: { posPinHash: null },
        });
      }

      if (linkPin) {
        // User.email: the Person's email when it is free inside the tenant,
        // otherwise a synthetic per-person address (link-only accounts never
        // sign in by email+password — passwordHash is a random nonce).
        const emailForUser =
          employee.person.email &&
          !(await tx.user.findFirst({
            where: {
              tenantId,
              email: employee.person.email,
              personId: { not: employee.personId },
            },
          }))
            ? employee.person.email
            : `${employee.personId}@pos.local`;

        await tx.user.upsert({
          where: { personId: employee.personId },
          update: { posPinHash },
          create: {
            tenantId,
            personId: employee.personId,
            email: emailForUser,
            passwordHash: newUserPasswordHash!,
            posPinHash,
            role: 'STAFF',
          },
        });
      }

      return tx.employee.update({
        where: { id: employee.id },
        data: employeeData,
        include: { person: true },
      });
    });

    return this.toEmployeeEntity(updated);
  }

  private toEmployeeEntity(e: EmployeeWithPerson): EmployeeEntity {
    const meta = (e.person.metadata ?? {}) as EmployeePersonMetadata;
    return {
      id: e.id,
      tenantId: e.tenantId,
      personId: e.personId,
      firstName: e.person.firstName,
      lastName: e.person.lastName,
      email: e.person.email,
      phone: e.person.phone,
      branchId: e.branchId,
      role: e.position,
      department: meta.department ?? null,
      salary: e.salary?.toNumber() ?? null,
      commissionRate: meta.commissionRate ?? null,
      hireDate: e.hireDate,
      isActive: e.isActive,
      createdAt: e.createdAt,
      person: {
        firstName: e.person.firstName,
        lastName: e.person.lastName,
        email: e.person.email,
        phone: e.person.phone,
      },
    };
  }

  async updateEmployee(
    tenantId: string,
    employeeId: string,
    input: UpdateEmployeeInput
  ): Promise<EmployeeEntity> {
    return this.applyEmployeeUpdate(tenantId, employeeId, input, false);
  }

  async linkEmployeeUser(
    tenantId: string,
    employeeId: string,
    input: UpdateEmployeeInput
  ): Promise<EmployeeEntity> {
    return this.applyEmployeeUpdate(tenantId, employeeId, input, true);
  }

  // ─── Cash ───────────────────────────────────────────────────────────────────
  async getOpenCashSession(tenantId: string): Promise<CashSessionEntity | null> {
    const session = await prisma.cashSession.findFirst({
      where: { tenantId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      include: {
        movements: { orderBy: { createdAt: 'desc' } },
        employee: { include: { person: true } },
      },
    });

    if (!session) return null;

    const salesAgg = await prisma.sale.aggregate({
      where: { tenantId, cashSessionId: session.id },
      _sum: { total: true },
    });

    return {
      id: session.id,
      tenantId: session.tenantId,
      branchId: session.branchId,
      employeeId: session.employeeId,
      employeeName: session.employee?.person
        ? `${session.employee.person.firstName} ${session.employee.person.lastName}`
        : 'Cajero',
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingAmount: session.openingAmount.toNumber(),
      closingAmount: session.closingAmount?.toNumber() ?? null,
      expectedAmount: session.expectedAmount?.toNumber() ?? null,
      difference: session.difference?.toNumber() ?? null,
      status: (session.status as CashSessionEntity['status']) ?? 'OPEN',
      notes: session.notes,
      movements: session.movements.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        sessionId: m.sessionId,
        type: m.type as 'IN' | 'OUT',
        amount: m.amount.toNumber(),
        concept: m.concept,
        createdAt: m.createdAt,
      })),
      salesTotal: salesAgg._sum.total?.toNumber() ?? 0,
    };
  }

  async openCashSession(
    tenantId: string,
    input: OpenCashSessionInput
  ): Promise<CashSessionEntity> {
    // Single open-session guard: a second OPEN session for the tenant is a
    // conflict (409); the routes surface this code as-is.
    const alreadyOpen = await prisma.cashSession.findFirst({
      where: { tenantId, status: 'OPEN' },
    });
    if (alreadyOpen) {
      throw new ApiError(409, 'Ya existe una sesión de caja abierta');
    }

    const branch =
      (await firstBranchOfTenant(tenantId, input.branchId || undefined)) ?? null;
    if (!branch) {
      throw new ApiError(400, 'El tenant no tiene sucursales configuradas');
    }

    const session = await prisma.cashSession.create({
      data: {
        tenantId,
        branchId: branch.id,
        employeeId: input.employeeId || null,
        openingAmount: input.openingAmount,
        status: 'OPEN',
      },
    });

    return {
      id: session.id,
      tenantId: session.tenantId,
      branchId: session.branchId,
      employeeId: session.employeeId,
      openedAt: session.openedAt,
      openingAmount: session.openingAmount.toNumber(),
      status: 'OPEN',
      movements: [],
      salesTotal: 0,
    };
  }

  async addCashMovement(
    tenantId: string,
    input: AddCashMovementInput
  ): Promise<CashMovementEntity> {
    const session = await prisma.cashSession.findFirst({
      where: { id: input.sessionId, tenantId, status: 'OPEN' },
    });
    if (!session) {
      throw new Error('Sesión de caja no encontrada o ya cerrada');
    }

    const created = await prisma.cashMovement.create({
      data: {
        tenantId,
        sessionId: input.sessionId,
        type: input.type,
        amount: input.amount,
        concept: input.concept,
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      sessionId: created.sessionId,
      type: created.type as 'IN' | 'OUT',
      amount: created.amount.toNumber(),
      concept: created.concept,
      createdAt: created.createdAt,
    };
  }

  async closeCashSession(
    tenantId: string,
    input: CloseCashSessionInput
  ): Promise<CashSessionEntity> {
    const session = await prisma.cashSession.findFirst({
      where: { id: input.sessionId, tenantId },
      include: { movements: true },
    });
    if (!session) {
      throw new ApiError(404, 'Sesión de caja no encontrada');
    }
    if (session.status !== 'OPEN') {
      throw new ApiError(409, 'La sesión de caja ya está cerrada');
    }

    // Server-side money: expected = opening + Σmovements(IN−OUT) + Σsales −
    // Σreturns; the difference against the physical count is derived here.
    // Client-sent expectedAmount/difference are never read (the contract only
    // accepts the physical count).
    const [salesAgg, returnsAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, cashSessionId: session.id },
        _sum: { total: true },
      }),
      prisma.saleReturn.aggregate({
        where: { tenantId, cashSessionId: session.id },
        _sum: { totalRefund: true },
      }),
    ]);

    const movementsNet = session.movements.reduce(
      (acc, m) =>
        m.type === 'IN' ? acc + m.amount.toNumber() : acc - m.amount.toNumber(),
      0
    );
    const salesTotal = salesAgg._sum.total?.toNumber() ?? 0;
    const returnsTotal = returnsAgg._sum.totalRefund?.toNumber() ?? 0;
    const expectedAmount =
      Math.round(
        (session.openingAmount.toNumber() + movementsNet + salesTotal - returnsTotal) * 100
      ) / 100;
    const physicalCount = input.physicalCount;
    const difference = Math.round((physicalCount - expectedAmount) * 100) / 100;

    const updated = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingAmount: physicalCount,
        expectedAmount,
        difference,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      employeeId: updated.employeeId,
      openedAt: updated.openedAt,
      closedAt: updated.closedAt,
      openingAmount: updated.openingAmount.toNumber(),
      closingAmount: updated.closingAmount?.toNumber() ?? null,
      expectedAmount: updated.expectedAmount?.toNumber() ?? null,
      difference: updated.difference?.toNumber() ?? null,
      status: (updated.status as CashSessionEntity['status']) ?? 'CLOSED',
      notes: updated.notes,
      movements: session.movements.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        sessionId: m.sessionId,
        type: m.type as 'IN' | 'OUT',
        amount: m.amount.toNumber(),
        concept: m.concept,
        createdAt: m.createdAt,
      })),
      salesTotal,
    };
  }

  // ─── Tax ────────────────────────────────────────────────────────────────────
  async getTaxRates(tenantId: string): Promise<TaxRateEntity[]> {
    const rows = await prisma.taxRate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      rate: r.rate.toNumber(),
      isDefault: r.isDefault,
    }));
  }

  async createTaxRate(
    tenantId: string,
    input: CreateTaxRateInput
  ): Promise<TaxRateEntity> {
    const makeDefault = input.isDefault === true;
    const created = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.taxRate.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }
      return tx.taxRate.create({
        data: {
          tenantId,
          name: input.name,
          rate: input.rate,
          isInclusive: input.isInclusive,
          isActive: true,
          isDefault: makeDefault,
        },
      });
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      name: created.name,
      rate: created.rate.toNumber(),
      isDefault: created.isDefault,
    };
  }

  async updateTaxRate(
    tenantId: string,
    rateId: string,
    input: UpdateTaxRateInput
  ): Promise<TaxRateEntity> {
    const makeDefault = input.isDefault === true;
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.taxRate.findFirst({
        where: { tenantId, id: rateId },
      });
      if (!existing) {
        throw new Error('Tasa de impuesto no encontrada');
      }
      if (makeDefault) {
        await tx.taxRate.updateMany({
          where: { tenantId, id: { not: rateId } },
          data: { isDefault: false },
        });
      }
      return tx.taxRate.update({
        where: { id: rateId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.rate !== undefined ? { rate: input.rate } : {}),
          ...(input.isInclusive !== undefined
            ? { isInclusive: input.isInclusive }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          isDefault: makeDefault,
        },
      });
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      rate: updated.rate.toNumber(),
      isDefault: updated.isDefault,
    };
  }

  async deleteTaxRate(tenantId: string, rateId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.taxRate.findFirst({
        where: { tenantId, id: rateId },
      });
      if (!existing) {
        throw new Error('Tasa de impuesto no encontrada');
      }
      const remaining = await tx.taxRate.count({ where: { tenantId } });
      if (remaining <= 1) {
        throw new Error('Debe existir al menos una tasa de impuesto');
      }
      await tx.taxRate.delete({ where: { id: rateId } });
      if (existing.isDefault) {
        const next = await tx.taxRate.findFirst({
          where: { tenantId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (next) {
          await tx.taxRate.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async getFiscalSummary(tenantId: string): Promise<FiscalSummary> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [totals, taxed, saleItems] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { total: true, taxAmount: true },
      }),
      prisma.sale.aggregate({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
          taxAmount: { gt: 0 },
        },
        _sum: { total: true },
      }),
      prisma.saleItem.findMany({
        where: { sale: { tenantId, createdAt: { gte: start, lt: end } } },
        select: { quantity: true, price: true, item: { select: { cost: true } } },
      }),
    ]);

    const profit = saleItems.reduce(
      (acc, si) =>
        acc + (si.price.toNumber() - si.item.cost.toNumber()) * si.quantity,
      0
    );

    return {
      monthLabel: now.toLocaleDateString('es-NI', {
        month: 'long',
        year: 'numeric',
      }),
      totalSales: totals._count._all ?? 0,
      taxedRevenue: taxed._sum.total?.toNumber() ?? 0,
      taxCollected: totals._sum.taxAmount?.toNumber() ?? 0,
      profit: Math.round(profit * 100) / 100,
    };
  }

  // ─── Invoicing / CAI config ────────────────────────────────────────────────
  async getInvoicingConfig(tenantId: string): Promise<InvoicingConfigEntity | null> {
    const config = await prisma.invoicingConfig.findUnique({
      where: { tenantId },
    });
    return config ? this.toInvoicingConfigEntity(config) : null;
  }

  async updateInvoicingConfig(
    tenantId: string,
    input: UpdateInvoicingConfigInput
  ): Promise<InvoicingConfigEntity> {
    const updateData: Prisma.InvoicingConfigUpdateInput = {
      ...(input.caiNumber !== undefined ? { caiNumber: input.caiNumber } : {}),
      ...(input.rangeFrom !== undefined ? { rangeFrom: input.rangeFrom } : {}),
      ...(input.rangeTo !== undefined ? { rangeTo: input.rangeTo } : {}),
      ...(input.limitDate !== undefined ? { limitDate: input.limitDate } : {}),
      ...(input.companyTaxId !== undefined
        ? { companyTaxId: input.companyTaxId }
        : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
    };
    // All five CAI fields are required by the PUT schema, so an upsert-create
    // with only scalars fully satisfies InvoicingConfigCreateInput.
    const createData: Prisma.InvoicingConfigUncheckedCreateInput = {
      tenantId,
      caiNumber: input.caiNumber ?? '',
      rangeFrom: input.rangeFrom ?? '',
      rangeTo: input.rangeTo ?? '',
      ...(input.limitDate !== undefined ? { limitDate: input.limitDate } : {}),
      companyTaxId: input.companyTaxId ?? '',
      legalName: input.legalName ?? '',
    };

    const config = await prisma.invoicingConfig.upsert({
      where: { tenantId },
      update: updateData,
      create: createData,
    });

    return this.toInvoicingConfigEntity(config);
  }

  private toInvoicingConfigEntity(config: {
    id: string;
    tenantId: string;
    caiNumber: string;
    rangeFrom: string;
    rangeTo: string;
    limitDate: Date | null;
    companyTaxId: string;
    legalName: string;
    createdAt: Date;
    updatedAt: Date;
  }): InvoicingConfigEntity {
    return {
      id: config.id,
      tenantId: config.tenantId,
      caiNumber: config.caiNumber,
      rangeFrom: config.rangeFrom,
      rangeTo: config.rangeTo,
      limitDate: config.limitDate,
      companyTaxId: config.companyTaxId,
      legalName: config.legalName,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  // ─── Sales (POS) ────────────────────────────────────────────────────────────
  async findCustomers(
    tenantId: string,
    query?: string
  ): Promise<CustomerLight[]> {
    const rows = await prisma.person.findMany({
      where: {
        tenantId,
        employee: null,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query } },
                { lastName: { contains: query } },
                { documentId: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    return rows.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      documentId: p.documentId,
      email: p.email,
      phone: p.phone,
    }));
  }

  async createCustomer(
    tenantId: string,
    input: CreateCustomerInput
  ): Promise<CustomerLight> {
    const created = await prisma.person.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        documentId: input.documentId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
      },
    });

    return this.toCustomerLight(created);
  }

  async updateCustomer(
    tenantId: string,
    customerId: string,
    input: UpdateCustomerInput
  ): Promise<CustomerLight> {
    // Customers are Persons without an Employee record; employee persons are
    // never editable through the customers surface (tenant-scoped, 404).
    const existing = await prisma.person.findFirst({
      where: { tenantId, id: customerId, employee: null },
    });
    if (!existing) {
      throw new ApiError(404, 'Cliente no encontrado');
    }

    const data: Prisma.PersonUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.documentId !== undefined) data.documentId = input.documentId;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;

    const updated = await prisma.person.update({
      where: { id: customerId },
      data,
    });

    return this.toCustomerLight(updated);
  }

  private toCustomerLight(p: {
    id: string;
    firstName: string;
    lastName: string;
    documentId: string | null;
    email: string | null;
    phone: string | null;
  }): CustomerLight {
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      documentId: p.documentId,
      email: p.email,
      phone: p.phone,
    };
  }

  async registerSale(
    tenantId: string,
    input: RegisterSaleInput
  ): Promise<SaleEntity> {
    if (!input.lines.length) {
      throw new ApiError(400, 'La venta no tiene productos');
    }

    const mergedLines = new Map<string, number>();
    for (const line of input.lines) {
      if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
        throw new ApiError(400, 'Cantidad inválida en uno de los productos');
      }
      mergedLines.set(
        line.itemId,
        (mergedLines.get(line.itemId) ?? 0) + line.quantity
      );
    }
    const lines = [...mergedLines.entries()].map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    const openSession = await prisma.cashSession.findFirst({
      where: { tenantId, status: 'OPEN' },
    });
    if (!openSession) {
      throw new ApiError(400, 'Debe abrir la caja antes de registrar una venta');
    }
    const branchId = openSession.branchId;

    const items = await prisma.item.findMany({
      where: { tenantId, id: { in: lines.map((l) => l.itemId) } },
    });
    if (items.length !== lines.length) {
      throw new ApiError(400, 'Uno o más productos no existen');
    }
    const itemById = new Map(items.map((i) => [i.id, i] as const));

    let customer: { firstName: string; lastName: string } | null = null;
    if (input.personId) {
      customer = await prisma.person.findFirst({
        where: { tenantId, id: input.personId },
        select: { firstName: true, lastName: true },
      });
      if (!customer) throw new ApiError(404, 'Cliente no encontrado');
    }

    const defaultTax =
      (await prisma.taxRate.findFirst({
        where: { tenantId, isDefault: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await prisma.taxRate.findFirst({
        where: { tenantId, isInclusive: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      }));
    const taxRatePct = defaultTax?.rate.toNumber() ?? 0;

    const saleResult = await prisma.$transaction(async (tx) => {
      const subtotal = lines.reduce((acc, l) => {
        const item = itemById.get(l.itemId);
        const price = item ? item.price.toNumber() : 0;
        return acc + price * l.quantity;
      }, 0);

      const discount = Math.min(Math.max(input.discount, 0), subtotal);
      const base = subtotal - discount;
      const taxAmount = taxRatePct > 0 ? base * (taxRatePct / (100 + taxRatePct)) : 0;
      const total = base;

      // Server-side money: only the tendered amount is client input; the
      // balance is derived here and the receivable decision follows from it.
      const paidAmount = input.paidAmount ?? total;
      const balance = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
      if (balance > 0 && !input.personId) {
        throw new ApiError(
          400,
          'Las ventas a crédito requieren un cliente asociado'
        );
      }

      // Stock: decrement only when the branch has enough; otherwise 409 and the
      // whole transaction rolls back (nothing is written).
      for (const line of lines) {
        const result = await tx.inventory.updateMany({
          where: {
            tenantId,
            branchId,
            itemId: line.itemId,
            stock: { gte: line.quantity },
          },
          data: { stock: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          const item = itemById.get(line.itemId);
          throw new ApiError(
            409,
            `Stock insuficiente para "${item?.name ?? 'producto'}"`
          );
        }
      }

      // Fiscal continuity: the SaleCounter upsert+increment lives inside the
      // sale transaction, so INV numbers never restart nor collide. After the
      // seed (lastNumber 16) the first real sale is INV-…-000017.
      const counter = await tx.saleCounter.upsert({
        where: { tenantId },
        update: { lastNumber: { increment: 1 } },
        create: { tenantId, lastNumber: 1 },
        select: { lastNumber: true },
      });
      const now = new Date();
      const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      const invoiceNumber = `INV-${datePart}-${String(
        counter.lastNumber
      ).padStart(6, '0')}`;

      const created = await tx.sale.create({
        data: {
          tenantId,
          personId: input.personId ?? null,
          cashSessionId: openSession.id,
          subtotal,
          taxAmount,
          discount,
          total,
          paymentMethod: input.paymentMethod,
          paidAmount,
          balance,
          invoiceNumber,
          notes: input.notes ?? null,
          status: 'COMPLETED',
          items: {
            create: lines.map((l) => {
              const item = itemById.get(l.itemId)!;
              return {
                itemId: item.id,
                quantity: l.quantity,
                price: item.price,
              };
            }),
          },
        },
        include: { items: { include: { item: true } } },
      });

      // Credit / partial payment: a receivable opens only when a balance
      // remains after the tender; same transaction, so it always matches the
      // sale it belongs to.
      if (balance > 0) {
        await tx.receivable.create({
          data: {
            tenantId,
            saleId: created.id,
            personId: input.personId!,
            originalAmount: balance,
            balance,
            status: 'OPEN',
          },
        });
      }

      return created;
    });

    return {
      id: saleResult.id,
      tenantId: saleResult.tenantId,
      cashSessionId: saleResult.cashSessionId,
      personId: saleResult.personId,
      customerName: customer
        ? `${customer.firstName} ${customer.lastName}`
        : null,
      subtotal: saleResult.subtotal.toNumber(),
      taxAmount: saleResult.taxAmount.toNumber(),
      discount: saleResult.discount.toNumber(),
      total: saleResult.total.toNumber(),
      paymentMethod: saleResult.paymentMethod as PaymentMethod,
      paidAmount: saleResult.paidAmount.toNumber(),
      balance: saleResult.balance.toNumber(),
      invoiceNumber: saleResult.invoiceNumber,
      status: saleResult.status,
      createdAt: saleResult.createdAt,
      items: saleResult.items.map((si) => ({
        id: si.id,
        itemId: si.itemId,
        itemName: si.item.name,
        quantity: si.quantity,
        price: si.price.toNumber(),
      })),
    };
  }

  async getSales(
    tenantId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResult<SaleEntity>> {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          person: { select: { firstName: true, lastName: true } },
          items: { include: { item: { select: { name: true } } } },
        },
      }),
      prisma.sale.count({ where: { tenantId } }),
    ]);

    return {
      items: rows.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        cashSessionId: s.cashSessionId,
        personId: s.personId,
        customerName: s.person
          ? `${s.person.firstName} ${s.person.lastName}`
          : null,
        subtotal: s.subtotal.toNumber(),
        taxAmount: s.taxAmount.toNumber(),
        discount: s.discount.toNumber(),
        total: s.total.toNumber(),
        paymentMethod: s.paymentMethod as PaymentMethod,
        paidAmount: s.paidAmount.toNumber(),
        balance: s.balance.toNumber(),
        invoiceNumber: s.invoiceNumber,
        status: s.status,
        createdAt: s.createdAt,
        notes: s.notes,
        items: s.items.map((si) => ({
          id: si.id,
          itemId: si.itemId,
          itemName: si.item.name,
          quantity: si.quantity,
          price: si.price.toNumber(),
        })),
      })),
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  // ─── P1: Sales returns (audited refunds / voids) ───────────────────────────
  async createSaleReturn(
    tenantId: string,
    saleId: string,
    input: CreateSaleReturnInput
  ): Promise<SaleReturnEntity> {
    // Merge duplicate item lines into single quantities (same pattern as registerSale).
    const merged = new Map<string, number>();
    for (const line of input.items) {
      if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
        throw new ApiError(400, 'Cantidad inválida en la devolución');
      }
      merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.quantity);
    }
    const lines = [...merged.entries()].map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    return await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { tenantId, id: saleId },
        include: {
          items: { include: { item: true } },
          cashSession: { select: { branchId: true } },
        },
      });
      if (!sale) {
        throw new ApiError(404, 'Venta no encontrada');
      }

      // Every returned item must belong to the original sale.
      for (const line of lines) {
        if (!sale.items.some((si) => si.itemId === line.itemId)) {
          throw new ApiError(
            400,
            `El producto "${line.itemId}" no pertenece a la venta`
          );
        }
      }

      // Over-return guard: cumulative across prior returns for this sale →
      // 409 when the refunded qty would exceed the sold qty; stock unchanged
      // because the whole transaction rolls back.
      const priorReturns = await tx.saleReturnItem.findMany({
        where: { return: { tenantId, saleId } },
        select: { itemId: true, quantity: true },
      });
      const priorQtyByItem = new Map<string, number>();
      for (const pr of priorReturns) {
        priorQtyByItem.set(
          pr.itemId,
          (priorQtyByItem.get(pr.itemId) ?? 0) + pr.quantity
        );
      }

      for (const line of lines) {
        const saleItem = sale.items.find((si) => si.itemId === line.itemId)!;
        const prior = priorQtyByItem.get(line.itemId) ?? 0;
        if (prior + line.quantity > saleItem.quantity) {
          throw new ApiError(
            409,
            `La cantidad a devolver supera la cantidad vendida de "${saleItem.item.name}"`
          );
        }
      }

      // Refund = sale-time price × qty (two-decimal rounding only on the total).
      let totalRefund = 0;
      for (const line of lines) {
        const saleItem = sale.items.find((si) => si.itemId === line.itemId)!;
        totalRefund += saleItem.price.toNumber() * line.quantity;
      }
      totalRefund = Math.round(totalRefund * 100) / 100;

      // Stock restore: goods go back to the branch where they were sold.
      const branchId = sale.cashSession?.branchId ?? null;
      if (branchId) {
        for (const line of lines) {
          const result = await tx.inventory.updateMany({
            where: { tenantId, branchId, itemId: line.itemId },
            data: { stock: { increment: line.quantity } },
          });
          if (result.count === 0) {
            const saleItem = sale.items.find((si) => si.itemId === line.itemId)!;
            throw new ApiError(
              400,
              `No existe inventario para "${saleItem.item.name}" en la sucursal de la venta`
            );
          }
        }
      }

      // Receivable adjustment: a refund on a credit sale reduces the
      // outstanding balance; refund beyond the remaining balance is an
      // overpay edge → 409 (the operator handles mixed cash/debt refunds
      // manually; the balance can never go negative).
      if (sale.balance.toNumber() > 0) {
        const receivable = await tx.receivable.findFirst({
          where: { tenantId, saleId },
        });
        if (receivable && receivable.balance.toNumber() > 0) {
          if (totalRefund > receivable.balance.toNumber()) {
            throw new ApiError(
              409,
              'La devolución supera el saldo pendiente de la cuenta por cobrar'
            );
          }
          const newBalance =
            Math.round((receivable.balance.toNumber() - totalRefund) * 100) / 100;
          await tx.receivable.update({
            where: { id: receivable.id },
            data: {
              balance: newBalance,
              status: newBalance <= 0 ? 'PAID' : 'PARTIAL',
            },
          });
        }
      }

      // Persist the audited return + line items (audit trail for the sale).
      const saleReturn = await tx.saleReturn.create({
        data: {
          tenantId,
          saleId: sale.id,
          cashSessionId: sale.cashSessionId,
          reason: input.reason ?? null,
          totalRefund,
          items: {
            create: lines.map((l) => {
              const saleItem = sale.items.find((si) => si.itemId === l.itemId)!;
              return {
                itemId: l.itemId,
                quantity: l.quantity,
                refundAmount: saleItem.price.toNumber() * l.quantity,
              };
            }),
          },
        },
        include: {
          items: { include: { item: { select: { name: true } } } },
        },
      });

      return {
        id: saleReturn.id,
        tenantId: saleReturn.tenantId,
        saleId: saleReturn.saleId,
        saleNumber: sale.invoiceNumber,
        cashSessionId: saleReturn.cashSessionId,
        reason: saleReturn.reason,
        totalRefund: saleReturn.totalRefund.toNumber(),
        createdAt: saleReturn.createdAt,
        items: saleReturn.items.map((si) => ({
          id: si.id,
          returnId: si.returnId,
          itemId: si.itemId,
          itemName: si.item.name,
          quantity: si.quantity,
          refundAmount: si.refundAmount.toNumber(),
        })),
      };
    });
  }

  // ─── P1: Receivables (credit tracking + payments) ──────────────────────────
  async getReceivables(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: ReceivableStatus
  ): Promise<PaginatedResult<ReceivableEntity>> {
    const where: Prisma.ReceivableWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
    };
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.receivable.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          person: { select: { firstName: true, lastName: true } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.receivable.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        saleId: r.saleId,
        personId: r.personId,
        customerName: r.person
          ? `${r.person.firstName} ${r.person.lastName}`
          : null,
        originalAmount: r.originalAmount.toNumber(),
        balance: r.balance.toNumber(),
        status: r.status as ReceivableStatus,
        createdAt: r.createdAt,
        payments: r.payments.map((p) => ({
          id: p.id,
          tenantId: p.tenantId,
          receivableId: p.receivableId,
          amount: p.amount.toNumber(),
          method: p.method as PaymentMethod,
          createdAt: p.createdAt,
        })),
      })),
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async payReceivable(
    tenantId: string,
    receivableId: string,
    input: PayReceivableInput
  ): Promise<ReceivableEntity> {
    const result = await prisma.$transaction(async (tx) => {
      const receivable = await tx.receivable.findFirst({
        where: { tenantId, id: receivableId },
      });
      if (!receivable) {
        throw new ApiError(404, 'Cuenta por cobrar no encontrada');
      }
      if (input.amount <= 0) {
        throw new ApiError(400, 'El monto del pago debe ser positivo');
      }
      // Overpay guard: a payment can never exceed the remaining balance → 409.
      if (input.amount > receivable.balance.toNumber()) {
        throw new ApiError(
          409,
          'El pago supera el saldo pendiente de la cuenta por cobrar'
        );
      }

      const newBalance =
        Math.round((receivable.balance.toNumber() - input.amount) * 100) / 100;
      const status = newBalance <= 0 ? 'PAID' : 'PARTIAL';

      await tx.receivablePayment.create({
        data: {
          tenantId,
          receivableId,
          amount: input.amount,
          method: input.method,
        },
      });

      return tx.receivable.update({
        where: { id: receivableId },
        data: { balance: newBalance, status },
        include: {
          person: { select: { firstName: true, lastName: true } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    return {
      id: result.id,
      tenantId: result.tenantId,
      saleId: result.saleId,
      personId: result.personId,
      customerName: result.person
        ? `${result.person.firstName} ${result.person.lastName}`
        : null,
      originalAmount: result.originalAmount.toNumber(),
      balance: result.balance.toNumber(),
      status: result.status as ReceivableStatus,
      createdAt: result.createdAt,
      payments: result.payments.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        receivableId: p.receivableId,
        amount: p.amount.toNumber(),
        method: p.method as PaymentMethod,
        createdAt: p.createdAt,
      })),
    };
  }
}