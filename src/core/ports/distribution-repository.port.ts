// Port contract for the Distribution vertical repository.
// Core layer: no infrastructure imports here.

import type {
  CashMovementEntity,
  CashSessionEntity,
  CustomerLight,
  DistributionDashboardStats,
  EmployeeEntity,
  FiscalSummary,
  InventoryStockItem,
  PaymentMethod,
  PurchaseOrderEntity,
  SaleEntity,
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
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
  role: string;
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
  getSuppliers(tenantId: string): Promise<SupplierEntity[]>;
  createSupplier(tenantId: string, input: CreateSupplierInput): Promise<SupplierEntity>;
  getPurchaseOrders(tenantId: string): Promise<PurchaseOrderEntity[]>;
  getEmployees(tenantId: string): Promise<EmployeeEntity[]>;
  createEmployee(tenantId: string, input: CreateEmployeeInput): Promise<EmployeeEntity>;
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
  registerSale(tenantId: string, input: RegisterSaleInput): Promise<SaleEntity>;
  getSales(tenantId: string, limit?: number): Promise<SaleEntity[]>;
}