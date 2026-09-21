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
}