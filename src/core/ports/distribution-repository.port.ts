// Port contract for the Distribution vertical repository.
// Core layer: no infrastructure imports here.

import type {
  AccessRole,
  CashMovementEntity,
  CashSessionEntity,
  CustomerLight,
  DailyCloseReport,
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
  SaleEntity,
  SaleReturnEntity,
  SupplierEntity,
  TaxRateEntity,
} from '@/core/entities/distribution';

export interface CreateInventoryItemInput {
  sku?: string;
  name: string;
  description?: string;
  cost: number;
  price: number;
  stock: number;
  minAlert: number;
}

export interface UpdateInventoryItemInput {
  sku?: string;
  name?: string;
  description?: string;
  cost?: number;
  price?: number;
  stock?: number;
  minAlert?: number;
  /**
   * Branch scope for stock writes. When provided, `stock`/`minAlert` apply ONLY
   * to that branch's Inventory row (never `inventory[0]`); the branch must
   * belong to the tenant (404) and must carry an inventory row (400).
   */
  branchId?: string;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
}

/**
 * PATCH semantics: undefined fields are left untouched; null clears nullable
 * contact fields. `isActive: false` deactivates the supplier (excluded from
 * new PO selection server-side) while existing purchase orders stay intact.
 */
export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
  role: string;
  /** Access profile: CASHIER/ACCOUNTANT/MANAGER; undefined = legacy full access. */
  accessRole?: AccessRole | null;
  department?: string | null;
  salary?: number | null;
  commissionRate?: number | null;
  hireDate: Date;
}

export interface OpenCashSessionInput {
  branchId: string;
  openingAmount: number;
  employeeId?: string | null;
}

export interface AddCashMovementInput {
  sessionId: string;
  type: 'IN' | 'OUT';
  amount: number;
  concept: string;
}

export interface CloseCashSessionInput {
  sessionId: string;
  /**
   * Only the physical count is client input; expectedAmount/difference are
   * computed server-side from movements and sales (never trusted from client).
   */
  physicalCount: number;
}

// ─── P0 contracts: customers ────────────────────────────────────────────────

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentId?: string | null;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  documentId?: string | null;
}

// ─── P0 contracts: purchase orders (create + receive) ───────────────────────

export interface PurchaseOrderLineInput {
  itemId: string;
  quantity: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  branchId: string;
  items: PurchaseOrderLineInput[];
  notes?: string | null;
  expectedDate?: Date;
}

export interface ReceivePurchaseOrderLineInput {
  itemId: string;
  quantity: number;
}

export interface ReceivePurchaseOrderInput {
  receivedItems: ReceivePurchaseOrderLineInput[];
}

// ─── P0 contracts: employees (update / deactivate / POS PIN link) ───────────

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
  role?: string;
  /** Access profile: CASHIER/ACCOUNTANT/MANAGER; undefined = untouched. */
  accessRole?: AccessRole | null;
  department?: string | null;
  salary?: number | null;
  commissionRate?: number | null;
  hireDate?: Date;
  isActive?: boolean;
  /** POS PIN (4-6 digits); hashed server-side when linking the User. */
  pin?: string;
}

// ─── P0 contracts: invoicing / CAI config ───────────────────────────────────

export interface UpdateInvoicingConfigInput {
  caiNumber?: string;
  rangeFrom?: string;
  rangeTo?: string;
  limitDate?: Date | null;
  companyTaxId?: string;
  legalName?: string;
}

export interface CreateTaxRateInput {
  name: string;
  rate: number;
  isInclusive: boolean;
  isDefault?: boolean;
}

export interface UpdateTaxRateInput {
  name?: string;
  rate?: number;
  isInclusive?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface RegisterSaleLineInput {
  itemId: string;
  quantity: number;
}

export interface RegisterSaleInput {
  lines: RegisterSaleLineInput[];
  discount: number;
  personId?: string | null;
  notes?: string | null;
  paymentMethod: PaymentMethod;
  /** Amount tendered/paid at sale time; balance = total - paidAmount (server-side). */
  paidAmount?: number;
}

// ─── P1 contracts: returns / receivables ─────────────────────────────────────

export interface SaleReturnLineInput {
  itemId: string;
  quantity: number;
}

export interface CreateSaleReturnInput {
  items: SaleReturnLineInput[];
  reason?: string | null;
}

export interface PayReceivableInput {
  amount: number;
  method: PaymentMethod;
}

export interface IDistributionRepository {
  getDashboard(tenantId: string): Promise<DistributionDashboardStats>;
  getInventory(tenantId: string): Promise<InventoryStockItem[]>;
  createInventoryItem(
    tenantId: string,
    input: CreateInventoryItemInput
  ): Promise<InventoryStockItem>;
  updateInventoryItem(
    tenantId: string,
    itemId: string,
    input: UpdateInventoryItemInput
  ): Promise<InventoryStockItem>;
  /**
   * Hard-deletes an item only when no persisted transaction references it
   * (SaleItem / PurchaseOrderItem / SaleReturnItem); referenced items → 409,
   * cross-tenant ids → 404. Inventory rows cascade with the Item.
   */
  deleteInventoryItem(tenantId: string, itemId: string): Promise<void>;
  getSuppliers(tenantId: string): Promise<SupplierEntity[]>;
  createSupplier(tenantId: string, input: CreateSupplierInput): Promise<SupplierEntity>;
  /**
   * PATCH semantics: undefined fields untouched, null clears nullable contact
   * fields, `isActive: false` deactivates (existing POs remain intact — PO
   * create already rejects inactive suppliers). 404 cross-tenant.
   */
  updateSupplier(
    tenantId: string,
    supplierId: string,
    input: UpdateSupplierInput
  ): Promise<SupplierEntity>;
  getPurchaseOrders(tenantId: string): Promise<PurchaseOrderEntity[]>;
  createPurchaseOrder(
    tenantId: string,
    input: CreatePurchaseOrderInput
  ): Promise<PurchaseOrderEntity>;
  receivePurchaseOrder(
    tenantId: string,
    poId: string,
    input: ReceivePurchaseOrderInput
  ): Promise<PurchaseOrderEntity>;
  getEmployees(tenantId: string): Promise<EmployeeEntity[]>;
  createEmployee(tenantId: string, input: CreateEmployeeInput): Promise<EmployeeEntity>;
  /**
   * PATCH semantics: undefined fields are left untouched; null clears nullable
   * fields. When `isActive: false` is applied, the linked User's `posPinHash`
   * is hard-revoked in the same transaction (deactivated employees never keep
   * a live PIN credential).
   */
  updateEmployee(
    tenantId: string,
    employeeId: string,
    input: UpdateEmployeeInput
  ): Promise<EmployeeEntity>;
  /**
   * Links (or re-links) the employee's Person to a `User` with a bcrypt-hashed
   * POS PIN (`role: STAFF`) in the same transaction that applies any other
   * employee fields; requires `input.pin` (`^\d{4,6}$`).
   */
  linkEmployeeUser(
    tenantId: string,
    employeeId: string,
    input: UpdateEmployeeInput
  ): Promise<EmployeeEntity>;
  getOpenCashSession(tenantId: string): Promise<CashSessionEntity | null>;
  openCashSession(
    tenantId: string,
    input: OpenCashSessionInput
  ): Promise<CashSessionEntity>;
  addCashMovement(
    tenantId: string,
    input: AddCashMovementInput
  ): Promise<CashMovementEntity>;
  closeCashSession(
    tenantId: string,
    input: CloseCashSessionInput
  ): Promise<CashSessionEntity>;
  getTaxRates(tenantId: string): Promise<TaxRateEntity[]>;
  createTaxRate(tenantId: string, input: CreateTaxRateInput): Promise<TaxRateEntity>;
  updateTaxRate(
    tenantId: string,
    rateId: string,
    input: UpdateTaxRateInput
  ): Promise<TaxRateEntity>;
  deleteTaxRate(tenantId: string, rateId: string): Promise<void>;
  getFiscalSummary(tenantId: string): Promise<FiscalSummary>;
  findCustomers(tenantId: string, query?: string): Promise<CustomerLight[]>;
  createCustomer(tenantId: string, input: CreateCustomerInput): Promise<CustomerLight>;
  updateCustomer(
    tenantId: string,
    customerId: string,
    input: UpdateCustomerInput
  ): Promise<CustomerLight>;
  getInvoicingConfig(tenantId: string): Promise<InvoicingConfigEntity | null>;
  updateInvoicingConfig(
    tenantId: string,
    input: UpdateInvoicingConfigInput
  ): Promise<InvoicingConfigEntity>;
  registerSale(tenantId: string, input: RegisterSaleInput): Promise<SaleEntity>;
  /**
   * Paginated sales history (tenant-scoped). `page` 1-based; `limit` 1..100 —
   * schema rejects out-of-bounds limits with 400, out-of-range pages return an
   * empty `items` list with `hasMore: false`.
   */
  getSales(
    tenantId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<SaleEntity>>;
  /**
   * Audited return/void for a sale: rejects over-return (refunded qty > sold
   * qty, cumulative across prior returns) with 409, restores stock in the
   * sale-branch inventory, adjusts the open receivable balance when the sale
   * had credit (refund > remaining balance → 409), all in one transaction.
   */
  createSaleReturn(
    tenantId: string,
    saleId: string,
    input: CreateSaleReturnInput
  ): Promise<SaleReturnEntity>;
  /**
   * Paginated, tenant-scoped sales returns (audit list). Same page/limit
   * contract as `getSales`; each return carries its sale number (`saleNumber`)
   * and line items with names.
   */
  getSaleReturns(
    tenantId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<SaleReturnEntity>>;
  /**
   * Paginated, tenant-scoped receivables list; optional OPEN/PARTIAL/PAID
   * status filter. Same page/limit contract as `getSales`.
   */
  getReceivables(
    tenantId: string,
    page?: number,
    limit?: number,
    status?: ReceivableStatus
  ): Promise<PaginatedResult<ReceivableEntity>>;
  /**
   * Applies a payment to a receivable: amount must be > 0 and ≤ the remaining
   * balance (overpay → 409). Creates the ReceivablePayment, reduces the
   * balance, and marks the receivable PARTIAL while a balance remains, PAID
   * when it reaches zero. One transaction.
   */
  payReceivable(
    tenantId: string,
    receivableId: string,
    input: PayReceivableInput
  ): Promise<ReceivableEntity>;
  /**
   * Daily close report for a calendar day (America/Managua, UTC-6): aggregated
   * sales lines by item (cost snapshot × qty vs price × qty), sale totals,
   * payment-method breakdown and credit collections received that day.
   */
  getDailyCloseReport(tenantId: string, date: string): Promise<DailyCloseReport>;
}