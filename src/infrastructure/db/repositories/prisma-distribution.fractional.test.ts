import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaDistributionRepository } from '@/infrastructure/db/repositories/prisma-distribution.repository';

// Fase 2 Slice A (fractional quantities) — repository-level proof that Decimal
// math replaces float coercion everywhere a quantity touches money or stock:
//   2.5 × 40 = 100.00 exactly, 0.1 + 0.2 merges to 0.3 (not 0.30000000000000004),
//   receives/returns act on the true two-decimal values.
// The Prisma client is mocked at the db layer; $transaction runs the callback
// against a tx object sharing the same method mocks (same technique as
// prisma-distribution.inventory-ledger.test.ts).
const txMocks = vi.hoisted(() => ({
  cashSessionFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  itemFindFirst: vi.fn(),
  itemUpdate: vi.fn(),
  personFindFirst: vi.fn(),
  taxRateFindFirst: vi.fn(),
  saleCounterUpsert: vi.fn(),
  inventoryFindFirst: vi.fn(),
  inventoryUpdate: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  userFindFirst: vi.fn(),
  purchaseOrderFindFirst: vi.fn(),
  purchaseOrderUpdate: vi.fn(),
  purchaseOrderItemUpdateMany: vi.fn(),
  purchaseOrderItemFindMany: vi.fn(),
  saleFindFirst: vi.fn(),
  saleCreate: vi.fn(),
  saleReturnItemFindMany: vi.fn(),
  saleReturnCreate: vi.fn(),
  receivableFindFirst: vi.fn(),
}));

vi.mock('@/infrastructure/db/prisma', () => {
  const tx = {
    cashSession: { findFirst: txMocks.cashSessionFindFirst },
    item: {
      findMany: txMocks.itemFindMany,
      findFirst: txMocks.itemFindFirst,
      update: txMocks.itemUpdate,
    },
    person: { findFirst: txMocks.personFindFirst },
    taxRate: { findFirst: txMocks.taxRateFindFirst },
    saleCounter: { upsert: txMocks.saleCounterUpsert },
    inventory: {
      findFirst: txMocks.inventoryFindFirst,
      update: txMocks.inventoryUpdate,
      updateMany: txMocks.inventoryUpdateMany,
    },
    inventoryMovement: { create: txMocks.inventoryMovementCreate },
    user: { findFirst: txMocks.userFindFirst },
    purchaseOrder: {
      findFirst: txMocks.purchaseOrderFindFirst,
      update: txMocks.purchaseOrderUpdate,
    },
    purchaseOrderItem: {
      updateMany: txMocks.purchaseOrderItemUpdateMany,
      findMany: txMocks.purchaseOrderItemFindMany,
    },
    sale: { findFirst: txMocks.saleFindFirst, create: txMocks.saleCreate },
    saleReturn: { create: txMocks.saleReturnCreate },
    saleReturnItem: { findMany: txMocks.saleReturnItemFindMany },
    receivable: { findFirst: txMocks.receivableFindFirst },
  };
  return {
    prisma: {
      ...tx,
      $transaction: vi.fn(
        (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
      ),
    },
  };
});

const repo = new PrismaDistributionRepository();
const decimal = (n: number) => new Prisma.Decimal(n);

const ITEM = {
  id: 'item_1',
  tenantId: 'tenant-1',
  name: 'Arroz',
  sku: 'ARZ-001',
  cost: decimal(30),
  price: decimal(40),
};
const USER = {
  id: 'user_1',
  tenantId: 'tenant-1',
  person: { firstName: 'Kevin', lastName: 'Mejía' },
};
const OPEN_SESSION = {
  id: 'cash_1',
  tenantId: 'tenant-1',
  status: 'OPEN',
  branchId: 'branch-1',
};

function inventoryRow(stock: number) {
  return {
    id: 'inv_1',
    tenantId: 'tenant-1',
    itemId: 'item_1',
    branchId: 'branch-1',
    stock: decimal(stock),
    minAlert: 5,
  };
}

function movementRow(quantity: number, type: string, refId: string | null) {
  return {
    id: 'mov_1',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    itemId: 'item_1',
    type,
    quantity: decimal(quantity),
    reason: null,
    costSnapshot: decimal(30),
    notes: null,
    userId: 'user_1',
    refId,
    createdAt: new Date('2026-09-22T13:00:00.000Z'),
  };
}

function saleRow(quantity: number, subtotal: number) {
  return {
    id: 'sale_1',
    tenantId: 'tenant-1',
    cashSessionId: 'cash_1',
    personId: null,
    subtotal: decimal(subtotal),
    taxAmount: decimal(0),
    discount: decimal(0),
    total: decimal(subtotal),
    paymentMethod: 'CASH',
    paidAmount: decimal(subtotal),
    balance: decimal(0),
    invoiceNumber: 'INV-20260922-000017',
    status: 'COMPLETED',
    createdAt: new Date('2026-09-22T13:00:00.000Z'),
    items: [
      {
        id: 'si_1',
        itemId: 'item_1',
        quantity: decimal(quantity),
        price: decimal(40),
        cost: decimal(30),
        item: { name: 'Arroz' },
      },
    ],
  };
}

function saleForReturnRow(soldQty: number) {
  return {
    id: 'sale_1',
    tenantId: 'tenant-1',
    cashSessionId: 'cash_1',
    personId: null,
    subtotal: decimal(soldQty * 40),
    taxAmount: decimal(0),
    discount: decimal(0),
    total: decimal(soldQty * 40),
    paidAmount: decimal(soldQty * 40),
    balance: decimal(0),
    invoiceNumber: 'INV-20260922-000017',
    status: 'COMPLETED',
    createdAt: new Date('2026-09-22T13:00:00.000Z'),
    cashSession: { branchId: 'branch-1' },
    items: [
      {
        id: 'si_1',
        itemId: 'item_1',
        quantity: decimal(soldQty),
        price: decimal(40),
        cost: decimal(30),
        item: { name: 'Arroz' },
      },
    ],
  };
}

function returnRow(quantity: number, refund: number) {
  return {
    id: 'return_1',
    tenantId: 'tenant-1',
    saleId: 'sale_1',
    cashSessionId: 'cash_1',
    reason: null,
    totalRefund: decimal(refund),
    createdAt: new Date('2026-09-22T13:05:00.000Z'),
    items: [
      {
        id: 'ri_1',
        returnId: 'return_1',
        itemId: 'item_1',
        quantity: decimal(quantity),
        refundAmount: decimal(refund),
        item: { name: 'Arroz' },
      },
    ],
  };
}

function poRow(quantity: number, received = 0, status: 'ORDERED' | 'RECEIVED' = 'ORDERED') {
  const subtotal = decimal(quantity * 25);
  return {
    id: 'po_1',
    tenantId: 'tenant-1',
    supplierId: 'sup_1',
    branchId: 'branch-1',
    orderNumber: 'PO-2026-0001',
    status,
    subtotal,
    taxAmount: decimal(0),
    total: subtotal,
    notes: null,
    receivedAt: status === 'RECEIVED' ? new Date('2026-09-22T14:00:00.000Z') : null,
    createdAt: new Date('2026-09-22T09:00:00.000Z'),
    supplier: { name: 'Proveedor 1' },
    branch: { name: 'Sucursal Central' },
    items: [
      {
        id: 'poi_1',
        orderId: 'po_1',
        itemId: 'item_1',
        quantity: decimal(quantity),
        receivedQty: decimal(received),
        cost: decimal(25),
        item: { name: 'Arroz' },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // registerSale defaults
  txMocks.cashSessionFindFirst.mockResolvedValue(OPEN_SESSION);
  txMocks.itemFindMany.mockResolvedValue([ITEM]);
  txMocks.personFindFirst.mockResolvedValue(null);
  txMocks.taxRateFindFirst.mockResolvedValue(null);
  txMocks.saleCounterUpsert.mockResolvedValue({ lastNumber: 17 });
  txMocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
  txMocks.inventoryMovementCreate.mockResolvedValue(movementRow(0, 'SALE', 'sale_1'));
  txMocks.userFindFirst.mockResolvedValue(USER);

  // receive defaults
  txMocks.purchaseOrderFindFirst.mockResolvedValue(poRow(10.5));
  txMocks.itemFindFirst.mockResolvedValue(ITEM);
  txMocks.inventoryFindFirst.mockResolvedValue(inventoryRow(0));
  txMocks.itemUpdate.mockResolvedValue({ ...ITEM, cost: decimal(25) });
  txMocks.inventoryUpdate.mockResolvedValue(inventoryRow(3.75));
  txMocks.purchaseOrderItemUpdateMany.mockResolvedValue({ count: 1 });
  txMocks.purchaseOrderItemFindMany.mockResolvedValue([]);
  txMocks.purchaseOrderUpdate.mockResolvedValue(poRow(10.5));

  // return defaults
  txMocks.saleFindFirst.mockResolvedValue(saleForReturnRow(5));
  txMocks.saleReturnItemFindMany.mockResolvedValue([]);
  txMocks.saleReturnCreate.mockResolvedValue(returnRow(1.5, 60));
  txMocks.receivableFindFirst.mockResolvedValue(null);

  // misc
  txMocks.saleCreate.mockResolvedValue(saleRow(2.5, 100));
});

describe('registerSale — fractional quantities stay Decimal-exact', () => {
  it('2.5 units × C$40 lands C$100.00, stock decremented by exactly 2.5 and a SALE ledger row for −2.5', async () => {
    const sale = await repo.registerSale('tenant-1', {
      lines: [{ itemId: 'item_1', quantity: 2.5 }],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        itemId: 'item_1',
        stock: { gte: decimal(2.5) },
      },
      data: { stock: { decrement: decimal(2.5) } },
    });
    expect(txMocks.saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: decimal(100),
          total: decimal(100),
          items: {
            create: [{ itemId: 'item_1', quantity: 2.5, price: decimal(40), cost: decimal(30) }],
          },
        }),
      })
    );
    // Ledger row is the negative 2-dp value, not a float artifact.
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SALE',
          quantity: -2.5,
          costSnapshot: 30,
          refId: 'sale_1',
        }),
      })
    );
    expect(sale).toMatchObject({
      subtotal: 100,
      total: 100,
      items: [{ quantity: 2.5 }],
    });
  });

  it('0.1 + 0.2 of the same item merge to 0.3 (not 0.3…04) and charge exactly C$12.00', async () => {
    txMocks.saleCreate.mockResolvedValue(saleRow(0.3, 12));

    const sale = await repo.registerSale('tenant-1', {
      lines: [
        { itemId: 'item_1', quantity: 0.1 },
        { itemId: 'item_1', quantity: 0.2 },
      ],
      discount: 0,
      paymentMethod: 'CASH',
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stock: { gte: decimal(0.3) } }),
        data: { stock: { decrement: decimal(0.3) } },
      })
    );
    expect(txMocks.saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: decimal(12),
          total: decimal(12),
          items: { create: [{ itemId: 'item_1', quantity: 0.3, price: decimal(40), cost: decimal(30) }] },
        }),
      })
    );
    expect(sale.subtotal).toBe(12);
    expect(sale.items[0].quantity).toBe(0.3);
  });

  it('still rejects insufficient fractional stock with 409', async () => {
    txMocks.inventoryUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.registerSale('tenant-1', {
        lines: [{ itemId: 'item_1', quantity: 0.5 }],
        discount: 0,
        paymentMethod: 'CASH',
        userId: 'user_1',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Stock insuficiente para "Arroz"',
    });
    expect(txMocks.saleCreate).not.toHaveBeenCalled();
  });
});

describe('receivePurchaseOrder — fractional receives on Decimal remainders', () => {
  it('receives 3.75 of a 10.5 PO line: exact increments and the PO stays ORDERED', async () => {
    txMocks.purchaseOrderItemFindMany.mockResolvedValue([
      { orderId: 'po_1', itemId: 'item_1', quantity: decimal(10.5), receivedQty: decimal(3.75) },
    ]);
    txMocks.purchaseOrderUpdate.mockResolvedValue(poRow(10.5, 3.75));

    const po = await repo.receivePurchaseOrder('tenant-1', 'po_1', {
      receivedItems: [{ itemId: 'item_1', quantity: 3.75 }],
      userId: 'user_1',
    });

    // First arrival (stock 0): weighted-avg cost adopts the PO line cost (25).
    expect(txMocks.itemUpdate).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { cost: decimal(25) },
    });
    expect(txMocks.inventoryUpdate).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { stock: { increment: decimal(3.75) } },
    });
    expect(txMocks.purchaseOrderItemUpdateMany).toHaveBeenCalledWith({
      where: { orderId: 'po_1', itemId: 'item_1' },
      data: { receivedQty: { increment: decimal(3.75) } },
    });
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'RECEIVE', quantity: 3.75, refId: 'po_1' }),
      })
    );
    expect(txMocks.purchaseOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ORDERED' }) })
    );
    expect(po.status).toBe('ORDERED');
    expect(po.items?.[0]).toMatchObject({ quantity: 10.5, receivedQty: 3.75 });
  });

  it('receiving the remaining 6.75 completes the PO (receivedQty 10.5 = quantity)', async () => {
    txMocks.purchaseOrderFindFirst.mockResolvedValue(poRow(10.5, 3.75));
    txMocks.purchaseOrderItemFindMany.mockResolvedValue([
      { orderId: 'po_1', itemId: 'item_1', quantity: decimal(10.5), receivedQty: decimal(10.5) },
    ]);
    txMocks.purchaseOrderUpdate.mockResolvedValue(poRow(10.5, 10.5, 'RECEIVED'));

    const po = await repo.receivePurchaseOrder('tenant-1', 'po_1', {
      receivedItems: [{ itemId: 'item_1', quantity: 6.75 }],
      userId: 'user_1',
    });

    expect(txMocks.purchaseOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RECEIVED' }) })
    );
    expect(po.status).toBe('RECEIVED');
    expect(po.items?.[0]).toMatchObject({ receivedQty: 10.5 });
  });

  it('over-receiving by a fraction (10.6 > 10.5 pending) is rejected with 409', async () => {
    await expect(
      repo.receivePurchaseOrder('tenant-1', 'po_1', {
        receivedItems: [{ itemId: 'item_1', quantity: 10.6 }],
        userId: 'user_1',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'La cantidad a recibir supera el pendiente de "Arroz"',
    });
    expect(txMocks.inventoryUpdate).not.toHaveBeenCalled();
  });
});

describe('createSaleReturn — fractional refunds and the cumulative over-return guard', () => {
  it('returns 1.5 of 5 sold: stock restored by 1.5, refund C$60, RETURN ledger row for +1.5', async () => {
    const saleReturn = await repo.createSaleReturn('tenant-1', 'sale_1', {
      items: [{ itemId: 'item_1', quantity: 1.5 }],
      userId: 'user_1',
    });

    expect(txMocks.inventoryUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', branchId: 'branch-1', itemId: 'item_1' },
      data: { stock: { increment: 1.5 } },
    });
    expect(txMocks.saleReturnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalRefund: decimal(60),
          items: {
            create: [{ itemId: 'item_1', quantity: 1.5, refundAmount: decimal(60) }],
          },
        }),
      })
    );
    expect(txMocks.inventoryMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'RETURN',
          quantity: 1.5,
          costSnapshot: 30,
          refId: 'return_1',
        }),
      })
    );
    expect(saleReturn).toMatchObject({ totalRefund: 60, items: [{ quantity: 1.5 }] });
  });

  it('0.1 + 0.2 lines merge to 0.3 → refund exactly C$12', async () => {
    txMocks.saleReturnCreate.mockResolvedValue(returnRow(0.3, 12));

    const saleReturn = await repo.createSaleReturn('tenant-1', 'sale_1', {
      items: [
        { itemId: 'item_1', quantity: 0.1 },
        { itemId: 'item_1', quantity: 0.2 },
      ],
      userId: 'user_1',
    });

    expect(txMocks.saleReturnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalRefund: decimal(12),
          items: { create: [{ itemId: 'item_1', quantity: 0.3, refundAmount: decimal(12) }] },
        }),
      })
    );
    expect(saleReturn.totalRefund).toBe(12);
  });

  it('blocks a fractional over-return against prior returns (1.5 prior + 3.6 > 5) with 409', async () => {
    txMocks.saleReturnItemFindMany.mockResolvedValue([
      { itemId: 'item_1', quantity: decimal(1.5) },
    ]);

    await expect(
      repo.createSaleReturn('tenant-1', 'sale_1', {
        items: [{ itemId: 'item_1', quantity: 3.6 }],
        userId: 'user_1',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'La cantidad a devolver supera la cantidad vendida de "Arroz"',
    });
    expect(txMocks.saleReturnCreate).not.toHaveBeenCalled();
  });
});