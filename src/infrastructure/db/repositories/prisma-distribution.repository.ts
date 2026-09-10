import { prisma } from '../prisma';
import type {
  IDistributionRepository,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  CreateSupplierInput,
  CreateEmployeeInput,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
  CreateTaxRateInput,
  UpdateTaxRateInput,
  RegisterSaleInput,
} from '@/core/ports/distribution-repository.port';
import type {
  CashMovementEntity,
  CashSessionEntity,
  CustomerLight,
  DistributionDashboardStats,
  EmployeeEntity,
  FiscalSummary,
  InventoryStockItem,
  PurchaseOrderEntity,
  RecentSale,
  SaleEntity,
  SupplierEntity,
  TaxRateEntity,
} from '@/core/entities/distribution';

interface EmployeePersonMetadata {
  department?: string;
  commissionRate?: number;
}

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
      throw new Error('Producto no encontrado');
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
      if (skuConflict) throw new Error('El SKU ya existe');
    }

    const item = await prisma.item.update({
      where: { id: itemId },
      data: itemData,
    });

    let inv = existing.inventory[0];
    if (inv) {
      inv = await prisma.inventory.update({
        where: { id: inv.id },
        data: {
          stock: input.stock ?? inv.stock,
          minAlert: input.minAlert ?? inv.minAlert,
        },
      });
    }

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

  // ─── Employees ──────────────────────────────────────────────────────────────
  async getEmployees(tenantId: string): Promise<EmployeeEntity[]> {
    const rows = await prisma.employee.findMany({
      where: { tenantId },
      include: { person: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((e) => {
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
    });
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
    const branch =
      (await firstBranchOfTenant(tenantId, input.branchId || undefined)) ?? null;
    if (!branch) {
      throw new Error('El tenant no tiene sucursales configuradas');
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
      where: { id: input.sessionId, tenantId, status: 'OPEN' },
    });
    if (!session) {
      throw new Error('Sesión de caja no encontrada o ya cerrada');
    }

    const updated = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingAmount: input.closingAmount,
        expectedAmount: input.expectedAmount,
        difference: input.difference,
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
      movements: [],
      salesTotal: 0,
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

  async registerSale(
    tenantId: string,
    input: RegisterSaleInput
  ): Promise<SaleEntity> {
    if (!input.lines.length) {
      throw new Error('La venta no tiene productos');
    }

    const mergedLines = new Map<string, number>();
    for (const line of input.lines) {
      if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
        throw new Error('Cantidad inválida en uno de los productos');
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
      throw new Error('Debe abrir la caja antes de registrar una venta');
    }
    const branchId = openSession.branchId;

    const items = await prisma.item.findMany({
      where: { tenantId, id: { in: lines.map((l) => l.itemId) } },
    });
    if (items.length !== lines.length) {
      throw new Error('Uno o más productos no existen');
    }
    const itemById = new Map(items.map((i) => [i.id, i] as const));

    let customer: { firstName: string; lastName: string } | null = null;
    if (input.personId) {
      customer = await prisma.person.findFirst({
        where: { tenantId, id: input.personId },
        select: { firstName: true, lastName: true },
      });
      if (!customer) throw new Error('Cliente no encontrado');
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
          throw new Error(
            `Stock insuficiente para "${item?.name ?? 'producto'}"`
          );
        }
      }

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

      return tx.sale.create({
        data: {
          tenantId,
          personId: input.personId ?? null,
          cashSessionId: openSession.id,
          subtotal,
          taxAmount,
          discount,
          total,
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

  async getSales(tenantId: string, limit = 100): Promise<SaleEntity[]> {
    const rows = await prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        person: { select: { firstName: true, lastName: true } },
        items: { include: { item: { select: { name: true } } } },
      },
    });

    return rows.map((s) => ({
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
    }));
  }
}