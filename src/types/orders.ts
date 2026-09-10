// (Pedidos, Items, Enums de estado)
export enum OrderStatusEnum {
    Pending = 1,    // Recibido
    InKitchen = 2,  // En preparación
    Ready = 3,      // Listo para servir
    Served = 4,     // Entregado
    Paid = 5,       // Pagado / Cerrado
    Cancelled = 6   // Cancelado
}

export interface OrderItem {
    orderItemId: number;
    orderId: number;
    productId: number;
    productName: string; // Se guarda por si cambia el nombre después
    quantity: number;
    unitPrice: number;
    subTotal: number;
    notes?: string; // "Sin cebolla"
}

export interface Order {
    orderId: number;
    tableId: number;
    userId: number; // El mesero que abrió la orden
    status: OrderStatusEnum;
    totalAmount: number;
    customerCount: number; // Cuantas personas en la mesa
    openDate: string;
    closeDate?: string | null;
    items: OrderItem[]; // Lista de platillos
}

// CQRS: Command para crear pedido
export interface CreateOrderCommand {
    tableId: number;
    customerCount: number;
    items: {
        productId: number;
        quantity: number;
        notes?: string;
    }[];
}