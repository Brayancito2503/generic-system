// Distribution vertical — Domain entities (Core, agnóstico a infraestructura)

/** Payment methods accepted by the POS and receivable payments. */
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';

/** Lifecycle of a credit-sale receivable. */
export type ReceivableStatus = 'OPEN' | 'PARTIAL' | 'PAID';

/**
 * Employee access profile: the vertical business role that determines which
 * modules and in-view actions an employee can use. `null` on an employee
 * means legacy full access (linked session role stays STAFF).
 */
export type AccessRole = 'CASHIER' | 'ACCOUNTANT' | 'MANAGER';

/**
 * Per-sale unit of an item (Fase 2 Slice B): weight items (rice, beans) are
 * stocked, priced AND ledgered in their sale unit. `null`/UNIDAD = legacy
 * piece-based behavior. No conversion factor: total is qty × price in the
 * same unit, so Decimal math stays exact.
 */
export type ItemSaleUnit = 'UNIDAD' | 'LIBRA' | 'KILOGRAMO';

export interface SupplierEntity {
  id: string;
  tenantId: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface PurchaseOrderItemEntity {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  /** Units already received; remaining = quantity - receivedQty. */
  receivedQty: number;
  cost: number;
}

export interface PurchaseOrderEntity {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  orderNumber?: string | null;
  status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  expectedDate?: Date | string | null;
  receivedAt?: Date | null;
  createdAt: Date;
  items?: PurchaseOrderItemEntity[];
}

export interface EmployeeEntity {
  id: string;
  tenantId: string;
  personId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
  role: string;
  /** Access profile: CASHIER/ACCOUNTANT/MANAGER, or null = legacy full access. */
  accessRole?: AccessRole | null;
  department?: string | null;
  salary?: number | null;
  commissionRate?: number | null;
  hireDate: Date;
  isActive: boolean;
  createdAt: Date;
  person?: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
}

export interface CashMovementEntity {
  id: string;
  tenantId: string;
  sessionId: string;
  type: 'IN' | 'OUT';
  amount: number;
  concept: string;
  createdAt: Date;
}

export interface CashSessionEntity {
  id: string;
  tenantId: string;
  branchId: string;
  employeeId?: string | null;
  employeeName?: string;
  openedAt: Date;
  closedAt?: Date | null;
  openingAmount: number;
  closingAmount?: number | null;
  expectedAmount?: number | null;
  difference?: number | null;
  status: 'OPEN' | 'CLOSED';
  notes?: string | null;
  movements: CashMovementEntity[];
  salesTotal?: number;
}

export interface TaxRateEntity {
  id: string;
  tenantId: string;
  name: string;
  rate: number;
  isDefault: boolean;
}

export interface InvoicingConfigEntity {
  id: string;
  tenantId: string;
  caiNumber: string;
  rangeFrom: string;
  rangeTo: string;
  limitDate?: Date | string | null;
  companyTaxId: string;
  legalName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleLineEntity {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  /** Display suffix for weight items (lb/kg); UNIDAD/null = no suffix. */
  saleUnit?: ItemSaleUnit | null;
}

export interface SaleEntity {
  id: string;
  tenantId: string;
  cashSessionId?: string | null;
  personId?: string | null;
  customerName?: string | null;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  balance: number;
  invoiceNumber?: string | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  items: SaleLineEntity[];
}

export interface ReceivablePaymentEntity {
  id: string;
  tenantId: string;
  receivableId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: Date;
}

export interface ReceivableEntity {
  id: string;
  tenantId: string;
  saleId: string;
  personId: string;
  customerName?: string | null;
  originalAmount: number;
  balance: number;
  status: ReceivableStatus;
  createdAt: Date;
  payments?: ReceivablePaymentEntity[];
}

export interface SaleReturnItemEntity {
  id: string;
  returnId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  refundAmount: number;
  /** Display suffix for weight items (lb/kg); UNIDAD/null = no suffix. */
  saleUnit?: ItemSaleUnit | null;
}

export interface SaleReturnEntity {
  id: string;
  tenantId: string;
  saleId: string;
  saleNumber?: string | null;
  cashSessionId?: string | null;
  reason?: string | null;
  totalRefund: number;
  createdAt: Date;
  items: SaleReturnItemEntity[];
}

export interface CustomerLight {
  id: string;
  firstName: string;
  lastName: string;
  documentId?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Ordering of the inventory product list (Fase 2 Slice C).
 * - `name`: Item.name asc — the historical default (alphabetical).
 * - `velocity`: units sold in the last 30 days desc, ties broken by Item.name
 *   asc, never-sold products last.
 * Mirrored by the closed Zod enum `inventoryListQuerySchema.sort`; this type is
 * the domain vocabulary so ports and modules never depend on the schema layer.
 */
export type InventorySort = 'name' | 'velocity';

export interface InventoryStockItem {
  id: string;
  tenantId: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  cost: number;
  price: number;
  stock: number;
  minAlert: number;
  isLowStock: boolean;
  /** Sale unit (Fase 2 Slice B); null/UNIDAD = legacy piece-based. */
  saleUnit?: ItemSaleUnit | null;
  /**
   * Units sold in the last 30 days (Fase 2 Slice C): the sales-velocity signal
   * behind the `velocity` ordering, summed from SaleItem over the tenant's Sale
   * window (0 when the product never sold).
   *
   * Optional because it is a LIST ranking signal, not item state: `getInventory`
   * always populates it, while the single-item responses of create/update omit
   * it instead of reporting a misleading 0 for an existing product.
   */
  unitsSold30d?: number;
}

// ─── Inventory ledger (kardex) ───────────────────────────────────────────────

/**
 * Kardex ledger: every Inventory.stock variation writes one InventoryMovement
 * row inside the same transaction. `quantity` follows the vertical's sign
 * convention: SALE and loss adjustments negative, RECEIVE/RETURN/SOBRANTE
 * positive, INITIAL signed as given. TRANSFER_* are reserved for the branch
 * transfer milestone (Fase 3) and are not written yet.
 */
export type InventoryMovementType =
  | 'INITIAL'
  | 'RECEIVE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN';

/** Reason of an ADJUSTMENT movement; SOBRANTE = positive correction. */
export type InventoryAdjustmentReason =
  | 'MERMA'
  | 'ROTURA'
  | 'VENCIMIENTO'
  | 'DESCUADRE'
  | 'SOBRANTE';

/** One kardex row: signed quantity + unit cost snapshot at movement time. */
export interface InventoryMovementEntity {
  id: string;
  tenantId: string;
  branchId: string;
  itemId: string;
  /** Populated by list queries (joined Item.name). */
  itemName?: string;
  type: InventoryMovementType;
  quantity: number;
  reason?: InventoryAdjustmentReason | null;
  costSnapshot: number;
  /** Sale unit of the moved item (Fase 2 Slice B); null/UNIDAD = no suffix. */
  saleUnit?: ItemSaleUnit | null;
  notes?: string | null;
  userId: string;
  /** Populated by list queries (joined User → Person name). */
  userName?: string;
  /** Sale / purchase order / return id that caused the movement. */
  refId?: string | null;
  createdAt: Date;
}

/** An ADJUSTMENT movement with its audit trail (created entity of the adjustment endpoints). */
export interface InventoryAdjustmentEntity {
  id: string;
  tenantId: string;
  branchId: string;
  itemId: string;
  itemName?: string;
  type: InventoryMovementType;
  /** Signed per convention: negative for losses (MERMA/ROTURA/VENCIMIENTO/DESCUADRE), positive for SOBRANTE. */
  quantity: number;
  reason: InventoryAdjustmentReason;
  /** Unit cost at adjustment time (cost snapshot). */
  cost: number;
  notes?: string | null;
  userId: string;
  userName?: string;
  createdAt: Date;
}

/** Merma P&L summary over a window of ADJUSTMENT movements. */
export interface MermaSummary {
  /** Σ costSnapshot × |quantity| where quantity < 0 (losses). */
  mermaCost: number;
  /** Σ costSnapshot × quantity where quantity > 0 (positive corrections). */
  sobranteCost: number;
  /** Number of ADJUSTMENT rows in the window. */
  count: number;
}

export interface RecentSale {
  id: string;
  customer: string;
  total: number;
  items: number;
  time: string;
}

/**
 * Period-over-period trend percentages for a dashboard window. Values are
 * percentage points (12.4 means twelve point four percent increase); every
 * value is 0 when either window has no activity — an empty period never
 * divides by zero and never yields NaN/Infinity.
 */
export interface DashboardTrend {
  /** % change of revenue (Σ sale totals) vs the previous period. */
  revenue: number;
  /** % change of order count vs the previous period. */
  orders: number;
  /** % change of average ticket (revenue / orders) vs the previous period. */
  avgTicket: number;
}

export interface DistributionDashboardStats {
  salesToday: number;
  salesThisMonth: number;
  totalProducts: number;
  lowStockItems: number;
  cashInRegister: number;
  activeEmployees: number;
  /** Real period-over-period trends: today vs yesterday, month-to-date vs previous month. */
  trends: {
    today: DashboardTrend;
    month: DashboardTrend;
  };
  topProducts: { name: string; sold: number; revenue: number }[];
  salesByDay: { date: string; total: number }[];
  recentSales: RecentSale[];
}

export interface FiscalSummary {
  monthLabel: string;
  totalSales: number;
  taxedRevenue: number;
  taxCollected: number;
  profit: number;
}

/** Generic pagination envelope for tenant-scoped list endpoints. */
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Daily Close Report (Cierre Diario) ───────────────────────────────────────

/** One aggregated product line of a day's sales. */
export interface DailyCloseLine {
  itemName: string;
  uom?: string | null; // from item.attributes.uom
  quantity: number; // total units sold that day
  costUnit: number; // lineCost / quantity (2dp)
  priceUnit: number; // weighted avg sale price (2dp)
  lineCost: number; // sum(cost*qty)
  lineRevenue: number; // sum(price*qty)
  margin: number; // lineRevenue - lineCost
}

/** Sales grouped by payment method for the day. */
export interface DailyClosePaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

/** One receivable (credit) payment collected during the day. */
export interface DailyCloseCollection {
  customerName: string;
  amount: number;
  method: string;
  createdAt: string;
}

/** Full daily close payload consumed by the reports view. */
export interface DailyCloseReport {
  date: string;
  lines: DailyCloseLine[];
  totals: {
    cost: number;
    revenue: number;
    margin: number;
    taxAmount: number;
    discount: number;
  };
  paymentBreakdown: DailyClosePaymentBreakdown[];
  collections: DailyCloseCollection[];
  collectionsTotal: number;
  /**
   * Losses from ADJUSTMENT movements inside the same UTC-6 window:
   * Σ costSnapshot × |quantity| where quantity < 0 (MERMA/ROTURA/VENCIMIENTO/
   * DESCUADRE). Positive corrections (SOBRANTE) are excluded.
   */
  mermaCost: number;
}