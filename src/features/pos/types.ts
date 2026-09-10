export interface ProductDto {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  sku: string;
  taxRate: number;
}

export interface POSOrderDto {
  id: string;
  items: POSOrderItemDto[];
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
}

export interface POSOrderItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreateOrderCommand {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customerName?: string;
}
