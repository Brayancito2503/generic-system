// Distribution vertical — Domain entities (Core, agnóstico a infraestructura)

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
  invoiceNumber?: string | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  items: SaleLineEntity[];
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

export interface DistributionDashboardStats {
  salesToday: number;
  salesThisMonth: number;
  totalProducts: number;
  lowStockItems: number;
  cashInRegister: number;
  activeEmployees: number;
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